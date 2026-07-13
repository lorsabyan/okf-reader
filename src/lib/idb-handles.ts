/**
 * Minimal promise-wrapped IndexedDB helper for persisting
 * FileSystemDirectoryHandles across sessions (structured-cloneable in
 * Chromium). One object store, keyed by recent-bundle name.
 */
import type { DirHandle } from './sources/local';

const DB_NAME = 'okf-reader';
const DB_VERSION = 1;
const STORE = 'handles';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveHandle(key: string, handle: DirHandle): Promise<void> {
  await withStore('readwrite', (store) => store.put(handle, key));
}

export function loadHandle(key: string): Promise<DirHandle | undefined> {
  return withStore<DirHandle | undefined>('readonly', (store) => store.get(key));
}

export async function deleteHandle(key: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(key));
}

/** Keys of every handle currently stored — used to grey out recents that lack one. */
export async function listHandleKeys(): Promise<string[]> {
  const keys = await withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
  return keys.map(String);
}
