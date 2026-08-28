import type { PantryBackup, PantryEvent, PantryItem } from './domain';

const BASE_DB_NAME = 'pantry-check';
const DB_VERSION = 1;
let namespace = '';

/** Select storage before any pantry operation. Demo data has its own database. */
export function setStorageNamespace(next: string): void {
  namespace = next;
}

function databaseName(): string {
  return `${namespace}${BASE_DB_NAME}`;
}

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error ?? new Error('Local database request failed.'));
  });
}

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(databaseName(), DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'id' });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('Pantry Check could not open local storage.'));
  });
}

async function all<T>(store: 'items' | 'events'): Promise<T[]> {
  const db = await openDatabase();
  try { return await request(db.transaction(store).objectStore(store).getAll()) as T[]; }
  finally { db.close(); }
}

export const getItems = () => all<PantryItem>('items');
export const getEvents = () => all<PantryEvent>('events');

export async function saveItem(item: PantryItem): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction('items', 'readwrite');
  tx.objectStore('items').put(item);
  await transactionDone(tx);
  db.close();
}

export async function saveEvent(event: PantryEvent): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction('events', 'readwrite');
  tx.objectStore('events').put(event);
  await transactionDone(tx);
  db.close();
}

export async function removeItem(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction('items', 'readwrite');
  tx.objectStore('items').delete(id);
  await transactionDone(tx);
  db.close();
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not save this change.'));
    tx.onabort = () => reject(tx.error ?? new Error('The local save was cancelled.'));
  });
}

export async function replaceBackup(backup: PantryBackup): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(['items', 'events'], 'readwrite');
  const itemStore = tx.objectStore('items');
  const eventStore = tx.objectStore('events');
  itemStore.clear();
  eventStore.clear();
  backup.items.forEach((item) => itemStore.put(item));
  backup.events.forEach((event) => eventStore.put(event));
  await transactionDone(tx);
  db.close();
}

export async function clearStorage(): Promise<void> {
  const name = databaseName();
  await new Promise<void>((resolve, reject) => {
    const deletion = indexedDB.deleteDatabase(name);
    deletion.onsuccess = () => resolve();
    deletion.onerror = () => reject(deletion.error ?? new Error('Could not reset local sample data.'));
    deletion.onblocked = () => reject(new Error('Close other Pantry Check tabs, then reset the sample again.'));
  });
}
