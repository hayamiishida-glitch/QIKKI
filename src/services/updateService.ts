import { isDesktopApp } from './notificationService';

export const CURRENT_APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__
    ? __APP_VERSION__
    : '1.1.5';

export interface RemoteVersionManifest {
  version: string;
  minSupportedVersion?: string;
  releasedAt?: string;
  notes?: string;
}

export type AppUpdateState = {
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'ready-to-reload'
    | 'error';
  message?: string;
  info?: { version?: string; notes?: string };
  progress?: { percent?: number };
};

export function compareSemver(a: string, b: string): number {
  const clean = (v: string) =>
    v
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const pa = clean(a);
  const pb = clean(b);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export async function activateWaitingServiceWorkerAndReload(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        await new Promise((r) => setTimeout(r, 250));
      } else {
        await reg?.update().catch(() => {});
      }
    }
  } catch {
    // Proceed with reload
  }
  window.location.reload();
}

const AUTO_RELOAD_GUARD_KEY = 'qikki_auto_reload_guard_v1';

export function markAndCheckAutoReloadAllowed(versionLabel?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = versionLabel || CURRENT_APP_VERSION;
    const raw = sessionStorage.getItem(AUTO_RELOAD_GUARD_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: string; at?: number };
      if (parsed.version === key && typeof parsed.at === 'number' && Date.now() - parsed.at < 60_000) {
        return false;
      }
    }
    sessionStorage.setItem(AUTO_RELOAD_GUARD_KEY, JSON.stringify({ version: key, at: Date.now() }));
    return true;
  } catch {
    return true;
  }
}

export async function checkForWebOrPwaUpdates(
  autoApply: boolean
): Promise<AppUpdateState> {
  if (isDesktopApp()) {
    const res = await window.qikkiDesktop?.checkForUpdates?.();
    if (!res?.ok) {
      return {
        status: 'error',
        message: res?.message || 'Could not reach update server.',
      };
    }
    return { status: 'checking' };
  }

  try {
    let hasWaitingSw = false;
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update().catch(() => {});
        hasWaitingSw = Boolean(reg.waiting);
      }
    }

    const resp = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
    });

    let remote: RemoteVersionManifest | null = null;
    if (resp.ok) {
      remote = (await resp.json()) as RemoteVersionManifest;
    }

    const remoteVersion = remote?.version;
    const hasNewerVersion =
      Boolean(remoteVersion) &&
      compareSemver(remoteVersion as string, CURRENT_APP_VERSION) > 0;

    if (hasNewerVersion || hasWaitingSw) {
      const versionLabel = hasNewerVersion
        ? remoteVersion
        : CURRENT_APP_VERSION;
      if (autoApply && markAndCheckAutoReloadAllowed(versionLabel)) {
        return {
          status: 'ready-to-reload',
          info: { version: versionLabel, notes: remote?.notes },
        };
      }
      return {
        status: 'available',
        info: { version: versionLabel, notes: remote?.notes },
      };
    }

    return {
      status: 'not-available',
      info: { version: CURRENT_APP_VERSION },
    };
  } catch (err) {
    return {
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'Could not check for web updates right now.',
    };
  }
}
