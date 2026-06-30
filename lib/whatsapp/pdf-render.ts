/**
 * Renderização server-side de PDF para imagens JPEG usando pdfjs-dist + node-canvas.
 * Usa NodeCanvasFactory para evitar dependências de APIs do browser (new Image(), etc).
 */

export async function renderPdfToJpegs(pdfBuffer: Buffer): Promise<Buffer[]> {
  console.log('[pdf-render] importando dependências...');
  const path = await import('path');
  const canvasModule = await import('canvas');
  const { createCanvas, Image: CanvasImage } = canvasModule;
  console.log('[pdf-render] node-canvas importado. createCanvas type:', typeof createCanvas);

  // pdfjs v5 no Node.js 18+ usa createImageBitmap nativo para inline images.
  // O resultado (ImageBitmap nativo) é incompativel com node-canvas drawImage.
  // Deletamos createImageBitmap do global para forcar o pdfjs a usar o fallback via Image.
  if (typeof (global as Record<string, unknown>).createImageBitmap !== 'undefined') {
    delete (global as Record<string, unknown>).createImageBitmap;
    console.log('[pdf-render] global.createImageBitmap removido para compatibilidade com node-canvas');
  }

  // Expõe o Image do node-canvas globalmente para o pdfjs usar no fallback.
  (global as Record<string, unknown>).Image = CanvasImage;
  console.log('[pdf-render] global.Image patcheado com node-canvas Image');

  const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { getDocument, GlobalWorkerOptions } = pdfjsModule;
  console.log('[pdf-render] pdfjs importado. getDocument type:', typeof getDocument);

  const workerPath = path.resolve(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  );
  console.log('[pdf-render] workerPath:', workerPath);
  GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

  const nodeCanvasFactory = {
    create(width: number, height: number) {
      console.log('[pdf-render] NodeCanvasFactory.create', width, height);
      const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
      const context = canvas.getContext('2d');
      console.log('[pdf-render] canvas criado. canvas type:', typeof canvas, 'context type:', typeof context);

      // pdfjs v5 pode chamar ctx.drawImage() com objetos incompativeis com node-canvas
      // (ex: Image nao carregada, ImageBitmap nativo, etc.).
      // Para orçamentos, o que importa e o texto (medidas, materiais, preços) — imagens
      // decorativas podem ser puladas sem perda de informação relevante.
      const origDrawImage = context.drawImage.bind(context);
      // @ts-expect-error — sobrescrevemos drawImage para interceptar erros de tipo
      context.drawImage = (...args: unknown[]) => {
        try {
          // @ts-expect-error — args dinâmicos
          return origDrawImage(...args);
        } catch (err) {
          if (err instanceof TypeError && String(err.message).includes('Image or Canvas expected')) {
            // Imagem incompativel — pula silenciosamente
            return;
          }
          throw err;
        }
      };

      return { canvas, context };
    },
    reset(cc: { canvas: ReturnType<typeof createCanvas>; context: unknown }, width: number, height: number) {
      console.log('[pdf-render] NodeCanvasFactory.reset', width, height);
      cc.canvas.width = Math.ceil(width);
      cc.canvas.height = Math.ceil(height);
    },
    destroy(cc: { canvas: ReturnType<typeof createCanvas> | null; context: unknown }) {
      console.log('[pdf-render] NodeCanvasFactory.destroy');
      if (cc.canvas) {
        cc.canvas.width = 0;
        cc.canvas.height = 0;
      }
      cc.canvas = null;
      cc.context = null;
    },
  };

  console.log('[pdf-render] carregando documento PDF, tamanho:', pdfBuffer.length, 'bytes');
  const data = new Uint8Array(pdfBuffer);

  let pdfDoc: Awaited<ReturnType<typeof getDocument>['promise']>;
  try {
    pdfDoc = await getDocument({
      data,
      useSystemFonts: true,
      isOffscreenCanvasSupported: false,
      // @ts-expect-error — pdfjs aceita canvasFactory customizado mas types não expõem
      canvasFactory: nodeCanvasFactory,
    }).promise;
    console.log('[pdf-render] documento carregado. páginas:', pdfDoc.numPages);
  } catch (err) {
    console.error('[pdf-render] ERRO ao carregar documento:', err);
    throw err;
  }

  const jpegs: Buffer[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    console.log(`[pdf-render] renderizando página ${pageNum}/${pdfDoc.numPages}`);
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    console.log(`[pdf-render] viewport: ${Math.ceil(viewport.width)}x${Math.ceil(viewport.height)}`);

    const cc = nodeCanvasFactory.create(viewport.width, viewport.height);

    try {
      await page.render({
        canvasContext: cc.context as CanvasRenderingContext2D,
        viewport,
        // @ts-expect-error — pdfjs aceita canvasFactory no render mas types divergem
        canvasFactory: nodeCanvasFactory,
      }).promise;
      console.log(`[pdf-render] página ${pageNum} renderizada com sucesso`);
    } catch (err) {
      // Erros de imagem incompativel sao tratados no drawImage interceptado.
      // Outros erros inesperados: loga mas continua para nao abortar o lote inteiro.
      console.warn(`[pdf-render] aviso ao renderizar página ${pageNum}:`, err);
    }

    const buf = (cc.canvas as ReturnType<typeof createCanvas>).toBuffer('image/jpeg', { quality: 0.85 });
    console.log(`[pdf-render] JPEG gerado: ${buf.length} bytes`);
    jpegs.push(buf);
    page.cleanup();
  }

  await pdfDoc.destroy();
  console.log(`[pdf-render] concluído. ${jpegs.length} JPEG(s) gerados`);
  return jpegs;
}
