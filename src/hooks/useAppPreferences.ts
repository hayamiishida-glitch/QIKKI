import { useCallback, useEffect, useState } from 'react';
import type { SoundPresetId } from '../types/reminder';
import {
  isDesktopApp,
  type DesktopPrefsState,
} from '../services/notificationService';
import {
  applyAccentColorToDocument,
  isValidAccentColorId,
  type AccentColorId,
} from '../utils/accentColors';
import {
  applyUiTransparencyToDocument,
  clampUiTransparency,
  DEFAULT_UI_TRANSPARENCY,
} from '../utils/uiTransparency';
import { normalizeHolidayCountryPref } from '../services/holidayService';

export type TemperatureUnit = 'c' | 'f';
export type ClockFormat = '24h' | '12h';
export type SnoozePresetMinutes = 5 | 10 | 15 | 30;

export interface AppPreferences {
  defaultSoundPreset: SoundPresetId;
  defaultSoundVolume: number;
  defaultSnoozeMinutes: SnoozePresetMinutes;
  defaultVibrationPresetId: string;
  temperatureUnit: TemperatureUnit;
  showHeaderWeather: boolean;
  clockFormat: ClockFormat;
  accentColor: AccentColorId;
  uiTransparency: number;
  webStartupPreference: boolean;
  webStartMinimized: boolean;
  webMinimizeToTray: boolean;
  autoDownloadUpdates: boolean;
  showHolidays: boolean;
  holidayCountryCode: string;
}

const PREFS_KEY = 'qikki_app_preferences_v1';

const DEFAULT_PREFERENCES: AppPreferences = {
  defaultSoundPreset: 'ios-tri-tone',
  defaultSoundVolume: 0.85,
  defaultSnoozeMinutes: 15,
  defaultVibrationPresetId: 'double-pulse',
  temperatureUnit: 'c',
  showHeaderWeather: true,
  clockFormat: '24h',
  accentColor: 'blue',
  uiTransparency: DEFAULT_UI_TRANSPARENCY,
  webStartupPreference: false,
  webStartMinimized: false,
  webMinimizeToTray: true,
  autoDownloadUpdates: true,
  showHolidays: true,
  holidayCountryCode: 'AUTO',
};

function loadStoredPreferences(): AppPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) {
      applyAccentColorToDocument(DEFAULT_PREFERENCES.accentColor);
      applyUiTransparencyToDocument(DEFAULT_PREFERENCES.uiTransparency);
      return DEFAULT_PREFERENCES;
    }
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    const accentColor = isValidAccentColorId(parsed.accentColor)
      ? parsed.accentColor
      : DEFAULT_PREFERENCES.accentColor;
    const uiTransparency = clampUiTransparency(parsed.uiTransparency);
    applyAccentColorToDocument(accentColor);
    applyUiTransparencyToDocument(uiTransparency);
    return {
      defaultSoundPreset: parsed.defaultSoundPreset || DEFAULT_PREFERENCES.defaultSoundPreset,
      defaultSoundVolume:
        typeof parsed.defaultSoundVolume === 'number' &&
        Number.isFinite(parsed.defaultSoundVolume)
          ? Math.min(1, Math.max(0, parsed.defaultSoundVolume))
          : DEFAULT_PREFERENCES.defaultSoundVolume,
      defaultSnoozeMinutes:
        parsed.defaultSnoozeMinutes === 5 ||
        parsed.defaultSnoozeMinutes === 10 ||
        parsed.defaultSnoozeMinutes === 15 ||
        parsed.defaultSnoozeMinutes === 30
          ? parsed.defaultSnoozeMinutes
          : DEFAULT_PREFERENCES.defaultSnoozeMinutes,
      defaultVibrationPresetId:
        parsed.defaultVibrationPresetId ||
        DEFAULT_PREFERENCES.defaultVibrationPresetId,
      temperatureUnit: parsed.temperatureUnit === 'f' ? 'f' : 'c',
      showHeaderWeather: parsed.showHeaderWeather !== false,
      clockFormat: parsed.clockFormat === '12h' ? '12h' : '24h',
      accentColor,
      uiTransparency,
      webStartupPreference: Boolean(parsed.webStartupPreference),
      webStartMinimized: Boolean(parsed.webStartMinimized),
      webMinimizeToTray: parsed.webMinimizeToTray !== false,
      autoDownloadUpdates: parsed.autoDownloadUpdates !== false,
      showHolidays: parsed.showHolidays !== false,
      holidayCountryCode: normalizeHolidayCountryPref(parsed.holidayCountryCode),
    };
  } catch {
    applyAccentColorToDocument(DEFAULT_PREFERENCES.accentColor);
    applyUiTransparencyToDocument(DEFAULT_PREFERENCES.uiTransparency);
    return DEFAULT_PREFERENCES;
  }
}

