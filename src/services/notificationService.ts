import type { Reminder } from '../types/reminder';
import { formatRecurrenceSummary } from '../utils/recurrence';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface DispatchNotificationResult {
  ok: boolean;
  channel?: 'desktop-ipc' | 'web-notification' | 'service-worker';
  reason?: 'unsupported' | 'denied' | 'default' | 'iframe-blocked' | 'error';
  message: string;
}

export interface DesktopAuthResult {
  ok: boolean;
  idToken?: string | null;
  accessToken?: string | null;
  code?: string;
  message?: string;
}

export interface DesktopPrefsState {
  launchAtStartup: boolean;
  startMinimized: boolean;
  minimizeToTray: boolean;
  isPackaged: boolean;
}

declare global {
  interface Window {
    qikkiDesktop?: {
      isDesktop?: boolean;
      platform?: 'darwin' | 'win32' | 'linux' | string;
      storeChannel?: 'direct' | 'ms-store' | 'mas';
      notify?: (payload: {
        title: string;
        body: string;
        silent?: boolean;
      }) => Promise<{ ok: boolean; channel?: string }>;
      minimizeWindow?: () => Promise<void>;
      toggleMaximizeWindow?: () => Promise<boolean>;
      closeWindow?: () => Promise<void>;
      isMaximized?: () => Promise<boolean>;
      onMaximizeChange?: (cb: (maximized: boolean) => void) => () => void;
      signInWithGoogle?: () => Promise<DesktopAuthResult>;
      signInWithGooglePopup?: () => Promise<DesktopAuthResult>;
      cancelGoogleSignIn?: () => Promise<void>;
      completeDesktopAuth?: (payload: DesktopAuthResult) => Promise<void>;
      onGoogleAuthMode?: (cb: (mode: 'browser' | 'popup') => void) => () => void;
      getDesktopPrefs?: () => Promise<DesktopPrefsState>;
      setDesktopPrefs?: (
        patch: Partial<Pick<DesktopPrefsState, 'launchAtStartup' | 'startMinimized' | 'minimizeToTray'>>
      ) => Promise<DesktopPrefsState>;
      clearLocalData?: () => Promise<{ ok: boolean }>;
      checkForUpdates?: () => Promise<{ ok: boolean; version?: string; message?: string }>;
      downloadUpdate?: () => Promise<{ ok: boolean; message?: string }>;
      installUpdate?: () => Promise<{ ok: boolean }>;
      getAutoUpdatePref?: () => Promise<boolean>;
      getUpdateStatus?: () => Promise<{ status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'; info?: any; progress?: any; message?: string }>;
      setAutoUpdatePref?: (enabled: boolean) => Promise<boolean>;
      onUpdateStatus?: (cb: (statusObj: { status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'; info?: any; progress?: any; message?: string }) => void) => () => void;
    };
  }
}

export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.qikkiDesktop?.isDesktop);
}

export function isEmbeddedIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function getNotificationPermission(): NotificationPermissionState {
  if (isDesktopApp()) return 'granted';
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (isDesktopApp()) return 'granted';
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export async function dispatchSystemNotification(
  reminder: Reminder
): Promise<DispatchNotificationResult> {
  const recurrenceText = formatRecurrenceSummary(reminder.recurrence);
  const bodyParts = [
    reminder.notes?.trim() || '',
    recurrenceText !== 'Once' ? recurrenceText : '',
  ].filter(Boolean);
  const body = bodyParts.join(' · ') || 'Scheduled reminder is due now.';

  // 1. Electron Desktop App native notification / tray balloon (Windows & macOS)
  if (typeof window !== 'undefined' && window.qikkiDesktop?.notify) {
    try {
      const res = await window.qikkiDesktop.notify({
        title: reminder.title,
        body,
        silent: reminder.sound.presetId === 'silent',
      });
      if (res?.ok) {
        return {
          ok: true,
          channel: 'desktop-ipc',
          message:
            window.qikkiDesktop.platform === 'darwin'
              ? 'macOS desktop notification sent.'
              : 'Desktop notification sent.',
        };
      }
    } catch {
      // Fall through to web Notification API
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'This browser does not support desktop notifications.',
    };
  }

  const perm = Notification.permission;
  if (perm !== 'granted') {
    if (isEmbeddedIframe()) {
      return {
        ok: false,
        reason: 'iframe-blocked',
        message:
          'Browser preview iframes block system notifications. Open Qikki in its own browser tab to enable alerts.',
      };
    }
    return {
      ok: false,
      reason: perm === 'denied' ? 'denied' : 'default',
      message:
        perm === 'denied'
          ? 'Notifications are blocked in your browser site settings for this URL.'
          : 'Click "Enable Alerts" first to allow system notifications.',
    };
  }

  // Unique tag per trigger so repeated or test toasts always pop a fresh banner
  const uniqueTag = `qikki-${reminder.id}-${Date.now()}`;
  const iconUrl = `${window.location.origin}/pwa-192x192.png`;

  const webOptions: NotificationOptions = {
    body,
    icon: iconUrl,
    badge: iconUrl,
    tag: uniqueTag,
    requireInteraction: true,
    silent: reminder.sound.presetId === 'silent',
  };

  // 2. Try standard Window Notification constructor first
  try {
    const notif = new Notification(reminder.title, webOptions);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    return {
      ok: true,
      channel: 'web-notification',
      message: 'System notification sent. (If hidden, check Focus / Do Not Disturb settings.)',
    };
  } catch {
    // Mobile / iOS Home Screen Web Apps may require ServiceWorkerRegistration.showNotification
  }

  // 3. Service Worker fallback
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.active && typeof reg.showNotification === 'function') {
        const swOptions: NotificationOptions & { vibrate?: number[] } = {
          ...webOptions,
          vibrate:
            reminder.vibration.pattern.length > 0
              ? reminder.vibration.pattern
              : undefined,
        };
        await reg.showNotification(reminder.title, swOptions);
        return {
          ok: true,
          channel: 'service-worker',
          message: 'System notification dispatched via service worker.',
        };
      }
    }
  } catch {
    // Fall through to error
  }

  return {
    ok: false,
    reason: isEmbeddedIframe() ? 'iframe-blocked' : 'error',
    message: isEmbeddedIframe()
      ? 'Embedded preview frames block system notifications. Open Qikki directly in its own browser tab.'
      : 'Could not dispatch notification. Check browser site permissions and system Notification settings.',
  };
}
