import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  Camera,
  Check,
  CloudSun,
  Download,
  ExternalLink,
  Globe,
  Laptop,
  MapPin,
  Moon,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  Share,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { SoundPresetId } from '../types/reminder';
import type {
  NotificationThemePreference,
  ThemeMode,
} from '../hooks/useTheme';
import type {
  AppPreferences,
  ClockFormat,
  SnoozePresetMinutes,
  TemperatureUnit,
} from '../hooks/useAppPreferences';
import {
  searchWeatherCities,
  type CitySearchResult,
  type WeatherForecastData,
  type WeatherLocationStatus,
} from '../hooks/useWeatherForecast';
import {
  isDesktopApp,
  isEmbeddedIframe,
  requestNotificationPermission,
  type DesktopPrefsState,
  type DispatchNotificationResult,
  type NotificationPermissionState,
} from '../services/notificationService';
import {
  playReminderSound,
  SOUND_PRESETS,
  unlockAudioEngine,
} from '../services/soundEngine';
import { VIBRATION_PRESETS } from '../services/vibrationEngine';
import { ACCENT_COLOR_PRESETS } from '../utils/accentColors';
import { UI_TRANSPARENCY_PRESETS } from '../utils/uiTransparency';
import { useAuth } from '../contexts/AuthContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  activateWaitingServiceWorkerAndReload,
  checkForWebOrPwaUpdates,
  CURRENT_APP_VERSION,
  type AppUpdateState,
} from '../services/updateService';
import { UserAvatar } from './UserAvatar';
import { ProfilePictureModal } from './ProfilePictureModal';
import {
  getCountryFlagEmoji,
  type HolidayCountryOption,
} from '../services/holidayService';