export function useAppPreferences() {
  const [preferences, setPreferences] = useState<AppPreferences>(() =>
    loadStoredPreferences()
  );
  const [desktopPrefs, setDesktopPrefs] = useState<DesktopPrefsState>(() => {
    const stored = loadStoredPreferences();
    return {
      launchAtStartup: stored.webStartupPreference,
      startMinimized: stored.webStartMinimized,
      minimizeToTray: stored.webMinimizeToTray,
      isPackaged: false,
    };
  });
  const [desktopPrefsLoaded, setDesktopPrefsLoaded] = useState(
    () => !isDesktopApp()
  );

  useEffect(() => {
    applyAccentColorToDocument(preferences.accentColor);
    applyUiTransparencyToDocument(preferences.uiTransparency);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage quota errors
    }
  }, [preferences]);

  useEffect(() => {
    if (!isDesktopApp() || !window.qikkiDesktop?.getDesktopPrefs) {
      setDesktopPrefsLoaded(true);
      return;
    }
    let mounted = true;
    void Promise.all([
      window.qikkiDesktop.getDesktopPrefs().catch(() => null),
      window.qikkiDesktop.getAutoUpdatePref
        ? window.qikkiDesktop.getAutoUpdatePref().catch(() => null)
        : Promise.resolve(null),
    ]).then(([res, autoDownload]) => {
      if (!mounted) return;
      if (res) {
        setDesktopPrefs(res);
      }
      setPreferences((prev) => ({
        ...prev,
        ...(res
          ? {
              webStartupPreference: Boolean(res.launchAtStartup),
              webStartMinimized: Boolean(res.startMinimized),
              webMinimizeToTray: res.minimizeToTray !== false,
            }
          : {}),
        ...(typeof autoDownload === 'boolean'
          ? { autoDownloadUpdates: autoDownload }
          : {}),
      }));
      setDesktopPrefsLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const updatePreferences = useCallback((patch: Partial<AppPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateAutoDownloadUpdates = useCallback(async (enabled: boolean) => {
    const nextVal = Boolean(enabled);
    setPreferences((prev) => ({ ...prev, autoDownloadUpdates: nextVal }));
    if (isDesktopApp() && window.qikkiDesktop?.setAutoUpdatePref) {
      try {
        await window.qikkiDesktop.setAutoUpdatePref(nextVal);
      } catch {
        // Ignore IPC error if shell is restarting
      }
    }
  }, []);

  const updateDesktopStartupPrefs = useCallback(
    async (
      patch: Partial<
        Pick<
          DesktopPrefsState,
          'launchAtStartup' | 'startMinimized' | 'minimizeToTray'
        >
      >
    ) => {
      const prefPatch: Partial<AppPreferences> = {};
      if (typeof patch.launchAtStartup === 'boolean') {
        prefPatch.webStartupPreference = patch.launchAtStartup;
      }
      if (typeof patch.startMinimized === 'boolean') {
        prefPatch.webStartMinimized = patch.startMinimized;
      }
      if (typeof patch.minimizeToTray === 'boolean') {
        prefPatch.webMinimizeToTray = patch.minimizeToTray;
      }

      if (!isDesktopApp() || !window.qikkiDesktop?.setDesktopPrefs) {
        if (Object.keys(prefPatch).length > 0) {
          updatePreferences(prefPatch);
        }
        setDesktopPrefs((prev) => ({
          ...prev,
          launchAtStartup:
            typeof patch.launchAtStartup === 'boolean'
              ? patch.launchAtStartup
              : prev.launchAtStartup,
          startMinimized:
            typeof patch.startMinimized === 'boolean'
              ? patch.startMinimized
              : prev.startMinimized,
          minimizeToTray:
            typeof patch.minimizeToTray === 'boolean'
              ? patch.minimizeToTray
              : prev.minimizeToTray,
        }));
        return null;
      }

      const next = await window.qikkiDesktop.setDesktopPrefs(patch);
      setDesktopPrefs(next);
      updatePreferences({
        webStartupPreference: Boolean(next.launchAtStartup),
        webStartMinimized: Boolean(next.startMinimized),
        webMinimizeToTray: next.minimizeToTray !== false,
      });
      return next;
    },
    [updatePreferences]
  );

  const applyCloudPreferences = useCallback(
    (cloud: {
      defaultSoundPreset: SoundPresetId;
      defaultSoundVolume: number;
      defaultSnoozeMinutes: SnoozePresetMinutes;
      defaultVibrationPresetId: string;
      temperatureUnit: TemperatureUnit;
      showHeaderWeather: boolean;
      clockFormat: ClockFormat;
      accentColor: AccentColorId;
      uiTransparency: number;
      launchAtStartup: boolean;
      startMinimized: boolean;
      minimizeToTray: boolean;
      autoDownloadUpdates: boolean;
      showHolidays: boolean;
      holidayCountryCode: string;
    }) => {
      setPreferences({
        defaultSoundPreset: cloud.defaultSoundPreset,
        defaultSoundVolume: cloud.defaultSoundVolume,
        defaultSnoozeMinutes: cloud.defaultSnoozeMinutes,
        defaultVibrationPresetId: cloud.defaultVibrationPresetId,
        temperatureUnit: cloud.temperatureUnit,
        showHeaderWeather: cloud.showHeaderWeather,
        clockFormat: cloud.clockFormat,
        accentColor: cloud.accentColor,
        uiTransparency: clampUiTransparency(cloud.uiTransparency),
        webStartupPreference: cloud.launchAtStartup,
        webStartMinimized: cloud.startMinimized,
        webMinimizeToTray: cloud.minimizeToTray,
        autoDownloadUpdates: cloud.autoDownloadUpdates,
        showHolidays: cloud.showHolidays !== false,
        holidayCountryCode: normalizeHolidayCountryPref(cloud.holidayCountryCode),
      });

      setDesktopPrefs((prev) => ({
        ...prev,
        launchAtStartup: cloud.launchAtStartup,
        startMinimized: cloud.startMinimized,
        minimizeToTray: cloud.minimizeToTray,
      }));

      if (isDesktopApp()) {
        if (window.qikkiDesktop?.setDesktopPrefs) {
          void window.qikkiDesktop
            .setDesktopPrefs({
              launchAtStartup: cloud.launchAtStartup,
              startMinimized: cloud.startMinimized,
              minimizeToTray: cloud.minimizeToTray,
            })
            .catch(() => {});
        }
        if (window.qikkiDesktop?.setAutoUpdatePref) {
          void window.qikkiDesktop
            .setAutoUpdatePref(cloud.autoDownloadUpdates)
            .catch(() => {});
        }
      }
    },
    []
  );

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  return {
    preferences,
    updatePreferences,
    updateAutoDownloadUpdates,
    applyCloudPreferences,
    resetPreferences,
    desktopPrefs,
    desktopPrefsLoaded,
    updateDesktopStartupPrefs,
  };
}
