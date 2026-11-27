import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
} from 'motion/react';
import { Bell, Check, CheckCircle2, Cloud, LogOut, MapPin, Maximize2, Plus, Search, User } from 'lucide-react';
import type {
  PortableSyncBundle,
  Reminder,
  SyncAdapterStatus,
} from './types/reminder';
import {
  computeNextOccurrence,
  computeNextUnskippedOccurrence,
  createDefaultRecurrence,
  formatRecurrenceSummary,
  formatRelativeCountdown,
  formatScheduleDateTime,
  isDeletedExpired,
} from './utils/recurrence';
import {
  addSkippedDateForReminder,
  clearExclusionsForReminder,
  loadOccurrenceExclusions,
  saveOccurrenceExclusions,
  setStopAfterDateForReminder,
  toLocalDateKey,
  type OccurrenceExclusions,
} from './utils/occurrenceExclusions';
import { unlockAudioEngine } from './services/soundEngine';
import { VIBRATION_PRESETS } from './services/vibrationEngine';
import {
  detectDeviceOrigin,
  storageAdapter,
} from './services/storage/syncAdapter';
import {
  dispatchSystemNotification,
  getNotificationPermission,
  isDesktopApp,
  isEmbeddedIframe,
  requestNotificationPermission,
  type NotificationPermissionState,
} from './services/notificationService';
import {
  activateWaitingServiceWorkerAndReload,
  checkForWebOrPwaUpdates,
} from './services/updateService';
import {
  deleteCloudReminder,
  sanitizeCloudUserSettings,
  saveCloudUserSettings,
  subscribeCloudReminders,
  subscribeCloudUserSettings,
  syncLocalAndCloudReminders,
  upsertCloudReminder,
  type CloudUserSettings,
} from './services/firebase';
import { useAuth } from './contexts/AuthContext';
import { useTheme, type ThemeMode } from './hooks/useTheme';
import { useAppPreferences } from './hooks/useAppPreferences';
import { useWeatherForecast } from './hooks/useWeatherForecast';
import { useLocalizedHolidays } from './hooks/useLocalizedHolidays';
import { TopBar, type NavTab } from './components/TopBar';
import { BottomDock } from './components/BottomDock';
import { WelcomeGreetingCard } from './components/WelcomeGreetingCard';
import { ReminderList } from './components/ReminderList';
import { RecentlyDeletedList } from './components/RecentlyDeletedList';
import {
  createEmptyDraft,
  ReminderComposer,
  reminderToDraft,
  type ComposerDraft,
} from './components/ReminderComposer';
import { AlertPopupModal } from './components/AlertPopupModal';
import { SyncAndAppView } from './components/SyncAndAppView';
import { PreferencesView } from './components/PreferencesView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AmbientDarkBackdrop } from './components/AmbientDarkBackdrop';
import { MonthCalendarView } from './components/MonthCalendarView';
import { AuthModal } from './components/AuthModal';
import { QikkiStartupSplash } from './components/QikkiStartupSplash';
import { UserAvatar } from './components/UserAvatar';
import { ProfilePictureModal } from './components/ProfilePictureModal';
import {
  EventContextMenu,
  type EventContextMenuState,
} from './components/EventContextMenu';