interface PreferencesViewProps {
  preferences: AppPreferences;
  onUpdatePreferences: (patch: Partial<AppPreferences>) => void;
  onResetPreferences: () => void;
  desktopPrefs: DesktopPrefsState;
  desktopPrefsLoaded: boolean;
  onUpdateDesktopStartupPrefs: (
    patch: Partial<
      Pick<
        DesktopPrefsState,
        'launchAtStartup' | 'startMinimized' | 'minimizeToTray'
      >
    >
  ) => Promise<DesktopPrefsState | null>;
  onUpdateAutoDownloadUpdates: (enabled: boolean) => Promise<void>;
  notifPerm: NotificationPermissionState;
  onChangeNotifPerm: (perm: NotificationPermissionState) => void;
  onTestSystemNotification: () => Promise<DispatchNotificationResult>;
  onPreviewNotificationTheme: () => void;
  appTheme: ThemeMode;
  notificationTheme: NotificationThemePreference;
  onChangeAppTheme: (theme: ThemeMode) => void;
  onChangeNotificationTheme: (theme: NotificationThemePreference) => void;
  weatherStatus: WeatherLocationStatus;
  weatherForecast: WeatherForecastData | null;
  weatherError: string | null;
  onRequestWeatherLocation: () => Promise<void>;
  onRefreshWeather: () => Promise<void>;
  onSelectManualCity: (city: CitySearchResult) => Promise<void>;
  onDisableWeatherLocation: () => void;
  holidayDetectedCountryCode: string;
  holidayDetectedCountryName: string;
  holidayEffectiveCountryCode: string;
  holidayEffectiveCountryName: string;
  holidayCountries: HolidayCountryOption[];
  holidayCount: number;
  holidaysLoading: boolean;
  holidaysError: string | null;
  holidaysLastUpdatedAt: string | null;
  onRefreshHolidays: () => Promise<void>;
  syncSection?: React.ReactNode;
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

const ToggleSwitchRow: React.FC<ToggleRowProps> = ({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {label}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300/75">
        {description}
      </p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-45 ${
        checked
          ? 'qikki-accent-switch-on'
          : 'bg-slate-900/15 dark:bg-white/15'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform duration-150 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

export const PreferencesView: React.FC<PreferencesViewProps> = ({
  preferences,
  onUpdatePreferences,
  onResetPreferences,
  desktopPrefs,
  desktopPrefsLoaded,
  onUpdateDesktopStartupPrefs,
  onUpdateAutoDownloadUpdates,
  notifPerm,
  onChangeNotifPerm,
  onTestSystemNotification,
  onPreviewNotificationTheme,
  appTheme,
  notificationTheme,
  onChangeAppTheme,
  onChangeNotificationTheme,
  weatherStatus,
  weatherForecast,
  weatherError,
  onRequestWeatherLocation,
  onRefreshWeather,
  onSelectManualCity,
  onDisableWeatherLocation,
  holidayDetectedCountryCode,
  holidayDetectedCountryName,
  holidayEffectiveCountryCode,
  holidayEffectiveCountryName,
  holidayCountries,
  holidayCount,
  holidaysLoading,
  holidaysError,
  holidaysLastUpdatedAt,
  onRefreshHolidays,
  syncSection,
}) => {
  const isDesktop = isDesktopApp();
  const desktopPlatform =
    typeof window !== 'undefined' ? window.qikkiDesktop?.platform : undefined;
  const storeChannel =
    typeof window !== 'undefined'
      ? window.qikkiDesktop?.storeChannel ?? 'direct'
      : 'direct';
  const isStoreManaged =
    isDesktop && (storeChannel === 'ms-store' || storeChannel === 'mas');
  const inIframe = !isDesktop && isEmbeddedIframe();
  const { isInstallable, isInstalled, isIOS, isMacOS, install } = usePWAInstall();

  const [notifFeedback, setNotifFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CitySearchResult[]>([]);
  const [searchingCity, setSearchingCity] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<AppUpdateState>({
    status: 'idle',
  });
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installingPwa, setInstallingPwa] = useState(false);

  const { user, avatarUrl, updateAvatar } = useAuth();
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  const stopPreviewRef = useRef<(() => void) | null>(null);
  const volTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isDesktop) return;
    let active = true;
    void window.qikkiDesktop?.getUpdateStatus?.().then((initial) => {
      if (active && initial && initial.status !== 'idle') {
        setUpdateStatus(initial);
      }
    }).catch(() => {});
    const unsub = window.qikkiDesktop?.onUpdateStatus?.((obj) => {
      setUpdateStatus(obj);
    });
    return () => {
      active = false;
      unsub?.();
    };
  }, [isDesktop]);

  useEffect(() => {
    return () => {
      stopPreviewRef.current?.();
      if (volTimerRef.current !== null) {
        window.clearTimeout(volTimerRef.current);
      }
    };
  }, []);

  const previewTone = (presetId: SoundPresetId, volume: number) => {
    stopPreviewRef.current?.();
    if (presetId === 'silent' || volume <= 0) return;
    unlockAudioEngine();
    stopPreviewRef.current = playReminderSound(presetId, volume, 1);
  };

  const handleRequestNotifications = async () => {
    unlockAudioEngine();
    const res = await requestNotificationPermission();
    onChangeNotifPerm(res);
    if (res === 'granted') {
      setNotifFeedback({
        ok: true,
        message: 'Notifications are allowed. Use Send Test Alert to verify.',
      });
    } else if (inIframe) {
      setNotifFeedback({
        ok: false,
        message:
          'Embedded preview frames block notification prompts. Open Qikki in its own browser tab to enable alerts.',
      });
    } else if (res === 'denied') {
      setNotifFeedback({
        ok: false,
        message:
          'Notifications are blocked in your browser site settings. Click the lock/tune icon in your address bar to allow them.',
      });
    } else {
      setNotifFeedback({
        ok: false,
        message: 'Notification prompt was dismissed. Click Allow Notifications again to allow.',
      });
    }
  };

  const handleSendTestToast = async () => {
    const res = await onTestSystemNotification();
    setNotifFeedback({ ok: res.ok, message: res.message });
  };

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = cityQuery.trim();
    if (trimmed.length < 2) return;
    setSearchingCity(true);
    try {
      const results = await searchWeatherCities(trimmed);
      setCityResults(results);
    } finally {
      setSearchingCity(false);
    }
  };

  const effectiveLaunchAtStartup = isDesktop
    ? desktopPrefs.launchAtStartup
    : preferences.webStartupPreference;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      {/* Centered Page Heading */}
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          Preferences
        </h1>
        <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-300/85">
          {user
            ? 'All settings and customizations below sync automatically across your devices via Cloud Firestore.'
            : 'Customize startup behavior, notification shortcuts, appearance, local weather, and cloud sync & backups.'}
        </p>
      </div>

      {/* Profile Picture & Avatar */}
      <section className="qikki-glass-card rounded-3xl border border-white/80 bg-white/58 p-6 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <UserAvatar
              photoURL={avatarUrl}
              displayName={user?.displayName}
              email={user?.email}
              size="lg"
              showTracing={true}
              onClick={() => setAvatarModalOpen(true)}
              showEditBadge={true}
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {user ? (user.displayName || user.email?.split('@')[0] || 'User Profile') : 'Personal Profile'}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-400/15 dark:text-blue-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  Tracing Glow
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {user ? user.email : 'Personalize your profile picture with cute presets or upload from your device'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAvatarModalOpen(true)}
            className="qikki-accent-btn inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-xs transition-transform active:scale-95"
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Change Profile Picture</span>
          </button>
        </div>
      </section>

      {/* 1. Startup & Window Behavior */}
      <section className="qikki-glass-card rounded-3xl border border-white/80 bg-white/58 p-6 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Power className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span>Startup &amp; Background Behavior</span>
          </div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {isDesktop ? 'Desktop OS Integration' : 'Web Browser Session'}
          </span>
        </div>

