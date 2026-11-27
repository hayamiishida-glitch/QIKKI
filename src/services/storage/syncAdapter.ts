import type {
  PortableSyncBundle,
  Reminder,
  SyncAdapterStatus,
} from '../../types/reminder';
import {
  computeDeletionExpiry,
  isDeletedExpired,
} from '../../utils/recurrence';

const DB_NAME = 'cadence_reminders_db';
const DB_VERSION = 2;
const STORE_REMINDERS = 'reminders';
const STORE_OUTBOX = 'sync_outbox';
const LS_FALLBACK_KEY = 'cadence_reminders_v1';
const LS_OUTBOX_KEY = 'qikki_outbox_dirty_v1';
const LS_PURGED_IDS_KEY = 'qikki_purged_ids_v1';
const LS_SYNC_CONFIG_KEY = 'cadence_sync_config_v1';
const LS_WORKSPACE_KEY = 'qikki_workspace_id_v1';

export function detectDeviceOrigin(): string {
  if (typeof navigator === 'undefined') return 'Desktop';
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'Windows · Desktop';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS · Desktop';
  if (/Android/i.test(ua)) return 'Android · Mobile';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS · Mobile';
  if (/Linux/i.test(ua)) return 'Linux · Desktop';
  return 'Web · Cross-Platform';
}

function getOrCreateDeviceId(): string {
  const key = 'cadence_device_id';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, created);
    return created;
  } catch {
    return 'dev-local';
  }
}

