/**
 * Processamento server-side de PDF de marmoraria recebido via WhatsApp.
 * Renderiza páginas com pdfjs + canvas (node-canvas), chama a pipeline de
 * chamada-controlada e envia o resultado formatado de volta no WhatsApp.
 *
 * Diferentemente do fluxo de marcenaria, o resultado NÃO vai para o PC display
 * — é enviado diretamente como mensagem de WhatsApp ao remetente.
 */

import type { ResultadoOrcamento, ItemOrcado } from '@/lib/orcamento/types';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function enviarWhatsApp(phone: string, texto: string): Promise<void> {
  try {
    await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ number: phone, text: texto }),
    });
  } catch (err) {
    console.error('[marmoraria-job] erro ao enviar WhatsApp:', err);
  }
}

// ─── Formatação do resultado ──────────────────────────────────────────────────

function formatarResultado(resultado: ResultadoOrcamento, projeto: string): string {
  const linhas: string[] = [];

  linhas.push(`*Orçamento: ${projeto || 'Sem nome'}*\n`);

  // Agrupa itens por ambiente
  const porAmbiente = new Map<string, ItemOrcado[]>();
  for (const item of resultado.itens) {
    const amb = item.ambiente?.trim() || 'Sem ambiente';
    if (!porAmbiente.has(amb)) porAmbiente.set(amb, []);
    porAmbiente.get(amb)!.push(item);
  }

  for (const [ambiente, itens] of porAmbiente) {
    linhas.push(`*${ambiente}*`);

    for (const item of itens) {
      const dims = item.comprimento_m && item.largura_m
        ? ` ${item.comprimento_m.toFixed(2)}m × ${item.largura_m.toFixed(2)}m`
        : item.area_m2
        ? ` ${item.area_m2.toFixed(2)}m²`
        : '';

      const borda = item.borda_ml ? ` + ${item.borda_ml.toFixed(1)}ml borda` : '';
      const mod = item.modulo ? `${item.modulo} ` : '';

      linhas.push(`• ${mod}${item.material}${dims}${borda} — ${brl(item.vlrTotal)}`);

      if (item.pendencias?.length > 0) {
        linhas.push(`  ⚠️ ${item.pendencias.join('; ')}`);
      }
    }

    const subtotal = resultado.porAmbiente[ambiente] ?? 0;
    linhas.push(`Subtotal: ${brl(subtotal)}\n`);
  }

  linhas.push('━━━━━━━━━━━━━━━━');
  linhas.push(`Material: ${brl(resultado.totalMaterial)}`);
  linhas.push(`Serviços: ${brl(resultado.totalServicos)}`);
  linhas.push(`*Total: ${brl(resultado.totalGeral)}*`);

  const nItens = resultado.itens.length;
  const comPendencias = resultado.itens.filter(i => i.pendencias?.length > 0).length;
  if (comPendencias > 0) {
    linhas.push(`\n⚠️ ${comPendencias} de ${nItens} item(ns) com pendências de medida.`);
  }

  return linhas.join('\n');
}

// ─── Renderização do PDF ──────────────────────────────────────────────────────

async function renderPdfToJpegs(pdfBuffer: Buffer): Promise<Buffer[]> {
  const path = await import('path');
  const { createCanvas } = await import('canvas');
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Aponta para o worker real em node_modules — evita o erro de fake worker
  const workerPath = path.resolve(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  );
  GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

  const data = new Uint8Array(pdfBuffer);
  const pdfDoc = await getDocument({ data, useSystemFonts: true }).promise;

  const jpegs: Buffer[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    jpegs.push(canvas.toBuffer('image/jpeg', { quality: 0.85 }));
    page.cleanup();
  }

  await pdfDoc.destroy();
  return jpegs;
}

// ─── Chamada à pipeline de marmoraria ────────────────────────────────────────

async function chamarPipeline(
  jpegs: Buffer[],
  filename: string,
): Promise<{ folha: { projeto: string; itens: unknown[] } | null; resultado: ResultadoOrcamento | null; parseError: string | null }> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000';

  const formData = new FormData();
  jpegs.forEach((buf, idx) => {
    const blob = new Blob([buf], { type: 'image/jpeg' });
    formData.append('images', blob, `${filename}_p${idx + 1}.jpg`);
    formData.append('pageTexts', '');
  });

  const res = await fetch(`${baseUrl}/api/orcamento/chamada-controlada`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`chamada-controlada retornou ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    folha: { projeto: string; itens: unknown[] } | null;
    resultado: ResultadoOrcamento | null;
    parseError: string | null;
  };

  return { folha: json.folha, resultado: json.resultado, parseError: json.parseError };
}

// ─── Job principal ────────────────────────────────────────────────────────────

export async function processarPdfMarmoraria(
  phone: string,
  pdfBuffer: Buffer,
  filename: string,
): Promise<void> {
  try {
    console.log(`[marmoraria-job] iniciando processamento para ${phone} — ${filename}`);

    const jpegs = await renderPdfToJpegs(pdfBuffer);
    console.log(`[marmoraria-job] ${jpegs.length} página(s) renderizada(s)`);

    const { folha, resultado, parseError } = await chamarPipeline(jpegs, filename);

    if (parseError && !resultado) {
      await enviarWhatsApp(
        phone,
        `Processamento concluído com erro ao interpretar o PDF.\nDetalhe: ${parseError.slice(0, 300)}\n\nTente enviar o PDF novamente.`,
      );
      return;
    }

    if (!resultado || resultado.itens.length === 0) {
      await enviarWhatsApp(
        phone,
        'Não consegui extrair itens do PDF. Verifique se é um projeto de marmoraria com medidas e tente novamente.',
      );
      return;
    }

    const projeto = folha?.projeto ?? 'Projeto';
    const mensagem = formatarResultado(resultado, projeto);

    await enviarWhatsApp(phone, mensagem);

    if (parseError) {
      await enviarWhatsApp(phone, `⚠️ Aviso: alguns dados podem estar incompletos.\n${parseError.slice(0, 200)}`);
    }

    console.log(`[marmoraria-job] resultado enviado para ${phone} — ${resultado.itens.length} item(ns), total ${resultado.totalGeral}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[marmoraria-job] erro:`, msg);
    await enviarWhatsApp(
      phone,
      `Ocorreu um erro ao processar o PDF de marmoraria.\nDetalhe: ${msg.slice(0, 200)}\n\nTente novamente em alguns instantes.`,
    );
  }
}