        <div className="mt-4 divide-y divide-slate-900/[0.07] border-t border-slate-900/[0.08] pt-3 dark:divide-white/[0.08] dark:border-white/[0.09]">
          <ToggleSwitchRow
            label="Launch Qikki on system startup"
            description={
              isDesktop
                ? desktopPlatform === 'darwin'
                  ? 'Automatically start Qikki when you sign in to macOS so scheduled reminders stay active.'
                  : 'Automatically start Qikki when you sign in to your computer so scheduled reminders stay active.'
                : 'Saved as a desktop startup preference (takes effect automatically in the Qikki macOS & Windows Desktop apps).'
            }
            checked={effectiveLaunchAtStartup}
            disabled={isDesktop && !desktopPrefsLoaded}
            onChange={(next) => {
              void onUpdateDesktopStartupPrefs({ launchAtStartup: next });
            }}
          />

          <ToggleSwitchRow
            label="Minimized in tray on startup"
            description={
              isDesktop
                ? desktopPlatform === 'darwin'
                  ? 'Start Qikki hidden quietly in the macOS menu bar on startup so reminders run in the background.'
                  : 'Start Qikki hidden directly in the system tray on startup so reminders run silently in the background.'
                : 'Start Qikki collapsed into the compact floating mini-tray bar when opened in your browser (or hidden in tray on Desktop).'
            }
            checked={desktopPrefs.startMinimized}
            disabled={isDesktop && !desktopPrefsLoaded}
            onChange={(next) => {
              void onUpdateDesktopStartupPrefs({ startMinimized: next });
            }}
          />

          <ToggleSwitchRow
            label="Keep running in menu bar / tray when closed"
            description="Hide Qikki to the tray or menu bar instead of exiting when clicking the close button so alerts keep firing."
            checked={desktopPrefs.minimizeToTray}
            disabled={isDesktop && !desktopPrefsLoaded}
            onChange={(next) => {
              void onUpdateDesktopStartupPrefs({ minimizeToTray: next });
            }}
          />
        </div>
      </section>