function getOrCreateWorkspaceId(): string {
  try {
    const existing = localStorage.getItem(LS_WORKSPACE_KEY);
    if (existing) return existing;
    const created =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? `ws-${crypto.randomUUID()}`
        : `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(LS_WORKSPACE_KEY, created);
    return created;
  } catch {
    return 'default';
  }
}

export interface StorageSyncAdapter {
  loadSnapshotSync(): { active: Reminder[]; deleted: Reminder[] } | null;
  loadAll(): Promise<Reminder[]>;
  loadAllRaw(): Promise<Reminder[]>;
  loadAllWithDeleted(): Promise<{ active: Reminder[]; deleted: Reminder[] }>;
  writeCloudMirror(allRaw: Reminder[]): Promise<{ active: Reminder[]; deleted: Reminder[] }>;
  getPurgedIds(): string[];
  clearPurgedIds(): void;
  saveAll(reminders: Reminder[]): Promise<void>;
  upsert(reminder: Reminder): Promise<Reminder>;
  softDelete(id: string): Promise<Reminder | null>;
  restoreDeleted(id: string): Promise<{ active: Reminder[]; deleted: Reminder[] }>;
  permanentlyDelete(id: string): Promise<{ active: Reminder[]; deleted: Reminder[] }>;
  clearAllDeleted(): Promise<{ active: Reminder[]; deleted: Reminder[] }>;
  purgeExpiredLocal(): Promise<{ active: Reminder[]; deleted: Reminder[]; purged: boolean }>;
  exportBundle(reminders: Reminder[]): PortableSyncBundle;
  mergeBundle(
    current: Reminder[],
    incoming: PortableSyncBundle
  ): { merged: Reminder[]; added: number; updated: number };
  getStatus(): SyncAdapterStatus;
  updateSyncConfig(partial: Partial<SyncAdapterStatus>): SyncAdapterStatus;
  syncWithRemote(
    reminders: Reminder[]
  ): Promise<{ syncedAt: string; status: 'ok' | 'local-only' | 'error'; message: string }>;
  startQuietBackgroundSync(
    onRemoteMerged: (activeReminders: Reminder[], deletedReminders: Reminder[]) => void
  ): () => void;
  notifyLocalMutation(): void;
  clearAllLocalData(): Promise<void>;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_REMINDERS)) {
          db.createObjectStore(STORE_REMINDERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
          db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

class LocalFirstSyncAdapter implements StorageSyncAdapter {
  private debounceTimer: number | null = null;
  private isFlushing = false;
  private onRemoteMergedCb:
    | ((activeReminders: Reminder[], deletedReminders: Reminder[]) => void)
    | null = null;

  private readSyncConfig(): SyncAdapterStatus {
    const defaults: SyncAdapterStatus = {
      provider: 'local-indexeddb',
      connected: typeof navigator !== 'undefined' ? navigator.onLine : true,
      lastSyncedAt: null,
      pendingChanges: 0,
      deviceId: getOrCreateDeviceId(),
      deviceName: detectDeviceOrigin(),
      endpointUrl: '',
    };
    try {
      const raw = localStorage.getItem(LS_SYNC_CONFIG_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<SyncAdapterStatus>;
      return { ...defaults, ...parsed, deviceId: defaults.deviceId };
    } catch {
      return defaults;
    }
  }

  private writeSyncConfig(status: SyncAdapterStatus): void {
    try {
      localStorage.setItem(LS_SYNC_CONFIG_KEY, JSON.stringify(status));
    } catch {
      // Ignore storage quota issues
    }
  }

  getPurgedIds(): string[] {
    try {
      const raw = localStorage.getItem(LS_PURGED_IDS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private addPurgedIds(ids: string[]): void {
    if (ids.length === 0) return;
    try {
      const next = Array.from(new Set([...this.getPurgedIds(), ...ids]));
      localStorage.setItem(LS_PURGED_IDS_KEY, JSON.stringify(next));
    } catch {
      // Ignore
    }
  }

  clearPurgedIds(): void {
    try {
      localStorage.removeItem(LS_PURGED_IDS_KEY);
    } catch {
      // Ignore
    }
  }

  private async markOutboxDirty(dirty: boolean): Promise<void> {
    try {
      if (dirty) {
        localStorage.setItem(LS_OUTBOX_KEY, new Date().toISOString());
      } else {
        localStorage.removeItem(LS_OUTBOX_KEY);
      }
    } catch {
      // Ignore
    }

    const db = await openDatabase();
    if (!db) return;
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_OUTBOX, 'readwrite');
        const store = tx.objectStore(STORE_OUTBOX);
        if (dirty) {
          store.put({ id: 'pending', updatedAt: new Date().toISOString() });
        } else {
          store.delete('pending');
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // Ignore
    } finally {
      db.close();
    }
  }

  private async hasDirtyOutbox(): Promise<boolean> {
    if (this.getPurgedIds().length > 0) return true;
    try {
      if (localStorage.getItem(LS_OUTBOX_KEY)) return true;
    } catch {
      // Ignore
    }
    const db = await openDatabase();
    if (!db) return false;
    try {
      const rec = await new Promise<unknown>((resolve) => {
        const tx = db.transaction(STORE_OUTBOX, 'readonly');
        const req = tx.objectStore(STORE_OUTBOX).get('pending');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      return !!rec;
    } catch {
      return false;
    } finally {
      db.close();
    }
  }

  private splitActiveAndDeleted(raw: Reminder[]): {
    active: Reminder[];
    deleted: Reminder[];
  } {
    const active: Reminder[] = [];
    const deleted: Reminder[] = [];
    raw.forEach((r) => {
      if (r.deletedAt) {
        deleted.push(
          r.expiresAt
            ? r
            : { ...r, expiresAt: computeDeletionExpiry(r.deletedAt) }
        );
      } else {
        active.push(r);
      }
    });
    deleted.sort(
      (a, b) =>
        new Date(b.deletedAt || 0).getTime() -
        new Date(a.deletedAt || 0).getTime()
    );
    return { active, deleted };
  }

  loadSnapshotSync(): { active: Reminder[]; deleted: Reminder[] } | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const rawStr = localStorage.getItem(LS_FALLBACK_KEY);
      if (!rawStr) return null;
      const parsed = JSON.parse(rawStr) as Reminder[];
      if (!Array.isArray(parsed)) return null;
      const nowMs = Date.now();
      const kept = parsed.filter(
        (item) => !isDeletedExpired(item.deletedAt, item.expiresAt, nowMs)
      );
      return this.splitActiveAndDeleted(kept);
    } catch {
      return null;
    }
  }

  async loadAllRaw(): Promise<Reminder[]> {
    const db = await openDatabase();
    if (db) {
      try {
        const items = await new Promise<Reminder[]>((resolve, reject) => {
          const tx = db.transaction(STORE_REMINDERS, 'readonly');
          const store = tx.objectStore(STORE_REMINDERS);
          const req = store.getAll();
          req.onsuccess = () => resolve((req.result as Reminder[]) || []);
          req.onerror = () => reject(req.error);
        });
        db.close();
        if (items.length > 0) return items;
      } catch {
        db.close();
      }
    }
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      return raw ? (JSON.parse(raw) as Reminder[]) : [];
    } catch {
      return [];
    }
  }

  async purgeExpiredLocal(): Promise<{
    active: Reminder[];
    deleted: Reminder[];
    purged: boolean;
  }> {
    const raw = await this.loadAllRaw();
    const nowMs = Date.now();
    const expiredIds: string[] = [];
    const kept = raw.filter((item) => {
      if (isDeletedExpired(item.deletedAt, item.expiresAt, nowMs)) {
        expiredIds.push(item.id);
        return false;
      }
      return true;
    });

    if (expiredIds.length > 0) {
      this.addPurgedIds(expiredIds);
      await this.writeLocalRaw(kept);
      await this.markOutboxDirty(true);
      this.notifyLocalMutation();
    }

    const { active, deleted } = this.splitActiveAndDeleted(kept);
    return { active, deleted, purged: expiredIds.length > 0 };
  }

  async loadAllWithDeleted(): Promise<{
    active: Reminder[];
    deleted: Reminder[];
  }> {
    const { active, deleted } = await this.purgeExpiredLocal();
    return { active, deleted };
  }

  async loadAll(): Promise<Reminder[]> {
    const { active } = await this.loadAllWithDeleted();
    return active;
  }

  private async writeLocalRaw(allRaw: Reminder[]): Promise<void> {
    try {
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(allRaw));
    } catch {
      // Ignore
    }

    const db = await openDatabase();
    if (db) {
      try {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_REMINDERS, 'readwrite');
          const store = tx.objectStore(STORE_REMINDERS);
          store.clear();
          allRaw.forEach((item) => store.put(item));
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.onabort = () => resolve();
        });
      } catch {
        // Ignore IDB write failures when localStorage already captured state
      } finally {
        db.close();
      }
    }
  }

  async writeCloudMirror(
    allRaw: Reminder[]
  ): Promise<{ active: Reminder[]; deleted: Reminder[] }> {
    const nowMs = Date.now();
    const kept = allRaw.filter(
      (r) => !isDeletedExpired(r.deletedAt, r.expiresAt, nowMs)
    );
    await this.writeLocalRaw(kept);
    await this.markOutboxDirty(false);
    return this.splitActiveAndDeleted(kept);
  }

  async saveAll(activeReminders: Reminder[]): Promise<void> {
    const existingRaw = await this.loadAllRaw();
    const nowMs = Date.now();
    const activeIds = new Set(activeReminders.map((r) => r.id));
    const retainedDeleted = existingRaw.filter(
      (r) =>
        !!r.deletedAt &&
        !activeIds.has(r.id) &&
        !isDeletedExpired(r.deletedAt, r.expiresAt, nowMs)
    );
    const combined = [...activeReminders, ...retainedDeleted];

    await this.writeLocalRaw(combined);
    await this.markOutboxDirty(true);
    this.notifyLocalMutation();
  }

  async upsert(reminder: Reminder): Promise<Reminder> {
    const all = await this.loadAllRaw();
    const idx = all.findIndex((r) => r.id === reminder.id);
    if (idx >= 0) {
      all[idx] = reminder;
    } else {
      all.push(reminder);
    }
    await this.writeLocalRaw(all);
    await this.markOutboxDirty(true);
    this.notifyLocalMutation();
    return reminder;
  }

  async softDelete(id: string): Promise<Reminder | null> {
    const all = await this.loadAllRaw();
    const nowIso = new Date().toISOString();
    const expiresAt = computeDeletionExpiry(nowIso);
    let deletedItem: Reminder | null = null;

    const updated = all.map((r) => {
      if (r.id !== id) return r;
      deletedItem = {
        ...r,
        deletedAt: nowIso,
        expiresAt,
        updatedAt: nowIso,
        syncVersion: r.syncVersion + 1,
      };
      return deletedItem;
    });

    await this.writeLocalRaw(updated);
    await this.markOutboxDirty(true);
    this.notifyLocalMutation();
    return deletedItem;
  }

  async restoreDeleted(
    id: string
  ): Promise<{ active: Reminder[]; deleted: Reminder[] }> {
    const all = await this.loadAllRaw();
    const nowIso = new Date().toISOString();

    const updated = all.map((r) =>
      r.id === id
        ? {
            ...r,
            deletedAt: null,
            expiresAt: null,
            updatedAt: nowIso,
            syncVersion: r.syncVersion + 1,
          }
        : r
    );

    await this.writeLocalRaw(updated);
    await this.markOutboxDirty(true);
    this.notifyLocalMutation();
    return this.splitActiveAndDeleted(updated);
  }

  async permanentlyDelete(
    id: string
  ): Promise<{ active: Reminder[]; deleted: Reminder[] }> {
    const all = await this.loadAllRaw();
    const updated = all.filter((r) => r.id !== id);
    this.addPurgedIds([id]);
    await this.writeLocalRaw(updated);
    await this.markOutboxDirty(true);
    this.notifyLocalMutation();
    return this.splitActiveAndDeleted(updated);
  }

  async clearAllDeleted(): Promise<{ active: Reminder[]; deleted: Reminder[] }> {
    const all = await this.loadAllRaw();
    const removedIds = all.filter((r) => !!r.deletedAt).map((r) => r.id);
    const remaining = all.filter((r) => !r.deletedAt);
    this.addPurgedIds(removedIds);
    await this.writeLocalRaw(remaining);
    await this.markOutboxDirty(true);
    this.notifyLocalMutation();
    return this.splitActiveAndDeleted(remaining);
  }

  exportBundle(reminders: Reminder[]): PortableSyncBundle {
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      deviceOrigin: detectDeviceOrigin(),
      reminders,
    };
  }

  mergeBundle(
    current: Reminder[],
    incoming: PortableSyncBundle
  ): { merged: Reminder[]; added: number; updated: number } {
    const map = new Map<string, Reminder>();
    current.forEach((r) => map.set(r.id, r));

    let added = 0;
    let updated = 0;

    incoming.reminders.forEach((remote) => {
      const local = map.get(remote.id);
      if (!local) {
        map.set(remote.id, remote);
        added++;
      } else {
        const remoteTime = new Date(remote.updatedAt).getTime();
        const localTime = new Date(local.updatedAt).getTime();
        if (
          remoteTime > localTime ||
          (remoteTime === localTime && remote.syncVersion > local.syncVersion)
        ) {
          map.set(remote.id, remote);
          updated++;
        }
      }
    });

    const merged = Array.from(map.values()).filter((r) => !r.deletedAt);
    return { merged, added, updated };
  }

  private mergeRawLists(
    localRaw: Reminder[],
    remoteRaw: Reminder[],
    purgedIds: Set<string>,
    nowMs: number
  ): Reminder[] {
    const map = new Map<string, Reminder>();
    localRaw.forEach((r) => {
      if (!purgedIds.has(r.id) && !isDeletedExpired(r.deletedAt, r.expiresAt, nowMs)) {
        map.set(r.id, r);
      }
    });
    remoteRaw.forEach((remote) => {
      if (purgedIds.has(remote.id) || isDeletedExpired(remote.deletedAt, remote.expiresAt, nowMs)) {
        return;
      }
      const local = map.get(remote.id);
      if (!local) {
        map.set(remote.id, remote);
      } else {
        const rt = new Date(remote.updatedAt).getTime();
        const lt = new Date(local.updatedAt).getTime();
        if (rt > lt || (rt === lt && remote.syncVersion > local.syncVersion)) {
          map.set(remote.id, remote);
        }
      }
    });
    return Array.from(map.values());
  }

  getStatus(): SyncAdapterStatus {
    return this.readSyncConfig();
  }

  updateSyncConfig(partial: Partial<SyncAdapterStatus>): SyncAdapterStatus {
    const next = { ...this.readSyncConfig(), ...partial };
    this.writeSyncConfig(next);
    return next;
  }

  private getTargetEndpoint(): string {
    const custom = this.readSyncConfig().endpointUrl.trim();
    return custom || '/api/sync';
  }

  private async runQuietSync(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    if (this.isFlushing) return false;
    this.isFlushing = true;

    try {
      const localRaw = await this.loadAllRaw();
      const purgedIdsArr = this.getPurgedIds();
      const purgedSet = new Set(purgedIdsArr);
      const workspaceId = getOrCreateWorkspaceId();
      const endpoint = this.getTargetEndpoint();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          reminders: localRaw,
          purgedIds: purgedIdsArr,
          clientTime: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as {
        reminders?: Reminder[];
        serverTime?: string;
      };

      if (Array.isArray(data.reminders)) {
        const mergedRaw = this.mergeRawLists(
          localRaw,
          data.reminders,
          purgedSet,
          Date.now()
        );
        await this.writeLocalRaw(mergedRaw);

        const localSig = localRaw
          .map((r) => `${r.id}:${r.updatedAt}:${r.syncVersion}:${r.deletedAt || ''}`)
          .sort()
          .join('|');
        const mergedSig = mergedRaw
          .map((r) => `${r.id}:${r.updatedAt}:${r.syncVersion}:${r.deletedAt || ''}`)
          .sort()
          .join('|');

        if (localSig !== mergedSig && this.onRemoteMergedCb) {
          const split = this.splitActiveAndDeleted(mergedRaw);
          this.onRemoteMergedCb(split.active, split.deleted);
        }
      }

      this.clearPurgedIds();
      await this.markOutboxDirty(false);
      this.updateSyncConfig({
        provider: 'cloud-rest',
        connected: true,
        lastSyncedAt: data.serverTime || new Date().toISOString(),
        pendingChanges: 0,
      });
      return true;
    } catch {
      return false;
    } finally {
      this.isFlushing = false;
    }
  }

  notifyLocalMutation(): void {
    if (typeof window === 'undefined') return;
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      void this.runQuietSync();
    }, 750);
  }

  startQuietBackgroundSync(
    onRemoteMerged: (activeReminders: Reminder[], deletedReminders: Reminder[]) => void
  ): () => void {
    this.onRemoteMergedCb = onRemoteMerged;

    if (typeof navigator === 'undefined' || navigator.onLine) {
      void this.runQuietSync();
    }

    const handleOnline = () => {
      void this.runQuietSync();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void this.runQuietSync();
      }
    };

    const handlePageHide = () => {
      if (!navigator.onLine) return;
      void this.hasDirtyOutbox().then((dirty) => {
        if (!dirty) return;
        void this.loadAllRaw().then((localRaw) => {
          try {
            fetch(this.getTargetEndpoint(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              keepalive: true,
              body: JSON.stringify({
                workspaceId: getOrCreateWorkspaceId(),
                reminders: localRaw,
                purgedIds: this.getPurgedIds(),
                clientTime: new Date().toISOString(),
              }),
            }).catch(() => {});
          } catch {
            // Ignore
          }
        });
      });
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    const intervalId = window.setInterval(() => {
      if (navigator.onLine) {
        void this.hasDirtyOutbox().then((dirty) => {
          if (dirty) {
            void this.runQuietSync();
          }
        });
      }
    }, 60000);

    return () => {
      this.onRemoteMergedCb = null;
      if (this.debounceTimer !== null) {
        window.clearTimeout(this.debounceTimer);
      }
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.clearInterval(intervalId);
    };
  }

  async syncWithRemote(
    reminders: Reminder[]
  ): Promise<{ syncedAt: string; status: 'ok' | 'local-only' | 'error'; message: string }> {
    const ok = await this.runQuietSync();
    if (ok) {
      return {
        syncedAt: new Date().toISOString(),
        status: 'ok',
        message: 'Local IndexedDB and online workspace are synchronized.',
      };
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        syncedAt: new Date().toISOString(),
        status: 'local-only',
        message:
          'Offline right now. Changes are saved locally and will upload quietly once reconnected.',
      };
    }
    return {
      syncedAt: new Date().toISOString(),
      status: 'error',
      message: `Could not reach sync server (${reminders.length} items remain safely stored locally).`,
    };
  }

  async clearAllLocalData(): Promise<void> {
    if (this.debounceTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const db = await openDatabase();
    if (db) {
      try {
        await new Promise<void>((resolve) => {
          const tx = db.transaction([STORE_REMINDERS, STORE_OUTBOX], 'readwrite');
          tx.objectStore(STORE_REMINDERS).clear();
          tx.objectStore(STORE_OUTBOX).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      } catch {
        // Ignore IDB clear issues
      } finally {
        db.close();
      }
    }

    if (typeof indexedDB !== 'undefined') {
      await new Promise<void>((resolve) => {
        try {
          const req = indexedDB.deleteDatabase(DB_NAME);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        } catch {
          resolve();
        }
      });
    }

    const keysToRemove = [
      LS_FALLBACK_KEY,
      LS_OUTBOX_KEY,
      LS_PURGED_IDS_KEY,
      LS_SYNC_CONFIG_KEY,
      LS_WORKSPACE_KEY,
      'cadence_device_id',
      'cadence_seeded_v1',
      'cadence_seeded_untouched_v1',
      'qikki_occurrence_exclusions_v1',
      'qikki_app_preferences_v1',
      'qikki_weather_cache_v1',
      'qikki_weather_consent_v1',
      'cadence_theme_mode',
      'cadence_notification_theme_pref',
    ];

    try {
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore storage errors
    }

    if (typeof window !== 'undefined' && window.qikkiDesktop?.clearLocalData) {
      await window.qikkiDesktop.clearLocalData().catch(() => ({ ok: false }));
    }
  }
}

export const storageAdapter: StorageSyncAdapter = new LocalFirstSyncAdapter();
