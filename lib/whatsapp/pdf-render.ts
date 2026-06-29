/**
 * Renderização server-side de PDF para imagens JPEG usando pdfjs-dist + node-canvas.
 * Usa NodeCanvasFactory para evitar dependências de APIs do browser (new Image(), etc).
 */

export async function renderPdfToJpegs(pdfBuffer: Buffer): Promise<Buffer[]> {
  const path = await import('path');
  const { createCanvas } = await import('canvas');
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const workerPath = path.resolve(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  );
  GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

  // Factory de canvas compatível com Node.js — evita o erro "Image or Canvas expected"
  const nodeCanvasFactory = {
    create(width: number, height: number) {
      const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
      return { canvas, context: canvas.getContext('2d') };
    },
    reset(cc: { canvas: ReturnType<typeof createCanvas>; context: unknown }, width: number, height: number) {
      cc.canvas.width = Math.ceil(width);
      cc.canvas.height = Math.ceil(height);
    },
    destroy(cc: { canvas: ReturnType<typeof createCanvas> | null; context: unknown }) {
      if (cc.canvas) {
        cc.canvas.width = 0;
        cc.canvas.height = 0;
      }
      cc.canvas = null;
      cc.context = null;
    },
  };

  const data = new Uint8Array(pdfBuffer);
  const pdfDoc = await getDocument({
    data,
    useSystemFonts: true,
    // @ts-expect-error — pdfjs aceita canvasFactory customizado mas types não expõem
    canvasFactory: nodeCanvasFactory,
  }).promise;

  const jpegs: Buffer[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });

    const cc = nodeCanvasFactory.create(viewport.width, viewport.height);

    await page.render({
      canvasContext: cc.context as CanvasRenderingContext2D,
      viewport,
      // @ts-expect-error — pdfjs aceita canvasFactory no render mas types divergem
      canvasFactory: nodeCanvasFactory,
    }).promise;

    jpegs.push((cc.canvas as ReturnType<typeof createCanvas>).toBuffer('image/jpeg', { quality: 0.85 }));
    page.cleanup();
  }

  await pdfDoc.destroy();
  return jpegs;
}