      {/* 2. Notifications Shortcut & Default Alert Cues */}
      <section className="qikki-glass-card rounded-3xl border border-white/80 bg-white/58 p-6 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <BellRing className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>Notifications &amp; Alert Defaults</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300/80">
              Quickly enable system alerts and set default sound, volume, snooze, and haptic feedback.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {inIframe && notifPerm !== 'granted' ? (
              <a
                href={typeof window !== 'undefined' ? window.location.href : '/'}
                target="_blank"
                rel="noopener noreferrer"
                className="qikki-accent-btn inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-xs whitespace-nowrap"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Open in Tab to Allow</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => void handleRequestNotifications()}
                disabled={notifPerm === 'granted' || notifPerm === 'unsupported'}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  notifPerm === 'granted'
                    ? 'border border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                    : 'qikki-accent-btn shadow-xs disabled:opacity-45'
                }`}
              >
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {notifPerm === 'granted'
                    ? 'Notifications Allowed'
                    : notifPerm === 'denied'
                      ? 'Notifications Blocked'
                      : notifPerm === 'unsupported'
                        ? 'Unavailable'
                        : 'Allow Notifications'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleSendTestToast()}
              className="rounded-xl border border-slate-900/12 bg-white/70 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white whitespace-nowrap dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.13]"
            >
              Send Test Toast
            </button>

            <button
              type="button"
              onClick={onPreviewNotificationTheme}
              className="rounded-xl border border-slate-900/12 bg-white/70 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white whitespace-nowrap dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.13]"
            >
              Preview Popup
            </button>
          </div>
        </div>

        {notifFeedback && (
          <p
            className={`mt-3 text-xs ${
              notifFeedback.ok
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {notifFeedback.message}
          </p>
        )}

        <div className="mt-5 grid gap-4 border-t border-slate-900/[0.08] pt-5 sm:grid-cols-2 dark:border-white/[0.09]">
          {/* Default Sound & Live Preview */}
          <div className="space-y-1.5">
            <label
              htmlFor="pref-default-sound"
              className="block text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              Default reminder sound
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  previewTone(
                    preferences.defaultSoundPreset,
                    preferences.defaultSoundVolume
                  )
                }
                disabled={
                  preferences.defaultSoundPreset === 'silent' ||
                  preferences.defaultSoundVolume <= 0
                }
                aria-label="Preview default sound"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-900/12 bg-white/75 text-blue-600 transition-colors hover:bg-white disabled:opacity-40 dark:border-white/14 dark:bg-white/[0.07] dark:text-blue-400"
              >
                {preferences.defaultSoundPreset === 'silent' ||
                preferences.defaultSoundVolume <= 0 ? (
                  <VolumeX className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <select
                id="pref-default-sound"
                value={preferences.defaultSoundPreset}
                onChange={(e) => {
                  const nextPreset = e.target.value as SoundPresetId;
                  onUpdatePreferences({ defaultSoundPreset: nextPreset });
                  previewTone(nextPreset, preferences.defaultSoundVolume || 0.5);
                }}
                className="h-9 w-full rounded-xl border border-slate-900/12 bg-white/75 px-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-white/14 dark:bg-slate-900/75 dark:text-white"
              >
                {SOUND_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Default Alert Volume */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor="pref-default-volume"
                className="font-medium text-slate-700 dark:text-slate-200"
              >
                Default sound volume
              </label>
              <span className="font-mono font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                {preferences.defaultSoundPreset === 'silent'
                  ? '0%'
                  : `${Math.round(preferences.defaultSoundVolume * 100)}%`}
              </span>
            </div>
            <div className="flex h-9 items-center rounded-xl border border-slate-900/12 bg-white/75 px-3 dark:border-white/14 dark:bg-white/[0.07]">
              <input
                id="pref-default-volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                disabled={preferences.defaultSoundPreset === 'silent'}
                value={
                  preferences.defaultSoundPreset === 'silent'
                    ? 0
                    : preferences.defaultSoundVolume
                }
                onChange={(e) => {
                  const vol = Number(e.target.value);
                  onUpdatePreferences({ defaultSoundVolume: vol });
                  if (volTimerRef.current !== null) {
                    window.clearTimeout(volTimerRef.current);
                  }
                  volTimerRef.current = window.setTimeout(() => {
                    previewTone(preferences.defaultSoundPreset, vol);
                    volTimerRef.current = null;
                  }, 160);
                }}
                className="h-1.5 w-full cursor-pointer accent-blue-600 disabled:opacity-40"
              />
            </div>
          </div>

          {/* Default Snooze Duration */}
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Primary snooze duration
            </span>
            <div className="inline-flex w-full rounded-xl bg-slate-900/[0.06] p-1 dark:bg-white/[0.07]">
              {([5, 10, 15, 30] as SnoozePresetMinutes[]).map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() =>
                    onUpdatePreferences({ defaultSnoozeMinutes: mins })
                  }
                  className={`flex-1 rounded-lg px-2 py-1.5 font-mono text-xs font-medium tabular-nums transition-colors ${
                    preferences.defaultSnoozeMinutes === mins
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.16] dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300/80 dark:hover:text-white'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {/* Default Vibration Pattern */}
          <div className="space-y-1.5">
            <label
              htmlFor="pref-default-vibration"
              className="block text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              Default vibration / haptic pattern
            </label>
            <select
              id="pref-default-vibration"
              value={preferences.defaultVibrationPresetId}
              onChange={(e) =>
                onUpdatePreferences({
                  defaultVibrationPresetId: e.target.value,
                })
              }
              className="h-9 w-full rounded-xl border border-slate-900/12 bg-white/75 px-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-white/14 dark:bg-slate-900/75 dark:text-white"
            >
              {VIBRATION_PRESETS.map((v) => (
                <option key={v.presetId} value={v.presetId}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 3. Appearance (Moved into Preferences) */}
      <section className="qikki-glass-card rounded-3xl border border-white/80 bg-white/58 p-6 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Appearance
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300/80">
              Choose Light or Dark surfaces for Qikki and reminder alert popups, plus your preferred clock format.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 border-t border-slate-900/[0.08] pt-5 sm:grid-cols-3 dark:border-white/[0.09]">
          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              App UI Theme
            </span>
            <div
              role="group"
              aria-label="App UI theme"
              className="inline-flex w-full items-center rounded-xl bg-slate-900/[0.06] p-1 dark:bg-white/[0.07]"
            >
              <button
                type="button"
                onClick={() => onChangeAppTheme('light')}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  appTheme === 'light'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.16] dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300/80 dark:hover:text-white'
                }`}
              >
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeAppTheme('dark')}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  appTheme === 'dark'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.16] dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300/80 dark:hover:text-white'
                }`}
              >
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Notification Theme
            </span>
            <div
              role="group"
              aria-label="Notification popup theme"
              className="inline-flex w-full items-center rounded-xl bg-slate-900/[0.06] p-1 dark:bg-white/[0.07]"
            >
              {(
                [
                  { id: 'match', label: 'Match' },
                  { id: 'light', label: 'Light' },
                  { id: 'dark', label: 'Dark' },
                ] as { id: NotificationThemePreference; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeNotificationTheme(opt.id)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                    notificationTheme === opt.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.16] dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300/80 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Time Format
            </span>
            <div
              role="group"
              aria-label="Time format"
              className="inline-flex w-full items-center rounded-xl bg-slate-900/[0.06] p-1 dark:bg-white/[0.07]"
            >
              {(
                [
                  { id: '24h', label: '24-hour' },
                  { id: '12h', label: '12-hour' },
                ] as { id: ClockFormat; label: string }[]
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => onUpdatePreferences({ clockFormat: fmt.id })}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                    preferences.clockFormat === fmt.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.16] dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300/80 dark:hover:text-white'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Button Accent Color (Beta) */}
        <div className="mt-5 border-t border-slate-900/[0.08] pt-5 dark:border-white/[0.09]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Button Accent Color
                </span>
                <span className="inline-flex items-center rounded-md border border-amber-500/35 bg-amber-500/12 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-300">
                  Beta
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300/75">
                Customize primary action button colors across Qikki. More surface accents coming later.
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label="Button accent color"
              className="flex flex-wrap items-center gap-2"
            >
              {ACCENT_COLOR_PRESETS.map((preset) => {
                const selected = preferences.accentColor === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${preset.label} button accent`}
                    title={preset.label}
                    onClick={() =>
                      onUpdatePreferences({ accentColor: preset.id })
                    }
                    className={`group flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all ${
                      selected
                        ? 'border-slate-900/25 bg-white text-slate-950 shadow-xs dark:border-white/30 dark:bg-white/[0.16] dark:text-white'
                        : 'border-slate-900/10 bg-white/55 text-slate-600 hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.12] dark:hover:text-white'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: preset.swatchHex }}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white shadow-xs ring-1 ring-black/15 dark:ring-white/20"
                    >
                      {selected && (
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      )}
                    </span>
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* UI Transparency */}
        <div className="mt-5 border-t border-slate-900/[0.08] pt-5 dark:border-white/[0.09]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="pref-ui-transparency"
                  className="text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  UI Transparency
                </label>
                <span className="rounded-md bg-slate-900/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-slate-700 dark:bg-white/[0.1] dark:text-slate-200">
                  {preferences.uiTransparency}%
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300/75">
                Choose how transparent glass cards, toolbars, and panels look over the animated background.
              </p>
            </div>

            <div className="w-full sm:w-56 shrink-0">
              <div className="flex h-9 items-center gap-2.5 rounded-xl border border-slate-900/12 bg-white/75 px-3 dark:border-white/14 dark:bg-white/[0.07]">
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Solid
                </span>
                <input
                  id="pref-ui-transparency"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={preferences.uiTransparency}
                  onChange={(e) =>
                    onUpdatePreferences({
                      uiTransparency: Number(e.target.value),
                    })
                  }
                  aria-label="UI transparency level"
                  className="h-1.5 w-full cursor-pointer accent-blue-600"
                />
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Clear
                </span>
              </div>
            </div>
          </div>

          <div
            role="radiogroup"
            aria-label="UI transparency presets"
            className="mt-3 flex flex-wrap items-center gap-2"
          >
            {UI_TRANSPARENCY_PRESETS.map((preset) => {
              const selected = preferences.uiTransparency === preset.value;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() =>
                    onUpdatePreferences({ uiTransparency: preset.value })
                  }
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all ${
                    selected
                      ? 'border-slate-900/25 bg-white text-slate-950 shadow-xs dark:border-white/30 dark:bg-white/[0.16] dark:text-white'
                      : 'border-slate-900/10 bg-white/55 text-slate-600 hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.12] dark:hover:text-white'
                  }`}
                >
                  <span>{preset.label}</span>
                  <span className="font-mono text-[10px] opacity-65 tabular-nums">
                    {preset.value}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Weather & Location Access */}
      <section className="qikki-glass-card rounded-3xl border border-white/80 bg-white/58 p-6 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <CloudSun className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>Weather Forecast &amp; Location</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300/80">
              {weatherForecast
                ? `Showing live forecast for ${weatherForecast.locationName}${
                    weatherForecast.regionLabel ? `, ${weatherForecast.regionLabel}` : ''
                  }.`
                : 'Allow location access or select a city to display accurate live weather in the header bar.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void onRequestWeatherLocation()}
              disabled={weatherStatus === 'loading'}
              className="qikki-accent-btn inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {weatherStatus === 'loading'
                  ? 'Detecting...'
                  : weatherForecast
                    ? 'Update Location'
                    : 'Allow Location Access'}
              </span>
            </button>

            {weatherForecast && (
              <>
                <button
                  type="button"
                  onClick={() => void onRefreshWeather()}
                  disabled={weatherStatus === 'loading'}
                  aria-label="Refresh weather"
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-900/12 bg-white/70 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.13]"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={onDisableWeatherLocation}
                  className="rounded-xl px-2.5 py-2 text-xs font-medium text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-300"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {weatherError && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            {weatherError}
          </p>
        )}

        <div className="mt-5 space-y-4 border-t border-slate-900/[0.08] pt-4 dark:border-white/[0.09]">
          <ToggleSwitchRow
            label="Show animated weather in top bar"
            description="Display compact live temperature and animated forecast conditions next to window controls."
            checked={preferences.showHeaderWeather}
            onChange={(next) =>
              onUpdatePreferences({ showHeaderWeather: next })
            }
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900/[0.07] pt-3 dark:border-white/[0.08]">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Temperature unit
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-300/75">
                Choose Celsius or Fahrenheit for the top-bar weather forecast.
              </p>
            </div>
            <div className="inline-flex rounded-xl bg-slate-900/[0.06] p-1 dark:bg-white/[0.07]">
              {(
                [
                  { id: 'c', label: '°C Celsius' },
                  { id: 'f', label: '°F Fahrenheit' },
                ] as { id: TemperatureUnit; label: string }[]
              ).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onUpdatePreferences({ temperatureUnit: u.id })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    preferences.temperatureUnit === u.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.16] dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300/80 dark:hover:text-white'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Manual City Picker */}
          <div className="border-t border-slate-900/[0.07] pt-3 dark:border-white/[0.08]">
            <form
              onSubmit={(e) => void handleCitySearch(e)}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  placeholder="Or search a city manually (e.g. Tokyo, Jakarta, Seattle)..."
                  aria-label="Search city for weather"
                  className="h-9 w-full rounded-xl border border-slate-900/12 bg-white/75 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-white/14 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-400"
                />
              </div>
              <button
                type="submit"
                disabled={searchingCity || cityQuery.trim().length < 2}
                className="h-9 rounded-xl border border-slate-900/12 bg-white/75 px-3.5 text-xs font-medium text-slate-800 hover:bg-white disabled:opacity-45 whitespace-nowrap dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-100 dark:hover:bg-white/[0.14]"
              >
                {searchingCity ? 'Searching...' : 'Find City'}
              </button>
            </form>

            {cityResults.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {cityResults.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => {
                      void onSelectManualCity(city);
                      setCityResults([]);
                      setCityQuery('');
                    }}
                    className="rounded-lg border border-slate-900/10 bg-white/80 px-2.5 py-1.5 text-xs text-slate-800 transition-colors hover:border-blue-500/40 hover:bg-blue-50 dark:border-white/12 dark:bg-white/[0.08] dark:text-slate-100 dark:hover:bg-blue-500/20"
                  >
                    {city.name}
                    {city.region ? `, ${city.region}` : ''}
                    {city.country ? ` (${city.country})` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4b. Localized Public Holidays */}
      <section
        id="preferences-holidays"
        className="qikki-glass-card scroll-mt-20 rounded-3xl border border-white/80 bg-white/58 p-6 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Globe className="h-4 w-4 text-rose-500 dark:text-rose-400" aria-hidden="true" />
              <span>Localized Public Holidays</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300/80">
              Automatically displays up-to-date public holidays based on your country or selected region.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {preferences.showHolidays && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/12 px-2.5 py-1 text-[11px] font-medium text-rose-700 dark:bg-rose-400/15 dark:text-rose-200">
                <span>{getCountryFlagEmoji(holidayEffectiveCountryCode)}</span>
                <span>{holidayEffectiveCountryName}</span>
                {holidayCount > 0 && (
                  <span className="font-mono opacity-75 tabular-nums">
                    · {holidayCount}
                  </span>
                )}
              </span>
            )}
            <button
              type="button"
              onClick={() => void onRefreshHolidays()}
              disabled={!preferences.showHolidays || holidaysLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/12 bg-white/75 px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:bg-white disabled:opacity-45 dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-100 dark:hover:bg-white/[0.14]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${holidaysLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{holidaysLoading ? 'Updating...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-4 border-t border-slate-900/[0.08] pt-4 dark:border-white/[0.09]">
          <ToggleSwitchRow
            label="Show localized holidays on calendar"
            description="Highlight official public holidays on the monthly grid, agenda bar, and welcome greeting."
            checked={preferences.showHolidays}
            onChange={(next) => onUpdatePreferences({ showHolidays: next })}
          />

          <div className="flex flex-col gap-2 border-t border-slate-900/[0.07] pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.08]">
            <div className="min-w-0">
              <label
                htmlFor="pref-holiday-country"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Holiday Country / Region
              </label>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300/75">
                {preferences.holidayCountryCode === 'AUTO'
                  ? `Using automatic detection (${getCountryFlagEmoji(
                      holidayDetectedCountryCode
                    )} ${holidayDetectedCountryName}).`
                  : `Manually pinned to ${getCountryFlagEmoji(
                      holidayEffectiveCountryCode
                    )} ${holidayEffectiveCountryName}.`}
                {holidaysLastUpdatedAt && preferences.showHolidays && !holidaysError
                  ? ` Synced ${new Date(holidaysLastUpdatedAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}.`
                  : ''}
              </p>
            </div>

            <select
              id="pref-holiday-country"
              disabled={!preferences.showHolidays}
              value={preferences.holidayCountryCode}
              onChange={(e) =>
                onUpdatePreferences({ holidayCountryCode: e.target.value })
              }
              className="h-9 w-full rounded-xl border border-slate-900/12 bg-white/75 px-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:opacity-45 sm:w-64 dark:border-white/14 dark:bg-slate-900/75 dark:text-white"
            >
              <option value="AUTO">
                Automatic ({getCountryFlagEmoji(holidayDetectedCountryCode)}{' '}
                {holidayDetectedCountryName})
              </option>
              {holidayCountries.map((country) => (
                <option key={country.countryCode} value={country.countryCode}>
                  {getCountryFlagEmoji(country.countryCode)} {country.name} (
                  {country.countryCode})
                </option>
              ))}
            </select>
          </div>

          {holidaysError && preferences.showHolidays && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {holidaysError}
            </p>
          )}
        </div>
      </section>

      {/* Platform, Install & Future Updates */}
      <section className="qikki-glass-card rounded-3xl border border-white/80 bg-white/58 p-6 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300">
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                App Version, Platforms &amp; Updates
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-300/75">
                Ready for Windows, macOS, and iOS — check for updates and manage automatic background delivery.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/[0.06] px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-white/[0.08] dark:text-slate-200">
              {isDesktop ? (
                <>
                  <Laptop className="h-3 w-3" aria-hidden="true" />
                  <span>{desktopPlatform === 'darwin' ? 'macOS Desktop' : 'Windows Desktop'}</span>
                </>
              ) : isIOS ? (
                <>
                  <Smartphone className="h-3 w-3" aria-hidden="true" />
                  <span>{isInstalled ? 'iOS Home Screen App' : 'iOS Safari'}</span>
                </>
              ) : isMacOS ? (
                <>
                  <Laptop className="h-3 w-3" aria-hidden="true" />
                  <span>{isInstalled ? 'macOS Web App' : 'macOS Browser'}</span>
                </>
              ) : (
                <span>{isInstalled ? 'Installed PWA' : 'Web PWA'}</span>
              )}
            </span>
            <span className="rounded-full bg-blue-500/15 px-3 py-1 font-mono text-xs font-semibold text-blue-700 dark:bg-blue-400/20 dark:text-blue-300">
              v{CURRENT_APP_VERSION}
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {!isDesktop && !isInstalled && (
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-4 dark:border-blue-400/20 dark:bg-blue-400/[0.07]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {isIOS ? 'Install Qikki on iPhone / iPad' : 'Install Qikki App'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300/80">
                    {isIOS
                      ? 'Add Qikki to your iOS Home Screen for full-screen launch, offline access, and safe-area edge-to-edge layout.'
                      : isMacOS && !isInstallable
                        ? 'In macOS Safari choose File → Add to Dock, or install the universal Qikki macOS app.'
                        : 'Install Qikki on your device for instant launch, offline reliability, and background reminders.'}
                  </p>
                </div>

                {isInstallable ? (
                  <button
                    type="button"
                    disabled={installingPwa}
                    onClick={async () => {
                      setInstallingPwa(true);
                      try {
                        await install();
                      } finally {
                        setInstallingPwa(false);
                      }
                    }}
                    className="qikki-accent-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{installingPwa ? 'Installing...' : 'Install Qikki'}</span>
                  </button>
                ) : isIOS ? (
                  <button
                    type="button"
                    onClick={() => setShowIOSGuide((prev) => !prev)}
                    className="qikki-accent-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs transition-transform active:scale-95"
                  >
                    <Share className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{showIOSGuide ? 'Hide Steps' : 'How to Install'}</span>
                  </button>
                ) : null}
              </div>

              {isIOS && showIOSGuide && (
                <ol className="mt-3 space-y-1.5 border-t border-blue-500/15 pt-3 text-xs text-slate-700 dark:border-blue-400/15 dark:text-slate-200">
                  <li>1. Open Qikki in Safari on your iPhone or iPad.</li>
                  <li>2. Tap the Share icon at the bottom or top toolbar.</li>
                  <li>3. Scroll down and tap &ldquo;Add to Home Screen&rdquo;, then tap Add.</li>
                </ol>
              )}
            </div>
          )}

          <ToggleSwitchRow
            label="Automatic background update checks & downloads"
            description={
              isDesktop
                ? isStoreManaged
                  ? 'Updates are handled automatically by the Microsoft Store / Mac App Store.'
                  : 'Automatically download new macOS or Windows updates in the background when published.'
                : 'Automatically check for newer web & iOS PWA releases in the background when Qikki opens.'
            }
            checked={isStoreManaged ? true : preferences.autoDownloadUpdates}
            disabled={isStoreManaged}
            onChange={async (next) => {
              await onUpdateAutoDownloadUpdates(next);
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900/[0.07] pt-4 dark:border-white/[0.08]">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Software Update Status
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-300/75">
                {isStoreManaged &&
                  `Managed via ${storeChannel === 'mas' ? 'Mac App Store' : 'Microsoft Store'} (v${CURRENT_APP_VERSION}).`}
                {!isStoreManaged && updateStatus.status === 'idle' &&
                  `You are running Qikki v${CURRENT_APP_VERSION}.`}
                {!isStoreManaged && updateStatus.status === 'checking' &&
                  'Checking for updates...'}
                {!isStoreManaged && updateStatus.status === 'available' &&
                  `Update v${updateStatus.info?.version || ''} is available!${updateStatus.info?.notes ? ` — ${updateStatus.info.notes}` : ''}`}
                {!isStoreManaged && updateStatus.status === 'not-available' &&
                  `Qikki is up to date (v${CURRENT_APP_VERSION}).`}
                {!isStoreManaged && updateStatus.status === 'downloading' &&
                  `Downloading update... ${updateStatus.progress?.percent ? Math.round(updateStatus.progress.percent) : 0}%`}
                {!isStoreManaged && updateStatus.status === 'downloaded' &&
                  `Update v${updateStatus.info?.version || ''} downloaded and ready to install.`}
                {!isStoreManaged && updateStatus.status === 'ready-to-reload' &&
                  `Update v${updateStatus.info?.version || ''} is ready. Reload to apply the latest version.`}
                {!isStoreManaged && updateStatus.status === 'error' &&
                  `Update check: ${updateStatus.message}`}
              </p>
            </div>

            {!isStoreManaged && (
              <div className="flex items-center gap-2">
                {isDesktop ? (
                  updateStatus.status === 'downloaded' ? (
                    <button
                      type="button"
                      onClick={() => void window.qikkiDesktop?.installUpdate?.()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
                    >
                      Restart &amp; Install
                    </button>
                  ) : updateStatus.status === 'available' && !preferences.autoDownloadUpdates ? (
                    <button
                      type="button"
                      onClick={() => void window.qikkiDesktop?.downloadUpdate?.()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-500"
                    >
                      Download Update
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        updateStatus.status === 'checking' ||
                        updateStatus.status === 'downloading'
                      }
                      onClick={async () => {
                        setUpdateStatus({ status: 'checking' });
                        const res = await window.qikkiDesktop?.checkForUpdates?.();
                        if (!res?.ok) {
                          setUpdateStatus({
                            status: 'error',
                            message: res?.message || 'Could not reach update server.',
                          });
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/12 bg-white/75 px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-white disabled:opacity-45 dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-100 dark:hover:bg-white/[0.14]"
                    >
                      {updateStatus.status === 'checking' ? 'Checking...' : 'Check for Updates'}
                    </button>
                  )
                ) : updateStatus.status === 'available' ||
                  updateStatus.status === 'ready-to-reload' ? (
                  <button
                    type="button"
                    onClick={() => void activateWaitingServiceWorkerAndReload()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
                  >
                    Update &amp; Reload
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={updateStatus.status === 'checking'}
                    onClick={async () => {
                      setUpdateStatus({ status: 'checking' });
                      const nextState = await checkForWebOrPwaUpdates(
                        preferences.autoDownloadUpdates
                      );
                      setUpdateStatus(nextState);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/12 bg-white/75 px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-white disabled:opacity-45 dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-100 dark:hover:bg-white/[0.14]"
                  >
                    {updateStatus.status === 'checking' ? 'Checking...' : 'Check for Updates'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. Sync & App (Cloud Account + Portable Backup) */}
      {syncSection && (
        <div id="preferences-sync" className="scroll-mt-20">
          {syncSection}
        </div>
      )}

      {/* Reset defaults helper */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onResetPreferences}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Reset local preferences to defaults</span>
        </button>
      </div>

      {/* 5. Privacy Guarantee at the end of Preferences */}
      <footer className="qikki-glass-card qikki-glass-static rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.08] px-5 py-4 text-center shadow-[0_16px_40px_-14px_rgba(16,185,129,0.18),inset_0_1.5px_0_rgba(255,255,255,0.55)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-emerald-400/25 dark:bg-emerald-500/[0.08] dark:shadow-[0_20px_48px_-14px_rgba(0,0,0,0.55),inset_0_1.5px_0_rgba(255,255,255,0.18)]">
        <div className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
          <span>Your data is not collected</span>
        </div>
        <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-100/80">
          Qikki runs zero analytics, tracking, or telemetry. Your schedules stay locally on your device unless you sign in for private cloud sync, and location access is used strictly on-device to fetch your live weather forecast.
        </p>
      </footer>

      <ProfilePictureModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        currentPhotoURL={avatarUrl}
        displayName={user?.displayName}
        email={user?.email}
        onSaveAvatar={async (url) => {
          await updateAvatar(url);
        }}
      />
    </div>
  );
};
