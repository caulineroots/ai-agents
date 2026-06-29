/**
 * Processamento server-side de PDF de marcenaria recebido via WhatsApp.
 * Renderiza páginas com pdfjs + canvas (node-canvas), chama a pipeline TS
 * de chamada-controlada e salva o resultado no Supabase.
 */

import { supabase } from '@/lib/supabase/client';

// ─── Renderização do PDF ──────────────────────────────────────────────────────

async function renderPdfToJpegs(pdfBuffer: Buffer): Promise<Buffer[]> {
  // Importações dinâmicas para evitar problemas com SSR/Edge
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

    const jpegBuf = canvas.toBuffer('image/jpeg', { quality: 0.85 });
    jpegs.push(jpegBuf);
    page.cleanup();
  }

  await pdfDoc.destroy();
  return jpegs;
}

// ─── Chamada à pipeline de marcenaria ────────────────────────────────────────

async function chamarPipeline(
  jpegs: Buffer[],
  filename: string,
): Promise<{ folha: unknown; resultado: unknown; parseError: string | null }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  const formData = new FormData();
  jpegs.forEach((buf, idx) => {
    const blob = new Blob([buf], { type: 'image/jpeg' });
    formData.append('images', blob, `${filename}_p${idx + 1}.jpg`);
    formData.append('pageTexts', ''); // sem camada de texto por enquanto
  });

  const res = await fetch(`${baseUrl}/api/orcamento-marcenaria/chamada-controlada`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`chamada-controlada retornou ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    folha: unknown;
    resultado: unknown;
    parseError: string | null;
  };

  return { folha: json.folha, resultado: json.resultado, parseError: json.parseError };
}

// ─── Job principal ────────────────────────────────────────────────────────────

export async function processarPdfMarcenaria(
  jobId: string,
  pdfBuffer: Buffer,
  filename: string,
): Promise<void> {
  try {
    await supabase
      .from('whatsapp_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    const jpegs = await renderPdfToJpegs(pdfBuffer);

    const { folha, resultado, parseError } = await chamarPipeline(jpegs, filename);

    if (parseError && !folha) {
      await supabase
        .from('whatsapp_jobs')
        .update({
          status: 'error',
          error_msg: `Pipeline concluída mas JSON inválido: ${parseError}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      return;
    }

    await supabase
      .from('whatsapp_jobs')
      .update({
        status: 'done',
        folha,
        resultado,
        error_msg: parseError ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[marcenaria-job] erro no job ${jobId}:`, msg);
    await supabase
      .from('whatsapp_jobs')
      .update({
        status: 'error',
        error_msg: msg.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}
