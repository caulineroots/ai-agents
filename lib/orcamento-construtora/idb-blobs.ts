const IDB_DB    = 'orcamento-construtora-idb';
const IDB_STORE = 'blobs';
const IDB_KEY   = 'imageBlobs';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

export async function saveIDBBlobs(blobs: Blob[]): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blobs, IDB_KEY);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    });
  } catch { /* noop */ }
}

export async function loadIDBBlobs(): Promise<Blob[]> {
  try {
    const db  = await openIDB();
    const tx  = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    return await new Promise<Blob[]>((res) => {
      req.onsuccess = () => res((req.result as Blob[]) ?? []);
      req.onerror   = () => res([]);
    });
  } catch { return []; }
}

export async function clearIDBBlobs(): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(IDB_KEY);
  } catch { /* noop */ }
}
