/**
 * image-db.ts
 *
 * Persiste os arquivos das pranchas no IndexedDB do browser.
 * Cada stem tem 3 entradas opcionais: stem+":image", stem+":pdf", stem+":dxf"
 * Os objetos File são armazenados como Blob diretamente — sem serialização.
 */

import type { PranchaGroup } from './image-store';

const DB_NAME    = 'orcamento-images-v1';
const STORE_NAME = 'files';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function put(key: string, value: File): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function get(key: string): Promise<File | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve((req.result as File) ?? null);
    req.onerror   = () => reject(req.error);
  });
}

/** Salva todos os arquivos dos grupos no IndexedDB. */
export async function saveGroupsToIDB(groups: PranchaGroup[]): Promise<void> {
  await Promise.all(
    groups.flatMap((g) => {
      const ops: Promise<void>[] = [];
      if (g.imageFile) ops.push(put(`${g.stem}:image`, g.imageFile));
      if (g.pdfFile)   ops.push(put(`${g.stem}:pdf`,   g.pdfFile));
      if (g.dxfFile)   ops.push(put(`${g.stem}:dxf`,   g.dxfFile));
      return ops;
    })
  );
}

/**
 * Tenta restaurar os arquivos do IndexedDB para uma lista de stems.
 * Retorna grupos com os arquivos que existirem no cache.
 */
export async function restoreGroupsFromIDB(stems: string[]): Promise<PranchaGroup[]> {
  const groups: PranchaGroup[] = [];

  for (const stem of stems) {
    const [imageFile, pdfFile, dxfFile] = await Promise.all([
      get(`${stem}:image`),
      get(`${stem}:pdf`),
      get(`${stem}:dxf`),
    ]);
    if (imageFile || pdfFile || dxfFile) {
      groups.push({
        stem,
        ...(imageFile ? { imageFile } : {}),
        ...(pdfFile   ? { pdfFile }   : {}),
        ...(dxfFile   ? { dxfFile }   : {}),
      });
    }
  }

  return groups;
}