const centerPopVariants = {
  enter: {
    scale: 0.976,
    y: 12,
  },
  center: {
    scale: 1,
    y: 0,
    transition: {
      duration: 0.44,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
  exit: {
    scale: 0.986,
    y: -6,
    transition: {
      duration: 0.18,
      ease: [0.4, 0, 1, 1] as const,
    },
  },
};

const SEEDED_KEY = 'cadence_seeded_v1';
const SEEDED_UNTOUCHED_KEY = 'cadence_seeded_untouched_v1';
const SEED_IDS_SET = new Set([
  'seed-focus-stretch',
  'seed-weekly-sync',
  'seed-monthly-invoice',
]);

function createSeedReminders(): Reminder[] {
  const now = new Date();
  const in25m = new Date(now.getTime() + 25 * 60000);
  in25m.setSeconds(0, 0);

  const mondayMorning = new Date(now);
  mondayMorning.setDate(now.getDate() + ((1 - now.getDay() + 7) % 7 || 7));
  mondayMorning.setHours(9, 30, 0, 0);

  const monthlyBill = new Date(now.getFullYear(), now.getMonth(), 28, 18, 0, 0, 0);
  if (monthlyBill.getTime() <= now.getTime()) {
    monthlyBill.setMonth(monthlyBill.getMonth() + 1);
  }

  const createdIso = now.toISOString();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const device = detectDeviceOrigin();

  return [
    {
      id: 'seed-focus-stretch',
      title: 'Posture & hydration break',
      notes: 'Step away from the desk for 3 minutes and refill water.',
      triggerAt: in25m.toISOString(),
      timezone: tz,
      recurrence: createDefaultRecurrence(in25m),
      sound: { presetId: 'crystal-chime', volume: 0.85, repeatCount: 1 },
      vibration: { ...VIBRATION_PRESETS[0] },
      status: 'active',
      snoozedUntil: null,
      lastTriggeredAt: null,
      completedCount: 0,
      createdAt: createdIso,
      updatedAt: createdIso,
      syncVersion: 1,
      deviceOrigin: device,
      deletedAt: null,
      expiresAt: null,
    },
    {
      id: 'seed-weekly-sync',
      title: 'Weekly planning & inbox zero',
      notes: 'Review weekly goals and clear pending action items.',
      triggerAt: mondayMorning.toISOString(),
      timezone: tz,
      recurrence: {
        ...createDefaultRecurrence(mondayMorning),
        frequency: 'weekly',
        interval: 1,
        weekdays: [1, 4],
        targetCount: 8,
      },
      sound: { presetId: 'beacon-tone', volume: 0.85, repeatCount: 2 },
      vibration: { ...VIBRATION_PRESETS[2] },
      status: 'active',
      snoozedUntil: null,
      lastTriggeredAt: null,
      completedCount: 2,
      createdAt: createdIso,
      updatedAt: createdIso,
      syncVersion: 1,
      deviceOrigin: device,
      deletedAt: null,
      expiresAt: null,
    },
    {
      id: 'seed-monthly-invoice',
      title: 'Monthly utility & subscription review',
      notes: 'Check recurring charges before statement close.',
      triggerAt: monthlyBill.toISOString(),
      timezone: tz,
      recurrence: {
        ...createDefaultRecurrence(monthlyBill),
        frequency: 'monthly',
        interval: 1,
        monthlyMode: 'day-of-month',
        dayOfMonth: 28,
        targetCount: 12,
      },
      sound: { presetId: 'zen-gong', volume: 0.9, repeatCount: 1 },
      vibration: { ...VIBRATION_PRESETS[3] },
      status: 'active',
      snoozedUntil: null,
      lastTriggeredAt: null,
      completedCount: 1,
      createdAt: createdIso,
      updatedAt: createdIso,
      syncVersion: 1,
      deviceOrigin: device,
      deletedAt: null,
      expiresAt: null,
    },
  ];
}

export default function App() {
  const {
    user,
    avatarUrl,
    authReady,
    isSigningIn,
    isDeletingAccount,
    authError,
    needsNewTabForAuth,
    signOut,
    updateAvatar,
  } = useAuth();
  const {
    appTheme,
    setAppTheme,
    notificationTheme,
    setNotificationTheme,
    resolvedNotificationTheme,
  } = useTheme();
  const {
    preferences,
    updatePreferences,
    updateAutoDownloadUpdates,
    applyCloudPreferences,
    resetPreferences,
    desktopPrefs,
    desktopPrefsLoaded,
    updateDesktopStartupPrefs,
  } = useAppPreferences();
  const {
    status: weatherStatus,
    forecast: weatherForecast,
    weatherLocation,
    errorMessage: weatherError,
    shouldPromptUser: shouldPromptWeatherLocation,
    requestLocationAndForecast,
    refreshForecast,
    setManualCity,
    dismissLocationPrompt,
    disableLocationWeather,
    applyCloudWeatherLocation,
  } = useWeatherForecast();
  const [initialSnap] = useState(() => storageAdapter.loadSnapshotSync());
  const [reminders, setReminders] = useState<Reminder[]>(() => initialSnap?.active ?? []);
  const [deletedReminders, setDeletedReminders] = useState<Reminder[]>(
    () => initialSnap?.deleted ?? []
  );
  const [isLoaded, setIsLoaded] = useState(() => initialSnap !== null);
  const [splashMinElapsed, setSplashMinElapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSplashMinElapsed(true);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);

  const showSplash = !isLoaded || !splashMinElapsed;

  const [activeTab, setActiveTab] = useState<NavTab>('upcoming');
  const [historySubView, setHistorySubView] = useState<'completed' | 'deleted'>('completed');
  const [occurrenceExclusions, setOccurrenceExclusions] = useState<OccurrenceExclusions>(
    () => loadOccurrenceExclusions()
  );
  const [contextMenu, setContextMenu] = useState<EventContextMenuState | null>(null);
  const [webMinimized, setWebMinimized] = useState(
    () => !isDesktopApp() && preferences.webStartMinimized
  );
  const [webExpanded, setWebExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);

  const visibleHolidayYears = useMemo(() => {
    const years = [calendarYear];
    if (calendarMonth === 0) years.push(calendarYear - 1);
    if (calendarMonth === 11) years.push(calendarYear + 1);
    return years;
  }, [calendarYear, calendarMonth]);

  const {
    detectedCountryCode: holidayDetectedCountryCode,
    detectedCountryName: holidayDetectedCountryName,
    effectiveCountryCode: holidayEffectiveCountryCode,
    effectiveCountryName: holidayEffectiveCountryName,
    holidaysByDate,
    todayHoliday,
    availableCountries: holidayCountries,
    loadedHolidayCount: holidayCount,
    loading: holidaysLoading,
    error: holidaysError,
    lastUpdatedAt: holidaysLastUpdatedAt,
    refreshHolidays,
  } = useLocalizedHolidays({
    enabled: preferences.showHolidays,
    countryPreference: preferences.holidayCountryCode,
    weatherCountryCode:
      weatherForecast?.countryCode ?? weatherLocation?.countryCode ?? null,
    visibleYears: visibleHolidayYears,
  });

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDraft, setComposerDraft] = useState<ComposerDraft | null>(null);

  const [alertQueue, setAlertQueue] = useState<Reminder[]>([]);
  const [isTestPreview, setIsTestPreview] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  const [notifPerm, setNotifPerm] = useState<NotificationPermissionState>(() =>
    getNotificationPermission()
  );
  const [dismissedNotifPrompt, setDismissedNotifPrompt] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncAdapterStatus>(() =>
    storageAdapter.getStatus()
  );
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [actionToast, setActionToast] = useState<{
    id: string;
    message: string;
    undoReminder?: Reminder;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const lastWebUpdateCheckRef = useRef<number>(0);

  const [congratsPopup, setCongratsPopup] = useState<{
    title: string;
    isRecurring: boolean;
    nextDateLabel?: string;
    count: number;
  } | null>(null);
  const congratsTimerRef = useRef<number | null>(null);

  const handleSelectTab = useCallback((nextTab: NavTab) => {
    setActiveTab((prevTab) => {
      if (prevTab === nextTab) return prevTab;
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
      return nextTab;
    });
  }, []);

  const handleOpenSyncPreferences = useCallback(() => {
    setActiveTab('preferences');
    window.setTimeout(() => {
      document.getElementById('preferences-sync')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 260);
  }, []);

  // Completely prevent text selection globally across the interface while keeping form inputs selectable
  useEffect(() => {
    const isInputElement = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      return Boolean(
        target.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')
      );
    };

    const handleSelectStart = (e: Event) => {
      if (isInputElement(e.target)) return;
      e.preventDefault();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        sel.removeAllRanges();
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!isInputElement(e.target)) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          sel.removeAllRanges();
        }
      }
    };

    document.addEventListener('selectstart', handleSelectStart, { capture: true });
    document.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true });
    return () => {
      document.removeEventListener('selectstart', handleSelectStart, { capture: true });
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    };
  }, []);

  // Subtle liquid-glass edge glow around any card when clicked (cursor-tracking when held on non-touch devices)
  useEffect(() => {
    const isTouchDevice =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
    if (isTouchDevice) return;

    const timers = new WeakMap<HTMLElement, number>();
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const card = target?.closest('.qikki-glass-card') as HTMLElement | null;
      if (!card) return;

      const updatePos = (clientX: number, clientY: number) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--qikki-gx', `${Math.round(clientX - rect.left)}px`);
        card.style.setProperty('--qikki-gy', `${Math.round(clientY - rect.top)}px`);
      };

      updatePos(e.clientX, e.clientY);

      const prevTimer = timers.get(card);
      if (prevTimer !== undefined) {
        window.clearTimeout(prevTimer);
      }

      card.classList.remove('qikki-card-clicked');
      card.classList.add('qikki-card-holding');

      const onPointerMove = (moveEvent: PointerEvent) => {
        updatePos(moveEvent.clientX, moveEvent.clientY);
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);

        card.classList.remove('qikki-card-holding');
        card.classList.remove('qikki-card-clicked');
        requestAnimationFrame(() => {
          card.classList.add('qikki-card-clicked');
        });

        const timer = window.setTimeout(() => {
          card.classList.remove('qikki-card-clicked');
          timers.delete(card);
        }, 580);
        timers.set(card, timer);
      };

      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp, { passive: true });
      window.addEventListener('pointercancel', onPointerUp, { passive: true });
    };

    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  const showToast = useCallback(
    (
      message: string,
      undoReminder?: Reminder,
      action?: { label: string; onClick: () => void }
    ) => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      setActionToast({
        id: `${Date.now()}`,
        message,
        undoReminder,
        actionLabel: action?.label,
        onAction: action?.onClick,
      });
      toastTimerRef.current = window.setTimeout(() => {
        setActionToast(null);
        toastTimerRef.current = null;
      }, action ? 8000 : 4200);
    },
    []
  );

  // Automatic Web / iOS PWA & Desktop update checks and notifications
  useEffect(() => {
    if (isDesktopApp()) {
      const handleDesktopUpdate = (obj: {
        status: string;
        info?: { version?: string };
      }) => {
        if (obj.status === 'downloaded') {
          const ver = obj.info?.version ? ` v${obj.info.version}` : '';
          showToast(`Qikki${ver} downloaded and ready to install`, undefined, {
            label: 'Restart & Install',
            onClick: () => {
              void window.qikkiDesktop?.installUpdate?.();
            },
          });
        } else if (obj.status === 'available' && !preferences.autoDownloadUpdates) {
          const ver = obj.info?.version ? ` v${obj.info.version}` : '';
          showToast(`Qikki${ver} update is available`, undefined, {
            label: 'Download',
            onClick: () => {
              void window.qikkiDesktop?.downloadUpdate?.();
            },
          });
        }
      };

      void window.qikkiDesktop?.getUpdateStatus?.().then((initial) => {
        if (initial && initial.status === 'downloaded') {
          handleDesktopUpdate(initial);
        }
      }).catch(() => {});

      const unsub = window.qikkiDesktop?.onUpdateStatus?.(handleDesktopUpdate);
      return () => {
        unsub?.();
      };
    }

    if (import.meta.env.DEV) {
      return;
    }

    const runCheck = async () => {
      const now = Date.now();
      if (now - lastWebUpdateCheckRef.current < 5 * 60 * 1000) return;
      lastWebUpdateCheckRef.current = now;
      const res = await checkForWebOrPwaUpdates(preferences.autoDownloadUpdates);
      if (res.status === 'ready-to-reload') {
        void activateWaitingServiceWorkerAndReload();
        return;
      }
      if (res.status === 'available') {
        const ver = res.info?.version ? ` v${res.info.version}` : '';
        showToast(`Qikki${ver} update is ready`, undefined, {
          label: 'Update & Reload',
          onClick: () => {
            void activateWaitingServiceWorkerAndReload();
          },
        });
      }
    };

    const bootTimer = window.setTimeout(() => {
      void runCheck();
    }, 6500);

    const periodicTimer = window.setInterval(() => {
      void runCheck();
    }, 15 * 60 * 1000);

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void runCheck();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.clearTimeout(bootTimer);
      window.clearInterval(periodicTimer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [preferences.autoDownloadUpdates, showToast]);

  const currentCloudSettings = useMemo<CloudUserSettings>(
    () =>
      sanitizeCloudUserSettings({
        appTheme,
        notificationTheme,
        clockFormat: preferences.clockFormat,
        accentColor: preferences.accentColor,
        uiTransparency: preferences.uiTransparency,
        defaultSoundPreset: preferences.defaultSoundPreset,
        defaultSoundVolume: preferences.defaultSoundVolume,
        defaultSnoozeMinutes: preferences.defaultSnoozeMinutes,
        defaultVibrationPresetId: preferences.defaultVibrationPresetId,
        temperatureUnit: preferences.temperatureUnit,
        showHeaderWeather: preferences.showHeaderWeather,
        weatherLocation: weatherLocation
          ? {
              latitude: weatherLocation.latitude,
              longitude: weatherLocation.longitude,
              locationName: weatherLocation.locationName || '',
              regionLabel: weatherLocation.regionLabel || '',
              source: weatherLocation.source,
            }
          : null,
        launchAtStartup: isDesktopApp()
          ? desktopPrefs.launchAtStartup
          : preferences.webStartupPreference,
        startMinimized: isDesktopApp()
          ? desktopPrefs.startMinimized
          : preferences.webStartMinimized,
        minimizeToTray: isDesktopApp()
          ? desktopPrefs.minimizeToTray
          : preferences.webMinimizeToTray,
        autoDownloadUpdates: preferences.autoDownloadUpdates,
        showHolidays: preferences.showHolidays,
        holidayCountryCode: preferences.holidayCountryCode,
      }),
    [appTheme, notificationTheme, preferences, desktopPrefs, weatherLocation]
  );

  const latestSettingsRef = useRef<CloudUserSettings>(currentCloudSettings);
  latestSettingsRef.current = currentCloudSettings;
  const hydratedSettingsUidRef = useRef<string | null>(null);
  const lastSyncedSettingsHashRef = useRef<string>('');

  const handleChangeAppTheme = useCallback(
    (nextTheme: ThemeMode) => {
      setAppTheme(nextTheme);
    },
    [setAppTheme]
  );

  const handleChangeNotificationTheme = useCallback(
    (nextPref: 'match' | 'light' | 'dark') => {
      setNotificationTheme(nextPref);
    },
    [setNotificationTheme]
  );

  // Unlock Web Audio on first user interaction anywhere in the window
  useEffect(() => {
    const unlock = () => {
      unlockAudioEngine();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Load initial data from IndexedDB / localStorage and purge expired deleted schedules
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { active, deleted } = await storageAdapter.loadAllWithDeleted();
      if (!mounted) return;
      if (active.length === 0 && deleted.length === 0 && !localStorage.getItem(SEEDED_KEY)) {
        const seeded = createSeedReminders();
        await storageAdapter.saveAll(seeded);
        localStorage.setItem(SEEDED_KEY, '1');
        localStorage.setItem(SEEDED_UNTOUCHED_KEY, '1');
        if (mounted) {
          setReminders(seeded);
          setDeletedReminders([]);
        }
      } else {
        localStorage.setItem(SEEDED_KEY, '1');
        setReminders(active);
        setDeletedReminders(deleted);
      }
      setIsLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const runCloudSyncMerge = useCallback(
    async (uid: string) => {
      setIsCloudSyncing(true);
      try {
        const localAll = await storageAdapter.loadAllRaw();
        const purgedIds = storageAdapter.getPurgedIds();
        const hasUntouchedSeeds =
          typeof localStorage !== 'undefined' &&
          localStorage.getItem(SEEDED_UNTOUCHED_KEY) === '1';
        const mergedAll = await syncLocalAndCloudReminders(
          uid,
          localAll,
          purgedIds,
          detectDeviceOrigin(),
          hasUntouchedSeeds ? { skipUntouchedSeedIds: SEED_IDS_SET } : undefined
        );
        const split = await storageAdapter.writeCloudMirror(mergedAll);
        storageAdapter.clearPurgedIds();
        localStorage.removeItem(SEEDED_UNTOUCHED_KEY);
        setReminders(split.active);
        setDeletedReminders(split.deleted);
        const nowIso = new Date().toISOString();
        setSyncStatus(
          storageAdapter.updateSyncConfig({
            provider: 'firebase-cloud',
            connected: true,
            lastSyncedAt: nowIso,
            pendingChanges: 0,
          })
        );
        return {
          ok: true,
          message: 'Cloud Firestore and local IndexedDB are synchronized.',
        };
      } catch (err) {
        console.error('Cloud sync merge error:', err);
        return {
          ok: false,
          message: 'Could not sync with cloud right now. Changes remain stored locally.',
        };
      } finally {
        setIsCloudSyncing(false);
      }
    },
    []
  );

  // Real-time Cloud Firestore sync when signed in; local quiet REST sync when signed out
  useEffect(() => {
    if (!isLoaded || !authReady || isDeletingAccount) return;

    if (!user) {
      hydratedSettingsUidRef.current = null;
      lastSyncedSettingsHashRef.current = '';
      const stopQuietSync = storageAdapter.startQuietBackgroundSync(
        (mergedActive, mergedDeleted) => {
          setReminders(mergedActive);
          setDeletedReminders(mergedDeleted);
        }
      );
      return stopQuietSync;
    }

    let active = true;
    let initialMergeDone = false;
    hydratedSettingsUidRef.current = null;

    void runCloudSyncMerge(user.uid).then(() => {
      initialMergeDone = true;
    });

    const unsubReminders = subscribeCloudReminders(user.uid, (cloudAll) => {
      if (!active || !initialMergeDone) return;
      void storageAdapter.writeCloudMirror(cloudAll).then((split) => {
        if (!active) return;
        setReminders(split.active);
        setDeletedReminders(split.deleted);
        setSyncStatus(
          storageAdapter.updateSyncConfig({
            provider: 'firebase-cloud',
            connected: true,
            lastSyncedAt: new Date().toISOString(),
            pendingChanges: 0,
          })
        );
      });
    });

    const unsubPrefs = subscribeCloudUserSettings(user.uid, (snapshot) => {
      if (!active) return;

      if (!snapshot.exists) {
        const localSettings = latestSettingsRef.current;
        const hash = JSON.stringify(localSettings);
        hydratedSettingsUidRef.current = user.uid;
        lastSyncedSettingsHashRef.current = hash;
        void saveCloudUserSettings(user.uid, localSettings).catch((err) =>
          console.error('Initial cloud settings upload failed:', err)
        );
        return;
      }

      if (!snapshot.isCompleteSchema) {
        const merged = sanitizeCloudUserSettings({
          ...latestSettingsRef.current,
          ...(snapshot.legacyAppearance ?? {}),
        });
        const hash = JSON.stringify(merged);
        hydratedSettingsUidRef.current = user.uid;
        lastSyncedSettingsHashRef.current = hash;
        setAppTheme(merged.appTheme);
        setNotificationTheme(merged.notificationTheme);
        void saveCloudUserSettings(user.uid, merged).catch((err) =>
          console.error('Cloud settings schema upgrade failed:', err)
        );
        return;
      }

      if (snapshot.settings) {
        const cloudSettings = snapshot.settings;
        const cloudHash = JSON.stringify(cloudSettings);
        hydratedSettingsUidRef.current = user.uid;
        if (cloudHash !== lastSyncedSettingsHashRef.current) {
          lastSyncedSettingsHashRef.current = cloudHash;
          setAppTheme(cloudSettings.appTheme);
          setNotificationTheme(cloudSettings.notificationTheme);
          applyCloudPreferences(cloudSettings);
          applyCloudWeatherLocation(cloudSettings.weatherLocation);
        }
      }
    });

    return () => {
      active = false;
      unsubReminders();
      unsubPrefs();
    };
  }, [
    isLoaded,
    authReady,
    isDeletingAccount,
    user,
    runCloudSyncMerge,
    setAppTheme,
    setNotificationTheme,
    applyCloudPreferences,
    applyCloudWeatherLocation,
  ]);

  // Debounced auto-save whenever any setting or customization changes while signed in
  useEffect(() => {
    if (
      !user ||
      !authReady ||
      isDeletingAccount ||
      !desktopPrefsLoaded ||
      hydratedSettingsUidRef.current !== user.uid
    ) {
      return;
    }

    const nextHash = JSON.stringify(currentCloudSettings);
    if (nextHash === lastSyncedSettingsHashRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      lastSyncedSettingsHashRef.current = nextHash;
      void saveCloudUserSettings(user.uid, currentCloudSettings)
        .then(() => {
          setSyncStatus((prev) =>
            prev.connected
              ? { ...prev, lastSyncedAt: new Date().toISOString() }
              : prev
          );
        })
        .catch((err) => console.error('Cloud settings sync failed:', err));
    }, 380);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentCloudSettings, user, authReady, isDeletingAccount, desktopPrefsLoaded]);

  const persistReminders = useCallback(async (nextList: Reminder[]) => {
    try {
      localStorage.removeItem(SEEDED_UNTOUCHED_KEY);
    } catch {
      // Ignore storage errors
    }
    setReminders(nextList);
    await storageAdapter.saveAll(nextList);
  }, []);

  // Live clock + due reminder trigger engine + 7-day deletion expiration check
  const remindersRef = useRef<Reminder[]>(reminders);
  remindersRef.current = reminders;
  const deletedRef = useRef<Reminder[]>(deletedReminders);
  deletedRef.current = deletedReminders;

  const checkDueReminders = useCallback(() => {
    const currentMs = Date.now();
    setNowMs(currentMs);

    // Automatically clear any recently deleted schedules whose 7-day retention expired
    if (
      deletedRef.current.some((d) =>
        isDeletedExpired(d.deletedAt, d.expiresAt, currentMs)
      )
    ) {
      void storageAdapter.purgeExpiredLocal().then(({ active, deleted }) => {
        setReminders(active);
        setDeletedReminders(deleted);
      });
    }

    const list = remindersRef.current;
    if (list.length === 0) return;

    const dueItems: Reminder[] = [];
    let changed = false;

    const updated = list.map((item) => {
      if (item.status === 'completed') return item;
      const effectiveIso =
        item.status === 'snoozed' && item.snoozedUntil
          ? item.snoozedUntil
          : item.triggerAt;
      const triggerMs = new Date(effectiveIso).getTime();

      if (
        !Number.isNaN(triggerMs) &&
        triggerMs <= currentMs &&
        item.lastTriggeredAt !== effectiveIso
      ) {
        changed = true;
        const fired: Reminder = {
          ...item,
          lastTriggeredAt: effectiveIso,
          updatedAt: new Date(currentMs).toISOString(),
        };
        dueItems.push(fired);
        return fired;
      }
      return item;
    });

    if (changed && dueItems.length > 0) {
      void persistReminders(updated);
      if (user) {
        const device = detectDeviceOrigin();
        dueItems.forEach((fired) => {
          void upsertCloudReminder(user.uid, fired, device).catch((err) =>
            console.error('Cloud trigger update failed:', err)
          );
        });
      }
      setIsTestPreview(false);
      setAlertQueue((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const additions = dueItems.filter((d) => !existingIds.has(d.id));
        return [...prev, ...additions];
      });
      dueItems.forEach((due) => {
        dispatchSystemNotification(due);
      });
    }
  }, [persistReminders, user]);

  useEffect(() => {
    const timer = window.setInterval(checkDueReminders, 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setNotifPerm(getNotificationPermission());
        checkDueReminders();
      }
    };
    const onFocus = () => {
      setNotifPerm(getNotificationPermission());
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [checkDueReminders]);

  // CRUD & Alert Actions

  const handleSaveComposer = async (draft: ComposerDraft) => {
    unlockAudioEngine();
    const nowIso = new Date().toISOString();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const device = detectDeviceOrigin();
    const currentList = remindersRef.current;

    try {
      if (draft.id) {
        let updatedTarget: Reminder | null = null;
        const nextList = currentList.map((item) => {
          if (item.id !== draft.id) return item;
          updatedTarget = {
            ...item,
            title: draft.title,
            notes: draft.notes,
            location: draft.location?.trim() || undefined,
            triggerAt: draft.triggerAt,
            timezone: tz,
            recurrence: draft.recurrence,
            sound: draft.sound,
            vibration: draft.vibration,
            status: 'active' as const,
            snoozedUntil: null,
            lastTriggeredAt: null,
            updatedAt: nowIso,
            syncVersion: item.syncVersion + 1,
            deviceOrigin: device,
          };
          return updatedTarget;
        });
        await persistReminders(nextList);
        if (user && updatedTarget) {
          void upsertCloudReminder(user.uid, updatedTarget, device).catch((err) =>
            console.error('Cloud update failed:', err)
          );
        }
        showToast(`Updated "${draft.title}"`);
      } else {
        const created: Reminder = {
          id:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `rem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: draft.title,
          notes: draft.notes,
          location: draft.location?.trim() || undefined,
          triggerAt: draft.triggerAt,
          timezone: tz,
          recurrence: draft.recurrence,
          sound: draft.sound,
          vibration: draft.vibration,
          status: 'active',
          snoozedUntil: null,
          lastTriggeredAt: null,
          completedCount: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
          syncVersion: 1,
          deviceOrigin: device,
          deletedAt: null,
          expiresAt: null,
        };
        await persistReminders([created, ...currentList]);
        if (user) {
          void upsertCloudReminder(user.uid, created, device).catch((err) =>
            console.error('Cloud create failed:', err)
          );
        }
        showToast(`Scheduled "${created.title}"`);
      }
    } finally {
      setComposerOpen(false);
      setComposerDraft(null);
    }
  };

  const handleCompleteReminder = async (target: Reminder) => {
    if (isTestPreview) {
      setAlertQueue((prev) => prev.filter((r) => r.id !== target.id));
      setIsTestPreview(false);
      return;
    }

    const liveItem = remindersRef.current.find((item) => item.id === target.id);
    if (!liveItem || liveItem.status === 'completed') {
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const isRecurring = target.recurrence.frequency !== 'none';
    const device = detectDeviceOrigin();
    let updatedItem = null as Reminder | null;

    const nextList = remindersRef.current.map((item) => {
      if (item.id !== target.id) return item;
      const nextCompletedCount = item.completedCount + 1;

      if (isRecurring) {
        const targetCount = item.recurrence.targetCount;
        const reachedTarget =
          typeof targetCount === 'number' &&
          targetCount > 0 &&
          nextCompletedCount >= targetCount;

        if (!reachedTarget) {
          const triggerMs = new Date(item.triggerAt).getTime();
          const snoozeMs = item.snoozedUntil
            ? new Date(item.snoozedUntil).getTime()
            : 0;
          const advanceAfter = new Date(
            Math.max(
              now.getTime(),
              Number.isNaN(triggerMs) ? 0 : triggerMs,
              Number.isNaN(snoozeMs) ? 0 : snoozeMs
            )
          );

          const nextOcc = computeNextUnskippedOccurrence(
            item.id,
            item.triggerAt,
            item.recurrence,
            advanceAfter,
            occurrenceExclusions
          );

          if (nextOcc) {
            updatedItem = {
              ...item,
              triggerAt: nextOcc.toISOString(),
              status: 'active' as const,
              snoozedUntil: null,
              lastTriggeredAt: null,
              completedCount: nextCompletedCount,
              updatedAt: nowIso,
              syncVersion: item.syncVersion + 1,
              deviceOrigin: device,
            };
            return updatedItem;
          }
        }
      }

      updatedItem = {
        ...item,
        status: 'completed' as const,
        snoozedUntil: null,
        completedCount: nextCompletedCount,
        updatedAt: nowIso,
        syncVersion: item.syncVersion + 1,
        deviceOrigin: device,
      };
      return updatedItem;
    });

    await persistReminders(nextList);
    if (user && updatedItem) {
      void upsertCloudReminder(user.uid, updatedItem, device).catch((err) =>
        console.error('Cloud complete sync failed:', err)
      );
    }
    setAlertQueue((prev) => prev.filter((r) => r.id !== target.id));

    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setActionToast(null);

    const didAdvanceRecurring =
      isRecurring && updatedItem !== null && updatedItem.status !== 'completed';
    const nextDateLabel =
      didAdvanceRecurring && updatedItem
        ? formatScheduleDateTime(updatedItem.triggerAt)
        : undefined;
    setCongratsPopup((prev) => ({
      title: target.title,
      isRecurring: didAdvanceRecurring,
      nextDateLabel,
      count: prev ? prev.count + 1 : 1,
    }));
    if (congratsTimerRef.current !== null) {
      window.clearTimeout(congratsTimerRef.current);
    }
    congratsTimerRef.current = window.setTimeout(() => {
      setCongratsPopup(null);
      congratsTimerRef.current = null;
    }, 4200);
  };

  const handleReactivateReminder = async (target: Reminder) => {
    const now = new Date();
    const device = detectDeviceOrigin();
    const nextTrigger =
      new Date(target.triggerAt).getTime() <= now.getTime()
        ? new Date(now.getTime() + 60 * 60000).toISOString()
        : target.triggerAt;

    let updatedItem: Reminder | null = null;
    const nextList = remindersRef.current.map((item) => {
      if (item.id !== target.id) return item;
      updatedItem = {
        ...item,
        triggerAt: nextTrigger,
        status: 'active' as const,
        snoozedUntil: null,
        lastTriggeredAt: null,
        updatedAt: now.toISOString(),
        syncVersion: item.syncVersion + 1,
        deviceOrigin: device,
      };
      return updatedItem;
    });
    await persistReminders(nextList);
    if (user && updatedItem) {
      void upsertCloudReminder(user.uid, updatedItem, device).catch((err) =>
        console.error('Cloud reactivate sync failed:', err)
      );
    }
  };

  const handleSnoozeReminder = async (target: Reminder, minutes: number) => {
    const snoozeIso = new Date(Date.now() + minutes * 60000).toISOString();
    const nowIso = new Date().toISOString();
    const device = detectDeviceOrigin();

    let updatedItem: Reminder | null = null;
    const nextList = remindersRef.current.map((item) => {
      if (item.id !== target.id) return item;
      updatedItem = {
        ...item,
        status: 'snoozed' as const,
        snoozedUntil: snoozeIso,
        lastTriggeredAt: null,
        updatedAt: nowIso,
        syncVersion: item.syncVersion + 1,
        deviceOrigin: device,
      };
      return updatedItem;
    });
    await persistReminders(nextList);
    if (user && updatedItem) {
      void upsertCloudReminder(user.uid, updatedItem, device).catch((err) =>
        console.error('Cloud snooze sync failed:', err)
      );
    }
    setAlertQueue((prev) => prev.filter((r) => r.id !== target.id));
    showToast(`Snoozed "${target.title}" for ${minutes >= 60 ? '1 hour' : `${minutes}m`}`);
  };

  const handleDismissAlert = (target: Reminder) => {
    setAlertQueue((prev) => prev.filter((r) => r.id !== target.id));
    setIsTestPreview(false);
  };

  const handleDeleteReminder = async (target: Reminder) => {
    try {
      localStorage.removeItem(SEEDED_UNTOUCHED_KEY);
    } catch {
      // Ignore storage errors
    }
    const deletedItem = await storageAdapter.softDelete(target.id);
    setReminders((prev) => prev.filter((r) => r.id !== target.id));
    setAlertQueue((prev) => prev.filter((r) => r.id !== target.id));
    if (deletedItem) {
      setDeletedReminders((prev) => [
        deletedItem,
        ...prev.filter((d) => d.id !== deletedItem.id),
      ]);
      if (user) {
        void upsertCloudReminder(user.uid, deletedItem, detectDeviceOrigin()).catch(
          (err) => console.error('Cloud soft-delete sync failed:', err)
        );
      }
      showToast(`Moved "${target.title}" to Recently Deleted`, deletedItem);
    }
  };

  const handleDeleteSingleEvent = async (
    target: Reminder,
    occurrenceDate?: Date,
    isProjected?: boolean
  ) => {
    if (target.recurrence.frequency === 'none') {
      await handleDeleteReminder(target);
      return;
    }

    const effectiveDate = new Date(target.snoozedUntil || target.triggerAt);
    const sameCalendarDay =
      occurrenceDate && !Number.isNaN(effectiveDate.getTime())
        ? toLocalDateKey(occurrenceDate) === toLocalDateKey(effectiveDate)
        : false;

    if (occurrenceDate && isProjected && !sameCalendarDay) {
      const nextExclusions = addSkippedDateForReminder(
        occurrenceExclusions,
        target.id,
        occurrenceDate
      );
      setOccurrenceExclusions(nextExclusions);
      saveOccurrenceExclusions(nextExclusions);
      showToast(
        `Removed "${target.title}" on ${occurrenceDate.toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
        })}`
      );
      return;
    }

    const afterDate = new Date(
      Math.max(
        Date.now(),
        Number.isNaN(effectiveDate.getTime()) ? Date.now() : effectiveDate.getTime()
      )
    );
    const nextOcc = computeNextUnskippedOccurrence(
      target.id,
      target.triggerAt,
      target.recurrence,
      afterDate,
      occurrenceExclusions
    );

    if (!nextOcc) {
      await handleDeleteReminder(target);
      return;
    }

    const nowIso = new Date().toISOString();
    const device = detectDeviceOrigin();
    let updatedItem: Reminder | null = null;
    const nextList = remindersRef.current.map((item) => {
      if (item.id !== target.id) return item;
      updatedItem = {
        ...item,
        triggerAt: nextOcc.toISOString(),
        status: 'active' as const,
        snoozedUntil: null,
        lastTriggeredAt: null,
        updatedAt: nowIso,
        syncVersion: item.syncVersion + 1,
        deviceOrigin: device,
      };
      return updatedItem;
    });

    await persistReminders(nextList);
    if (user && updatedItem) {
      void upsertCloudReminder(user.uid, updatedItem, device).catch((err) =>
        console.error('Cloud single-occurrence delete sync failed:', err)
      );
    }
    setAlertQueue((prev) => prev.filter((r) => r.id !== target.id));
    showToast(
      `Deleted occurrence · Next "${target.title}" on ${formatScheduleDateTime(
        nextOcc.toISOString()
      )}`
    );
  };

  const handleDeleteRepeatingUpcomingEvent = async (
    target: Reminder,
    occurrenceDate?: Date,
    isProjected?: boolean
  ) => {
    if (target.recurrence.frequency === 'none') {
      await handleDeleteReminder(target);
      return;
    }

    const effectiveDate = new Date(target.snoozedUntil || target.triggerAt);
    const isStrictlyLaterProjected =
      Boolean(occurrenceDate && isProjected) &&
      !Number.isNaN(effectiveDate.getTime()) &&
      occurrenceDate !== undefined &&
      toLocalDateKey(occurrenceDate) > toLocalDateKey(effectiveDate);

    if (isStrictlyLaterProjected && occurrenceDate) {
      const nextExclusions = setStopAfterDateForReminder(
        occurrenceExclusions,
        target.id,
        occurrenceDate
      );
      setOccurrenceExclusions(nextExclusions);
      saveOccurrenceExclusions(nextExclusions);
      showToast(
        `Deleted "${target.title}" from ${occurrenceDate.toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
        })} onward`
      );
      return;
    }

    await handleDeleteReminder(target);
  };

  const handleRestoreDeleted = async (target: Reminder) => {
    const { active, deleted } = await storageAdapter.restoreDeleted(target.id);
    setReminders(active);
    setDeletedReminders(deleted);
    if (user) {
      const restored = active.find((r) => r.id === target.id);
      if (restored) {
        void upsertCloudReminder(user.uid, restored, detectDeviceOrigin()).catch(
          (err) => console.error('Cloud restore sync failed:', err)
        );
      }
    }
    showToast(`Restored "${target.title}"`);
  };

  const handlePermanentDelete = async (target: Reminder) => {
    const { active, deleted } = await storageAdapter.permanentlyDelete(target.id);
    setReminders(active);
    setDeletedReminders(deleted);
    const nextExclusions = clearExclusionsForReminder(occurrenceExclusions, target.id);
    if (nextExclusions !== occurrenceExclusions) {
      setOccurrenceExclusions(nextExclusions);
      saveOccurrenceExclusions(nextExclusions);
    }
    if (user) {
      void deleteCloudReminder(user.uid, target.id).catch((err) =>
        console.error('Cloud permanent delete failed:', err)
      );
    }
    showToast(`Permanently deleted "${target.title}"`);
  };

  const handleClearAllDeleted = async () => {
    const idsToPurge = deletedRef.current.map((d) => d.id);
    const { active, deleted } = await storageAdapter.clearAllDeleted();
    setReminders(active);
    setDeletedReminders(deleted);
    let nextExclusions = occurrenceExclusions;
    for (const id of idsToPurge) {
      nextExclusions = clearExclusionsForReminder(nextExclusions, id);
    }
    if (nextExclusions !== occurrenceExclusions) {
      setOccurrenceExclusions(nextExclusions);
      saveOccurrenceExclusions(nextExclusions);
    }
    if (user && idsToPurge.length > 0) {
      await Promise.all(
        idsToPurge.map((id) =>
          deleteCloudReminder(user.uid, id).catch((err) =>
            console.error('Cloud clear-deleted failed:', err)
          )
        )
      );
    }
    showToast('Cleared all deleted schedules');
  };

  const handleTestAlert = (target: Reminder) => {
    unlockAudioEngine();
    setIsTestPreview(true);
    setAlertQueue([target]);
    void dispatchSystemNotification(target);
  };

  const handleEnableNotifications = async () => {
    unlockAudioEngine();
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
    if (perm === 'granted') {
      setDismissedNotifPrompt(true);
      showToast('Windows desktop notifications enabled');
    } else if (isEmbeddedIframe()) {
      showToast('Open Qikki in its own browser tab to enable Windows alerts');
    } else if (perm === 'denied') {
      showToast('Notifications are blocked in your browser site settings');
    }
  };

  // Derived sorted lists
  const activeReminders = useMemo(() => {
    return reminders
      .filter((r) => r.status !== 'completed')
      .sort((a, b) => {
        const aTime = new Date(a.snoozedUntil || a.triggerAt).getTime();
        const bTime = new Date(b.snoozedUntil || b.triggerAt).getTime();
        return aTime - bTime;
      });
  }, [reminders]);

  const completedReminders = useMemo(() => {
    return reminders
      .filter((r) => r.status === 'completed')
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }, [reminders]);

  const handleScheduleOnDate = useCallback((date: Date) => {
    const now = new Date();
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0, 0);
    if (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate() &&
      target.getTime() <= now.getTime()
    ) {
      const soon = new Date(now.getTime() + 60 * 60000);
      soon.setSeconds(0, 0);
      target.setTime(soon.getTime());
    }
    const defaultVib =
      VIBRATION_PRESETS.find(
        (v) => v.presetId === preferences.defaultVibrationPresetId
      ) ?? VIBRATION_PRESETS[0];
    const draft = createEmptyDraft({
      triggerAt: target.toISOString(),
      recurrence: createDefaultRecurrence(target),
      sound: {
        presetId: preferences.defaultSoundPreset,
        volume: preferences.defaultSoundVolume,
        repeatCount: 1,
      },
      vibration: { ...defaultVib },
    });
    setComposerDraft(draft);
    setComposerOpen(true);
  }, [
    preferences.defaultSoundPreset,
    preferences.defaultSoundVolume,
    preferences.defaultVibrationPresetId,
  ]);

  const recurringReminders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeReminders.filter((item) => {
      if (item.recurrence.frequency === 'none') return false;
      if (!q) return true;
      return `${item.title} ${item.notes} ${item.location || ''}`.toLowerCase().includes(q);
    });
  }, [activeReminders, searchQuery]);

  const filteredCompleted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return completedReminders;
    return completedReminders.filter((item) =>
      `${item.title} ${item.notes} ${item.location || ''}`.toLowerCase().includes(q)
    );
  }, [completedReminders, searchQuery]);

  const filteredDeleted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return deletedReminders;
    return deletedReminders.filter((item) =>
      `${item.title} ${item.notes} ${item.location || ''}`.toLowerCase().includes(q)
    );
  }, [deletedReminders, searchQuery]);

  const handleOpenContextMenu = useCallback(
    (
      reminder: Reminder,
      event: React.MouseEvent,
      occurrenceDate?: Date,
      isProjected?: boolean
    ) => {
      setContextMenu({
        reminder,
        x: event.clientX,
        y: event.clientY,
        occurrenceDate,
        isProjected,
      });
    },
    []
  );

  const nextReminder = activeReminders[0] ?? null;
  const nextCountdown = nextReminder
    ? formatRelativeCountdown(
        nextReminder.snoozedUntil || nextReminder.triggerAt,
        nowMs
      )
    : null;

  const weeklyCount = activeReminders.filter(
    (r) => r.recurrence.frequency === 'weekly'
  ).length;
  const monthlyCount = activeReminders.filter(
    (r) => r.recurrence.frequency === 'monthly'
  ).length;

  const rightOverviewCard = (
    <div className="relative rounded-3xl">
      {/* Soft breathing neon ambient glow */}
      <div
        aria-hidden="true"
        className="qikki-right-neon-breathe pointer-events-none absolute -inset-3 -z-10 rounded-[34px] blur-xl"
      />
      {/* Traveling neon border trace + soft edge bloom */}
      <div
        aria-hidden="true"
        className="qikki-right-neon-mask pointer-events-none absolute -inset-[1.5px] z-20 overflow-hidden rounded-[25px] opacity-85"
      >
        <div className="qikki-right-neon-beam" />
      </div>
      <div
        aria-hidden="true"
        className="qikki-right-neon-mask pointer-events-none absolute -inset-[2px] z-20 overflow-hidden rounded-[26px] opacity-55 blur-[5px]"
      >
        <div className="qikki-right-neon-beam" />
      </div>

      <div
        className="qikki-glass-card relative z-10 divide-y divide-slate-900/[0.08] rounded-3xl border border-white/80 bg-white/58 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] transition-shadow duration-200 lg:max-h-[calc(100dvh-9.625rem)] lg:overflow-y-auto lg:no-scrollbar dark:divide-white/[0.10] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]"
      >
        {/* Section 1: Next Up */}
        <section className="p-4 xl:p-4.5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300/85">
              Next Up
            </h2>
            {nextReminder && nextCountdown && (
              <span
                className={`font-mono text-xs font-medium tabular-nums ${
                  nextCountdown.isOverdue
                    ? 'text-red-600 dark:text-red-400'
                    : nextCountdown.isDueSoon
                      ? 'text-amber-600 dark:text-amber-300'
                      : 'text-blue-600 dark:text-blue-300'
                }`}
              >
                {nextCountdown.isOverdue
                  ? 'Overdue'
                  : nextCountdown.isDueSoon
                    ? 'Due soon'
                    : 'Scheduled'}
              </span>
            )}
          </div>

          {nextReminder && nextCountdown ? (
            <div className="mt-2.5 space-y-2">
              <p className="font-display text-xl font-bold leading-snug tracking-tight text-slate-950 [text-wrap:balance] sm:text-[22px] dark:text-white">
                {nextReminder.title}
              </p>
              <div
                className={`font-mono text-base font-semibold tracking-tight tabular-nums sm:text-[17px] ${
                  nextCountdown.isOverdue
                    ? 'text-red-600 dark:text-red-400'
                    : nextCountdown.isDueSoon
                      ? 'text-amber-600 dark:text-amber-300'
                      : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {nextCountdown.label}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300/85">
                {formatScheduleDateTime(
                  nextReminder.snoozedUntil || nextReminder.triggerAt
                )}{' '}
                · {formatRecurrenceSummary(nextReminder.recurrence)}
              </p>
              {nextReminder.location && (
                <p className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300/85">
                  <MapPin
                    className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-300"
                    aria-hidden="true"
                  />
                  <span className="truncate">{nextReminder.location}</span>
                </p>
              )}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleTestAlert(nextReminder)}
                  className="w-full rounded-xl border border-white/75 bg-white/60 px-3 py-2 text-xs font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition-colors hover:bg-white/85 hover:text-slate-950 dark:border-white/[0.16] dark:bg-white/[0.08] dark:text-slate-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] dark:hover:bg-white/[0.15] dark:hover:text-white"
                >
                  Preview Popup, Sound &amp; Vibration
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300/80">
              No active reminders queued.
            </p>
          )}
        </section>

        {/* Section 2: Compact Schedule Overview */}
        <section className="p-4 xl:p-4.5">
          <h2 className="font-display text-xs font-semibold text-slate-600 dark:text-slate-300/80">
            Overview
          </h2>
          <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5">
            <div>
              <dt className="text-[11px] text-slate-500 dark:text-slate-300/75">
                Active
              </dt>
              <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-slate-950 dark:text-white">
                {activeReminders.length}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500 dark:text-slate-300/75">
                Completed
              </dt>
              <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-slate-950 dark:text-white">
                {completedReminders.length}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500 dark:text-slate-300/75">
                Weekly
              </dt>
              <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-slate-950 dark:text-white">
                {weeklyCount}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500 dark:text-slate-300/75">
                Monthly
              </dt>
              <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-slate-950 dark:text-white">
                {monthlyCount}
              </dd>
            </div>
          </dl>
          {deletedReminders.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setHistorySubView('deleted');
                handleSelectTab('history');
              }}
              className="mt-3 flex w-full items-center justify-between text-xs text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-300/80 dark:hover:text-white"
            >
              <span>Recently deleted (7-day retention)</span>
              <span className="font-mono font-medium tabular-nums">
                {deletedReminders.length}
              </span>
            </button>
          )}
        </section>

        {/* Section 3: Cloud Sync */}
        <section className="space-y-2.5 p-4 xl:p-4.5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xs font-semibold text-slate-600 dark:text-slate-300/80">
              Cloud Sync
            </h2>
            {user && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {isCloudSyncing ? 'Syncing' : 'Active'}
              </span>
            )}
          </div>

          {user ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <UserAvatar
                  photoURL={avatarUrl}
                  displayName={user.displayName}
                  email={user.email}
                  size="sm"
                  showTracing={true}
                  showEditBadge={true}
                  onClick={() => setAvatarModalOpen(true)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                    {user.displayName || 'Qikki Account'}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-300/75">
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleOpenSyncPreferences}
                  className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                >
                  Manage Sync →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void signOut().then(() => {
                      showToast('Signed out of Qikki Cloud');
                    });
                  }}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-red-600 dark:text-slate-300/75 dark:hover:text-red-300"
                >
                  <LogOut className="h-3 w-3" aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <UserAvatar
                  photoURL={avatarUrl}
                  displayName="Guest"
                  size="sm"
                  showTracing={true}
                  showEditBadge={true}
                  onClick={() => setAvatarModalOpen(true)}
                />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setAvatarModalOpen(true)}
                    className="text-left text-xs font-semibold text-slate-800 transition-colors hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-300"
                  >
                    Customize Profile Picture
                  </button>
                  <p className="text-[11px] text-slate-500 dark:text-slate-300/75">
                    Choose a cute preset or upload
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300/80">
                Sign in to sync your schedules and alarms securely across all devices.
              </p>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="qikki-accent-btn inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold shadow-xs transition-colors"
              >
                <User className="h-3.5 w-3.5" />
                <span>Sign In / Create Account</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-transparent text-slate-900 select-none dark:text-slate-100">
      <QikkiStartupSplash isVisible={showSplash} />
      <AmbientDarkBackdrop theme={appTheme} />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showSplash ? 0 : 1 }}
        transition={{
          duration: 1.2,
          delay: showSplash ? 0 : 0.2,
          ease: [0.16, 1, 0.3, 1],
        }}
        className={showSplash ? 'pointer-events-none' : undefined}
      >
      {!webMinimized && (
        <TopBar
          onSelectTab={handleSelectTab}
          showWeather={preferences.showHeaderWeather}
          weatherStatus={weatherStatus}
          weatherForecast={weatherForecast}
          weatherError={weatherError}
          temperatureUnit={preferences.temperatureUnit}
          clockFormat={preferences.clockFormat}
          onToggleTemperatureUnit={(unit) =>
            updatePreferences({ temperatureUnit: unit })
          }
          onRequestWeatherLocation={requestLocationAndForecast}
          onRefreshWeather={refreshForecast}
          isWebExpanded={webExpanded}
          onWebMinimize={() => {
            setWebMinimized(true);
          }}
          onWebToggleExpand={() => {
            setWebExpanded((prev) => !prev);
          }}
          onWebClose={() => {
            if (alertQueue.length > 0) {
              setAlertQueue([]);
              setIsTestPreview(false);
            } else if (composerOpen) {
              setComposerOpen(false);
              setComposerDraft(null);
            } else {
              setWebMinimized(true);
            }
          }}
        />
      )}

      {webMinimized ? (
        <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 max-w-[calc(100vw-2rem)]">
          <div className="flex items-center gap-3 rounded-2xl border border-white/65 bg-white/82 px-3.5 py-2.5 shadow-[0_18px_42px_-12px_rgba(15,23,42,0.34),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/[0.14] dark:bg-slate-900/75 dark:shadow-[0_20px_48px_-12px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.12)]">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Qikki
                </span>
                {nextCountdown && (
                  <span className="font-mono text-[11px] font-medium tabular-nums text-blue-600 dark:text-blue-300">
                    {nextCountdown.label}
                  </span>
                )}
              </div>
              <p className="max-w-[200px] truncate text-[11px] text-slate-600 dark:text-slate-300/80">
                {nextReminder ? nextReminder.title : 'Alerts running in background'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setWebMinimized(false);
                  setComposerDraft(createEmptyDraft());
                  setComposerOpen(true);
                }}
                title="Quick New Reminder"
                aria-label="New Reminder"
                className="qikki-accent-btn flex h-8 w-8 items-center justify-center rounded-lg shadow-xs transition-colors"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setWebMinimized(false)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-900/10 bg-white/80 px-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-white dark:border-white/14 dark:bg-white/[0.1] dark:text-white dark:hover:bg-white/[0.18]"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Restore</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
      <main
        className={`mx-auto w-full overflow-x-clip px-3 pt-[calc(60px+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-5 sm:pt-[calc(68px+env(safe-area-inset-top))] sm:pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pt-[calc(72px+env(safe-area-inset-top))] ${
          webExpanded ? 'max-w-none' : 'max-w-[1640px]'
        }`}
      >


        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'preferences' ? (
            <motion.div
              key="view-preferences"
              variants={centerPopVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ transformOrigin: 'center center' }}
              className="origin-center"
            >
              <PreferencesView
                preferences={preferences}
                onUpdatePreferences={updatePreferences}
                onResetPreferences={resetPreferences}
                desktopPrefs={desktopPrefs}
                desktopPrefsLoaded={desktopPrefsLoaded}
                onUpdateDesktopStartupPrefs={updateDesktopStartupPrefs}
                onUpdateAutoDownloadUpdates={updateAutoDownloadUpdates}
                notifPerm={notifPerm}
                onChangeNotifPerm={setNotifPerm}
                onTestSystemNotification={() => {
                  if (nextReminder) {
                    return dispatchSystemNotification(nextReminder);
                  }
                  return dispatchSystemNotification({
                    id: 'test-notif',
                    title: 'Qikki Alert',
                    notes: 'System notifications are active and working.',
                    triggerAt: new Date().toISOString(),
                    timezone: 'UTC',
                    recurrence: createDefaultRecurrence(),
                    sound: {
                      presetId: preferences.defaultSoundPreset,
                      volume: preferences.defaultSoundVolume,
                      repeatCount: 1,
                    },
                    vibration: {
                      ...(VIBRATION_PRESETS.find(
                        (v) => v.presetId === preferences.defaultVibrationPresetId
                      ) ?? VIBRATION_PRESETS[0]),
                    },
                    status: 'active',
                    completedCount: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    syncVersion: 1,
                    deviceOrigin: detectDeviceOrigin(),
                  });
                }}
                onPreviewNotificationTheme={() => {
                  if (nextReminder) {
                    handleTestAlert(nextReminder);
                  } else {
                    setIsTestPreview(true);
                    setAlertQueue([
                      {
                        id: 'theme-preview',
                        title: 'Sample Reminder Alert',
                        notes: 'Previewing your selected notification theme.',
                        triggerAt: new Date().toISOString(),
                        timezone: 'UTC',
                        recurrence: createDefaultRecurrence(),
                        sound: {
                          presetId: preferences.defaultSoundPreset,
                          volume: preferences.defaultSoundVolume,
                          repeatCount: 1,
                        },
                        vibration: {
                          ...(VIBRATION_PRESETS.find(
                            (v) => v.presetId === preferences.defaultVibrationPresetId
                          ) ?? VIBRATION_PRESETS[0]),
                        },
                        status: 'active',
                        completedCount: 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        syncVersion: 1,
                        deviceOrigin: detectDeviceOrigin(),
                      },
                    ]);
                  }
                }}
                appTheme={appTheme}
                notificationTheme={notificationTheme}
                onChangeAppTheme={handleChangeAppTheme}
                onChangeNotificationTheme={handleChangeNotificationTheme}
                weatherStatus={weatherStatus}
                weatherForecast={weatherForecast}
                weatherError={weatherError}
                onRequestWeatherLocation={requestLocationAndForecast}
                onRefreshWeather={refreshForecast}
                onSelectManualCity={setManualCity}
                onDisableWeatherLocation={disableLocationWeather}
                holidayDetectedCountryCode={holidayDetectedCountryCode}
                holidayDetectedCountryName={holidayDetectedCountryName}
                holidayEffectiveCountryCode={holidayEffectiveCountryCode}
                holidayEffectiveCountryName={holidayEffectiveCountryName}
                holidayCountries={holidayCountries}
                holidayCount={holidayCount}
                holidaysLoading={holidaysLoading}
                holidaysError={holidaysError}
                holidaysLastUpdatedAt={holidaysLastUpdatedAt}
                onRefreshHolidays={refreshHolidays}
                syncSection={
                  <SyncAndAppView
                    embeddedInPreferences
                    reminders={reminders}
                    syncStatus={syncStatus}
                    user={user}
                    isSigningIn={isSigningIn}
                    isCloudSyncing={isCloudSyncing}
                    authError={authError}
                    needsNewTabForAuth={needsNewTabForAuth}
                    onSignOut={async () => {
                      await signOut();
                      showToast('Signed out of cloud sync');
                    }}
                    onCloudSyncNow={async () => {
                      if (!user) {
                        return {
                          ok: false,
                          message: 'Sign in or register to enable cloud sync.',
                        };
                      }
                      return runCloudSyncMerge(user.uid);
                    }}
                    onExportBundle={() => storageAdapter.exportBundle(reminders)}
                    onImportBundle={async (bundle: PortableSyncBundle) => {
                      const res = storageAdapter.mergeBundle(reminders, bundle);
                      await persistReminders(res.merged);
                      if (user) {
                        await runCloudSyncMerge(user.uid);
                      }
                      return { added: res.added, updated: res.updated };
                    }}
                    onOpenAuth={() => setAuthModalOpen(true)}
                    onClearLocalData={async () => {
                      if (user) {
                        await signOut();
                      }
                      await storageAdapter.clearAllLocalData();
                      setReminders([]);
                      setDeletedReminders([]);
                      const emptyExclusions: OccurrenceExclusions = {
                        skippedDates: {},
                        stopAfterDates: {},
                      };
                      setOccurrenceExclusions(emptyExclusions);
                      resetPreferences();
                      setSyncStatus(storageAdapter.getStatus());
                      showToast(
                        'Local device data cleared. Cloud data remains safe.'
                      );
                    }}
                    onAccountDeleted={async () => {
                      await storageAdapter.clearAllLocalData();
                      setReminders([]);
                      setDeletedReminders([]);
                      const emptyExclusions: OccurrenceExclusions = {
                        skippedDates: {},
                        stopAfterDates: {},
                      };
                      setOccurrenceExclusions(emptyExclusions);
                      resetPreferences();
                      setSyncStatus(storageAdapter.getStatus());
                      showToast('Your Qikki account and cloud data have been deleted.');
                    }}
                  />
                }
              />
            </motion.div>
          ) : (
            <div
              key="view-workspace"
              className="w-full min-w-0 lg:pr-[308px] xl:pr-[340px]"
            >
              {/* Left / Main Workspace */}
              <div className="min-w-0 space-y-5">
                {authError && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-400/40 bg-amber-50/85 px-4 py-2.5 text-xs text-amber-900 shadow-xs backdrop-blur-xl dark:border-amber-400/25 dark:bg-amber-950/55 dark:text-amber-200">
                    <span>{authError}</span>
                    {needsNewTabForAuth && (
                      <a
                        href={typeof window !== 'undefined' ? window.location.href : '/'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="qikki-accent-btn rounded-lg px-3 py-1.5 font-medium whitespace-nowrap shrink-0"
                      >
                        Open Qikki in New Tab
                      </a>
                    )}
                  </div>
                )}

                {/* Explicit user consent banner for location-based live weather forecast */}
                {preferences.showHeaderWeather && shouldPromptWeatherLocation && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-300/60 bg-sky-50/82 px-4 py-3 text-xs text-slate-800 shadow-sm backdrop-blur-xl backdrop-saturate-150 dark:border-sky-400/25 dark:bg-sky-950/45 dark:text-slate-100">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden="true" />
                      <span>
                        Allow Qikki to access your location to show an accurate live weather &amp; rain forecast in the top bar. Your location is never collected.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={dismissLocationPrompt}
                        className="px-2 py-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                      >
                        Not now
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectTab('preferences')}
                        className="rounded-lg border border-slate-900/12 bg-white/75 px-2.5 py-1 font-medium text-slate-700 hover:bg-white dark:border-white/14 dark:bg-white/[0.08] dark:text-slate-200"
                      >
                        Pick City
                      </button>
                      <button
                        type="button"
                        onClick={() => void requestLocationAndForecast()}
                        className="qikki-accent-btn rounded-lg px-3 py-1 font-medium"
                      >
                        Allow Location
                      </button>
                    </div>
                  </div>
                )}

                {/* Notification enable strip (contextual, non-blocking) */}
                {notifPerm !== 'granted' && notifPerm !== 'unsupported' && !dismissedNotifPrompt && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-blue-300/70 bg-blue-50/68 px-4 py-3 text-xs text-slate-800 shadow-[0_14px_36px_-12px_rgba(37,99,235,0.22),inset_0_1.5px_0_rgba(255,255,255,0.9)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-blue-400/25 dark:bg-blue-950/38 dark:text-slate-100 dark:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55),inset_0_1.5px_0_rgba(255,255,255,0.16)]">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                      <span>
                        {isEmbeddedIframe()
                          ? 'Embedded preview blocks system popups. Open Qikki in its own browser tab for alert notifications.'
                          : notifPerm === 'denied'
                            ? 'System notifications are blocked in browser site settings for this URL.'
                            : 'Allow system notifications so reminders pop up even when Qikki is in the background.'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDismissedNotifPrompt(true)}
                        className="px-2 py-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                      >
                        Later
                      </button>
                      {isEmbeddedIframe() ? (
                        <a
                          href={typeof window !== 'undefined' ? window.location.href : '/'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="qikki-accent-btn rounded-md px-3 py-1 font-medium"
                        >
                          Open in New Tab
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={handleEnableNotifications}
                          className="qikki-accent-btn rounded-md px-3 py-1 font-medium"
                        >
                          Enable Desktop Alerts
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Animated Tab Content (Unified Schedule & History transitions, zero layout snap) */}
                <AnimatePresence mode="wait" initial={false}>
                  {!isLoaded ? (
                    <motion.div
                      key="workspace-loading"
                      variants={centerPopVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      style={{ transformOrigin: 'center center' }}
                      className="origin-center"
                    >
                      <div className="qikki-glass-card space-y-3 rounded-3xl border border-white/80 bg-white/58 p-5 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),inset_0_1.5px_0_rgba(255,255,255,0.95)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),inset_0_1.5px_0_rgba(255,255,255,0.24)]">
                        <div className="h-10 animate-pulse rounded-xl bg-slate-900/10 dark:bg-white/10" />
                        <div className="h-10 animate-pulse rounded-xl bg-slate-900/10 dark:bg-white/10" />
                      </div>
                    </motion.div>
                  ) : activeTab === 'upcoming' ? (
                    <motion.div
                      key="upcoming-workspace"
                      variants={centerPopVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      style={{ transformOrigin: 'center center' }}
                      className="origin-center space-y-5"
                    >
                      <WelcomeGreetingCard
                        user={user}
                        avatarUrl={avatarUrl}
                        onOpenAvatarPicker={() => setAvatarModalOpen(true)}
                        activeCount={activeReminders.length}
                        nextReminderTitle={nextReminder?.title ?? null}
                        nextCountdownLabel={nextCountdown?.label ?? null}
                        todayHoliday={todayHoliday}
                      />

                      <MonthCalendarView
                        reminders={activeReminders}
                        exclusions={occurrenceExclusions}
                        nowMs={nowMs}
                        viewYear={calendarYear}
                        viewMonth={calendarMonth}
                        selectedDate={selectedCalendarDate}
                        holidaysByDate={holidaysByDate}
                        showHolidays={preferences.showHolidays}
                        onChangeMonth={(y, m) => {
                          setCalendarYear(y);
                          setCalendarMonth(m);
                        }}
                        onJumpToToday={() => {
                          const today = new Date();
                          setCalendarYear(today.getFullYear());
                          setCalendarMonth(today.getMonth());
                          setSelectedCalendarDate(null);
                        }}
                        onSelectDate={setSelectedCalendarDate}
                        onSelectReminder={(item) => {
                          setComposerDraft(reminderToDraft(item));
                          setComposerOpen(true);
                        }}
                        onContextMenuReminder={handleOpenContextMenu}
                        onScheduleOnDate={handleScheduleOnDate}
                      />

                      <ReminderList
                        variant="recurring"
                        reminders={recurringReminders}
                        nowMs={nowMs}
                        cardHeader={{
                          title: 'Recurring',
                          subtitle:
                            'Repeating schedules with next occurrence dates',
                          count: recurringReminders.length,
                          searchValue: searchQuery,
                          onSearchChange: setSearchQuery,
                          searchPlaceholder: 'Filter recurring...',
                        }}
                        emptyTitle="No recurring reminders yet"
                        emptyDescription="Use the + button in the bottom dock to set up weekly weekday routines or monthly schedules that auto-advance after each completion."
                        onComplete={handleCompleteReminder}
                        onSnooze={handleSnoozeReminder}
                        onEdit={(item) => {
                          setComposerDraft(reminderToDraft(item));
                          setComposerOpen(true);
                        }}
                        onTestAlert={handleTestAlert}
                        onDelete={handleDeleteReminder}
                        onContextMenuReminder={(item, e) =>
                          handleOpenContextMenu(item, e)
                        }
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="history-workspace"
                      variants={centerPopVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      style={{ transformOrigin: 'center center' }}
                      className="origin-center space-y-5"
                    >
                      {/* History Sub-view Switcher + Search Card (consistent Liquid Glass surface) */}
                      <div className="qikki-glass-card flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/80 bg-white/58 px-4 py-3.5 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] sm:px-5 dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]">
                        <div
                          role="tablist"
                          aria-label="History views"
                          className="inline-flex items-center gap-1 rounded-xl bg-slate-900/[0.06] p-1 dark:bg-white/[0.08]"
                        >
                          <button
                            type="button"
                            role="tab"
                            aria-selected={historySubView === 'completed'}
                            onClick={() => setHistorySubView('completed')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                              historySubView === 'completed'
                                ? 'bg-white text-slate-950 shadow-xs dark:bg-white/[0.18] dark:text-white'
                                : 'text-slate-600 hover:text-slate-950 dark:text-slate-300/80 dark:hover:text-white'
                            }`}
                          >
                            <span>Completed</span>
                            <span className="ml-1.5 font-mono text-[11px] opacity-70 tabular-nums">
                              {completedReminders.length}
                            </span>
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={historySubView === 'deleted'}
                            onClick={() => setHistorySubView('deleted')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                              historySubView === 'deleted'
                                ? 'bg-white text-slate-950 shadow-xs dark:bg-white/[0.18] dark:text-white'
                                : 'text-slate-600 hover:text-slate-950 dark:text-slate-300/80 dark:hover:text-white'
                            }`}
                          >
                            <span>Recently Deleted</span>
                            <span className="ml-1.5 font-mono text-[11px] opacity-70 tabular-nums">
                              {deletedReminders.length}
                            </span>
                          </button>
                        </div>

                        <div className="relative flex-1 sm:max-w-xs">
                          <Search
                            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-slate-300/75"
                            aria-hidden="true"
                          />
                          <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={
                              historySubView === 'deleted'
                                ? 'Filter deleted schedules...'
                                : 'Filter completed reminders...'
                            }
                            aria-label="Filter reminders"
                            className="w-full rounded-xl border border-slate-900/10 bg-white/75 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none dark:border-white/[0.12] dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      {historySubView === 'deleted' ? (
                        <RecentlyDeletedList
                          items={filteredDeleted}
                          nowMs={nowMs}
                          onRestore={handleRestoreDeleted}
                          onDeleteForever={handlePermanentDelete}
                          onClearAll={handleClearAllDeleted}
                        />
                      ) : (
                        <ReminderList
                          reminders={filteredCompleted}
                          nowMs={nowMs}
                          emptyTitle="No completed reminders yet"
                          emptyDescription="One-time reminders appear here after you mark them complete. Recurring reminders automatically advance to their next date."
                          onComplete={handleCompleteReminder}
                          onReactivate={handleReactivateReminder}
                          onSnooze={handleSnoozeReminder}
                          onEdit={(item) => {
                            setComposerDraft(reminderToDraft(item));
                            setComposerOpen(true);
                          }}
                          onTestAlert={handleTestAlert}
                          onDelete={handleDeleteReminder}
                          onContextMenuReminder={(item, e) =>
                            handleOpenContextMenu(item, e)
                          }
                        />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile / Tablet Overview Card below main workspace */}
              <aside className="mt-5 lg:hidden">
                {rightOverviewCard}
              </aside>
            </div>
          )}
        </AnimatePresence>
      </main>
      )}

      {/* Anchored Desktop Right Overview Window: centered vertically between TopBar and BottomDock */}
      {!webMinimized && activeTab !== 'preferences' && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(3rem+env(safe-area-inset-top))] bottom-[calc(4.625rem+env(safe-area-inset-bottom))] z-20 hidden items-center py-4 lg:flex">
          <div
            className={`mx-auto flex h-full w-full items-center justify-end px-3 sm:px-5 ${
              webExpanded ? 'max-w-none' : 'max-w-[1640px]'
            }`}
          >
            <aside className="pointer-events-auto my-auto w-[280px] xl:w-[310px]">
              {rightOverviewCard}
            </aside>
          </div>
        </div>
      )}

      {!webMinimized && (
        <BottomDock
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onOpenCreatePopup={() => {
            const defaultVib =
              VIBRATION_PRESETS.find(
                (v) => v.presetId === preferences.defaultVibrationPresetId
              ) ?? VIBRATION_PRESETS[0];
            setComposerDraft(
              createEmptyDraft({
                sound: {
                  presetId: preferences.defaultSoundPreset,
                  volume: preferences.defaultSoundVolume,
                  repeatCount: 1,
                },
                vibration: { ...defaultVib },
              })
            );
            setComposerOpen(true);
          }}
          onOpenAuth={() => setAuthModalOpen(true)}
          onOpenSyncPreferences={handleOpenSyncPreferences}
          user={user}
          avatarUrl={avatarUrl}
          isSigningIn={isSigningIn}
        />
      )}

      <ReminderComposer
        isOpen={composerOpen}
        initialDraft={composerDraft}
        onClose={() => {
          setComposerOpen(false);
          setComposerDraft(null);
        }}
        onSave={handleSaveComposer}
        onDeleteEvent={(reminderId) => {
          const target = reminders.find((r) => r.id === reminderId);
          setComposerOpen(false);
          setComposerDraft(null);
          if (target) {
            void handleDeleteSingleEvent(target);
          }
        }}
        onDeleteRepeatingUpcoming={(reminderId) => {
          const target = reminders.find((r) => r.id === reminderId);
          setComposerOpen(false);
          setComposerDraft(null);
          if (target) {
            void handleDeleteRepeatingUpcomingEvent(target);
          }
        }}
      />

      <EventContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onEdit={(item) => {
          setComposerDraft(reminderToDraft(item));
          setComposerOpen(true);
        }}
        onDeleteEvent={(item, occDate, isProjected) => {
          void handleDeleteSingleEvent(item, occDate, isProjected);
        }}
        onDeleteRepeatingUpcoming={(item, occDate, isProjected) => {
          void handleDeleteRepeatingUpcomingEvent(item, occDate, isProjected);
        }}
      />

      <AlertPopupModal
        queue={alertQueue}
        isTestPreview={isTestPreview}
        notificationTheme={resolvedNotificationTheme}
        defaultSnoozeMinutes={preferences.defaultSnoozeMinutes}
        onComplete={handleCompleteReminder}
        onSnooze={handleSnoozeReminder}
        onDismiss={handleDismissAlert}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          showToast('Signed in to Qikki Cloud');
        }}
      />

      {/* Lightweight Liquid Glass Action Toast with Undo */}
      <AnimatePresence>
        {actionToast && !congratsPopup && (
          <motion.div
            key="action-toast"
            initial={{ opacity: 0, y: 12, scale: 0.965 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
            }}
            exit={{
              opacity: 0,
              y: 6,
              scale: 0.975,
              transition: { duration: 0.13, ease: [0.2, 0, 0, 1] },
            }}
            role="status"
            aria-live="polite"
            className="qikki-glass-modal fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 z-40 flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/64 px-4 py-2.5 text-xs font-medium text-slate-800 shadow-[0_18px_44px_-12px_rgba(15,23,42,0.28),inset_0_1.5px_0_rgba(255,255,255,0.95)] backdrop-blur-[28px] backdrop-saturate-[185%] sm:left-auto sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:right-5 sm:max-w-md dark:border-white/[0.18] dark:bg-slate-900/55 dark:text-slate-100 dark:shadow-[0_20px_48px_-12px_rgba(0,0,0,0.68),inset_0_1.5px_0_rgba(255,255,255,0.22)]"
          >
            <span>{actionToast.message}</span>
            <div className="flex items-center gap-3 shrink-0">
              {actionToast.undoReminder && (
                <button
                  type="button"
                  onClick={() => {
                    const item = actionToast.undoReminder;
                    setActionToast(null);
                    if (item) void handleRestoreDeleted(item);
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Undo
                </button>
              )}
              {actionToast.actionLabel && actionToast.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    const cb = actionToast.onAction;
                    setActionToast(null);
                    cb?.();
                  }}
                  className="font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200"
                >
                  {actionToast.actionLabel}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Congratulatory Achievement Popup */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
        <AnimatePresence>
          {congratsPopup && (
            <motion.div
              key="congrats-popup"
              initial={{ opacity: 0, scale: 0.92, y: 14 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
                y: 8,
                transition: { duration: 0.14, ease: [0.2, 0, 0, 1] },
              }}
              role="status"
              aria-live="polite"
              className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-3xl border border-amber-300/60 bg-slate-900/90 p-5 text-slate-100 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-2xl backdrop-saturate-150 dark:border-amber-400/35"
            >
              <div className="flex items-start gap-3.5">
                <motion.div
                  key={congratsPopup.count}
                  initial={congratsPopup.count > 1 ? { scale: 0.86 } : false}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300 shadow-inner"
                >
                  <Check className="h-6 w-6 stroke-[2.5]" aria-hidden="true" />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-sm font-bold text-white">
                      Fantastic Job! 🎉
                    </h3>
                    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      Completed{congratsPopup.count > 1 ? ` ×${congratsPopup.count}` : ''}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs leading-snug text-slate-200">
                    Finished <span className="font-semibold text-white">"{congratsPopup.title}"</span>.
                  </p>
                  {congratsPopup.isRecurring && congratsPopup.nextDateLabel && (
                    <p className="mt-1.5 text-[11px] font-medium text-amber-200/90">
                      Next occurrence: {congratsPopup.nextDateLabel}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (congratsTimerRef.current !== null) {
                      window.clearTimeout(congratsTimerRef.current);
                      congratsTimerRef.current = null;
                    }
                    setCongratsPopup(null);
                  }}
                  aria-label="Dismiss congratulation"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ProfilePictureModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        currentPhotoURL={avatarUrl}
        displayName={user?.displayName}
        email={user?.email}
        onSaveAvatar={async (url) => {
          await updateAvatar(url);
          showToast('Profile picture updated!');
        }}
      />

      <OfflineIndicator />
      </motion.div>
    </div>
  );
}
