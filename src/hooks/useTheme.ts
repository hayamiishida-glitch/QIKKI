import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';
export type NotificationThemePreference = 'match' | 'light' | 'dark';

const APP_THEME_KEY = 'cadence_theme_mode';
const NOTIF_THEME_KEY = 'qikki_notification_theme';

export function useTheme() {
  const [appTheme, setAppTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem(APP_THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return 'dark';
  });

  const [notificationTheme, setNotificationTheme] =
    useState<NotificationThemePreference>(() => {
      if (typeof window === 'undefined') return 'match';
      const stored = localStorage.getItem(NOTIF_THEME_KEY);
      if (stored === 'match' || stored === 'light' || stored === 'dark') {
        return stored;
      }
      return 'match';
    });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', appTheme === 'dark');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', appTheme === 'dark' ? '#0F172A' : '#EEF4FF');
    }
    try {
      localStorage.setItem(APP_THEME_KEY, appTheme);
    } catch {
      // Ignore storage quota errors
    }
  }, [appTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(NOTIF_THEME_KEY, notificationTheme);
    } catch {
      // Ignore storage quota errors
    }
  }, [notificationTheme]);

  const toggleAppTheme = () => {
    setAppTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const resolvedNotificationTheme: ThemeMode =
    notificationTheme === 'match' ? appTheme : notificationTheme;

  return {
    theme: appTheme,
    appTheme,
    setAppTheme,
    toggleTheme: toggleAppTheme,
    toggleAppTheme,
    notificationTheme,
    setNotificationTheme,
    resolvedNotificationTheme,
  };
}
