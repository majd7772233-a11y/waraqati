export interface StoredImageFile {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  blob: Blob;
}

export interface LocalProject {
  id: string;
  name: string;
  updatedAt: string;
  data: unknown;
}

export interface UserTemplate {
  id: string;
  name: string;
  updatedAt: string;
  editor: Record<string, unknown>;
}

const DB_NAME = "waraqati-local-workspace";
const DB_VERSION = 1;
const IMAGE_STORE = "images";
const PROJECT_STORE = "projects";
const TEMPLATE_STORE = "templates";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PROJECT_STORE)) db.createObjectStore(PROJECT_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(TEMPLATE_STORE)) db.createObjectStore(TEMPLATE_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local storage."));
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    let result = undefined as T;
    let requestSucceeded = false;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      db.close();
      reject(error);
    };
    request.onsuccess = () => {
      result = request.result;
      requestSucceeded = true;
    };
    request.onerror = () => fail(request.error ?? new Error("Local storage request failed."));
    transaction.oncomplete = () => {
      db.close();
      if (settled) return;
      if (!requestSucceeded) {
        settled = true;
        reject(new Error("Local storage transaction completed without a result."));
        return;
      }
      settled = true;
      resolve(result);
    };
    transaction.onerror = () => fail(transaction.error ?? new Error("Local storage transaction failed."));
    transaction.onabort = () => fail(transaction.error ?? new Error("Local storage transaction aborted."));
  });
}

export async function saveImageLibrary(images: StoredImageFile[]): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    const store = tx.objectStore(IMAGE_STORE);
    store.clear();
    for (const image of images) store.put(image);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error("Could not save image library. The browser may be out of storage space.")); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Saving the image library was cancelled.")); };
  });
}

export async function loadImageLibrary(): Promise<StoredImageFile[]> {
  return (await withStore(IMAGE_STORE, "readonly", store => store.getAll())) ?? [];
}

export async function saveLocalProject(project: LocalProject): Promise<void> {
  await withStore(PROJECT_STORE, "readwrite", store => store.put(project));
}

export async function listLocalProjects(): Promise<LocalProject[]> {
  const projects = await withStore(PROJECT_STORE, "readonly", store => store.getAll());
  return (projects ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveUserTemplate(template: UserTemplate): Promise<void> {
  await withStore(TEMPLATE_STORE, "readwrite", store => store.put(template));
}

export async function listUserTemplates(): Promise<UserTemplate[]> {
  const templates = await withStore(TEMPLATE_STORE, "readonly", store => store.getAll());
  return (templates ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteLocalProject(id: string): Promise<void> {
  await withStore(PROJECT_STORE, "readwrite", store => store.delete(id));
}

export function makeLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
