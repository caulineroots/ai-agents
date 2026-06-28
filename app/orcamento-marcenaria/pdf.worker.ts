// Web Worker — converte páginas do PDF em JPEGs (ArrayBuffer) fora da main thread.
// Roda em background independentemente da visibilidade da aba.

// Shim: pdfjs usa document.createElement('canvas') internamente.
// No contexto de Web Worker não há document, então redirecionamos para OffscreenCanvas.
if (typeof document === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') return new OffscreenCanvas(0, 0);
      return {};
    },
    createElementNS: (_ns: string, tag: string) => {
      if (tag === 'canvas') return new OffscreenCanvas(0, 0);
      return {};
    },
  };
}

import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export type WorkerInMessage = {
  pdfData: ArrayBuffer;
  selectedPages: number[]; // índices 0-based
};

export type WorkerOutMessage =
  | { type: 'progress'; current: number; total: number }
  | { type: 'done'; buffers: ArrayBuffer[]; texts: string[] }
  | { type: 'error'; message: string };

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const { pdfData, selectedPages } = e.data;

  try {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const total = selectedPages.length;
    const buffers: ArrayBuffer[] = [];
    const texts: string[] = [];

    for (let j = 0; j < total; j++) {
      (self as unknown as Worker).postMessage({
        type: 'progress',
        current: j + 1,
        total,
      } satisfies WorkerOutMessage);

      const page = await pdf.getPage(selectedPages[j] + 1);

      // Extrai texto da página
      try {
        const textContent = await page.getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = (textContent.items as any[])
          .map((item) => item.str as string)
          .filter((s) => s.trim())
          .join(' | ');
        texts.push(text);
      } catch {
        texts.push('');
      }

      // Renderiza em OffscreenCanvas (não depende de rAF, funciona em background)
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d')!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page.render as any)({ canvasContext: ctx, viewport }).promise;
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
      const buffer = await blob.arrayBuffer();
      buffers.push(buffer);
    }

    // Transfere os ArrayBuffers (zero-copy) de volta para a main thread
    (self as unknown as Worker).postMessage(
      { type: 'done', buffers, texts } satisfies WorkerOutMessage,
      buffers,
    );
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'Erro desconhecido na conversão',
    } satisfies WorkerOutMessage);
  }
};
