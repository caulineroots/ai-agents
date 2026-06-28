import { marmorariaError, marmorariaLog } from './debug';

type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

/** Carrega pdfjs apenas no browser (evita SSR e chunk stale do Turbopack). */
export function getPdfjs(): Promise<PdfjsModule> {
  if (typeof window === 'undefined') {
    marmorariaError('pdfjs', 'getPdfjs called on server (SSR)');
    return Promise.reject(new Error('pdfjs requires browser'));
  }
  if (!pdfjsPromise) {
    marmorariaLog('pdfjs', 'loading pdfjs-dist/build/pdf.mjs…');
    pdfjsPromise = import('pdfjs-dist/build/pdf.mjs')
      .then((mod) => {
        mod.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        marmorariaLog('pdfjs', 'pdfjs loaded OK');
        return mod;
      })
      .catch((err) => {
        marmorariaError('pdfjs', 'failed to load pdfjs module', err);
        pdfjsPromise = null;
        throw err;
      });
  }
  return pdfjsPromise;
}