/**
 * 本地持久化层（IndexedDB）。
 *
 * 约定：
 * - 只在浏览器/WebView 环境下调用；SSR 阶段（构建静态导出时）里所有读操作返回空值。
 * - 曲目元数据存 tracks，封面二进制存 covers，偏好/收藏/历史存 kv。
 */

import type { PlayHistoryEntry, Track } from "./types";

const DB_NAME = "konzert";
const DB_VERSION = 1;

export const TRACK_STORE = "tracks";
export const COVER_STORE = "covers";
export const KV_STORE = "kv";

export const KV_FAVORITES = "favorites";
export const KV_HISTORY = "history";
export const KV_SETTINGS = "settings";

export interface CoverRecord {
  id: string;
  blob: Blob;
}

interface KvRecord {
  key: string;
  value: unknown;
}

export function storageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (!storageAvailable()) {
    return Promise.reject(new Error("当前环境不支持 IndexedDB"));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TRACK_STORE)) {
        const store = db.createObjectStore(TRACK_STORE, { keyPath: "id" });
        store.createIndex("addedAt", "addedAt");
        store.createIndex("albumKey", "albumKey");
      }
      if (!db.objectStoreNames.contains(COVER_STORE)) {
        db.createObjectStore(COVER_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("无法打开本地数据库"));
    request.onblocked = () =>
      reject(new Error("本地数据库被其他窗口占用，请关闭其他标签页后重试"));
  });

  return databasePromise;
}

/** 在一个事务里执行操作，事务提交后才 resolve，确保写入真正落盘。 */
async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | null,
): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise<T | undefined>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction(storeName, mode);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    const store = transaction.objectStore(storeName);
    let request: IDBRequest<T> | null = null;
    try {
      request = work(store);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("本地数据库操作被中止"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("本地数据库操作失败"));
  });
}

/** 一次性操作多个对象仓库（用于 resetDatabase）。 */
async function withTransaction(
  storeNames: string[],
  mode: IDBTransactionMode,
  work: (stores: Record<string, IDBObjectStore>) => void,
): Promise<void> {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores: Record<string, IDBObjectStore> = {};
    for (const name of storeNames) stores[name] = transaction.objectStore(name);
    work(stores);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("本地数据库操作被中止"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("本地数据库操作失败"));
  });
}

// ---------------------------------------------------------------- 曲目

type LegacyTrack = Track & {
  bitsPerSample?: number | null;
  year?: number | null;
};

export async function loadTracks(): Promise<Track[]> {
  if (!storageAvailable()) return [];
  const tracks = await withStore<Track[]>(TRACK_STORE, "readonly", (store) =>
    store.getAll() as IDBRequest<Track[]>,
  );
  // 旧版本入库的记录没有 composer 字段，也可能没有 releaseDate（此前为 year）。
  return (tracks ?? []).map((track) => {
    const legacyTrack = track as LegacyTrack;
    return {
      ...track,
      composer: legacyTrack.composer ?? "",
      bitDepth:
        legacyTrack.bitDepth ?? legacyTrack.bitsPerSample ?? null,
      releaseDate:
        legacyTrack.releaseDate ??
        (legacyTrack.year != null
          ? {
              display: null,
              year: legacyTrack.year,
              sortValue: legacyTrack.year * 10000,
            }
          : { display: null, year: null, sortValue: 0 }),
    };
  });
}

export async function saveTracks(tracks: Track[]): Promise<void> {
  if (!storageAvailable() || tracks.length === 0) return;
  await withStore(TRACK_STORE, "readwrite", (store) => {
    for (const track of tracks) store.put(track);
    return null;
  });
}

export async function deleteTracks(ids: string[]): Promise<void> {
  if (!storageAvailable() || ids.length === 0) return;
  await withStore(TRACK_STORE, "readwrite", (store) => {
    for (const id of ids) store.delete(id);
    return null;
  });
}

// ---------------------------------------------------------------- 封面

export async function loadCover(id: string): Promise<Blob | null> {
  if (!storageAvailable()) return null;
  const record = await withStore<CoverRecord | undefined>(
    COVER_STORE,
    "readonly",
    (store) => store.get(id) as IDBRequest<CoverRecord | undefined>,
  );
  return record?.blob ?? null;
}

export async function saveCovers(records: CoverRecord[]): Promise<void> {
  if (!storageAvailable() || records.length === 0) return;
  await withStore(COVER_STORE, "readwrite", (store) => {
    for (const record of records) store.put(record);
    return null;
  });
}

export async function deleteCovers(ids: string[]): Promise<void> {
  if (!storageAvailable() || ids.length === 0) return;
  await withStore(COVER_STORE, "readwrite", (store) => {
    for (const id of ids) store.delete(id);
    return null;
  });
}

// ---------------------------------------------------------------- 键值

export async function loadKv<T>(key: string): Promise<T | null> {
  if (!storageAvailable()) return null;
  const record = await withStore<KvRecord | undefined>(
    KV_STORE,
    "readonly",
    (store) => store.get(key) as IDBRequest<KvRecord | undefined>,
  );
  return record ? (record.value as T) : null;
}

export async function saveKv(key: string, value: unknown): Promise<void> {
  if (!storageAvailable()) return;
  await withStore(KV_STORE, "readwrite", (store) => {
    const record: KvRecord = { key, value };
    store.put(record);
    return null;
  });
}

export async function loadFavorites(): Promise<string[]> {
  return (await loadKv<string[]>(KV_FAVORITES)) ?? [];
}

export async function loadHistory(): Promise<PlayHistoryEntry[]> {
  return (await loadKv<PlayHistoryEntry[]>(KV_HISTORY)) ?? [];
}

// ---------------------------------------------------------------- 维护

export async function resetDatabase(): Promise<void> {
  if (!storageAvailable()) return;
  await withTransaction(
    [TRACK_STORE, COVER_STORE, KV_STORE],
    "readwrite",
    (stores) => {
      stores[TRACK_STORE].clear();
      stores[COVER_STORE].clear();
      stores[KV_STORE].clear();
    },
  );
}

/** 估算本地占用，用于设置面板展示。 */
export async function estimateUsage(): Promise<{
  usage: number;
  quota: number;
} | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return null;
  }
  const estimate = await navigator.storage.estimate();
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}