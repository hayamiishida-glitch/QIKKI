import React, { useEffect, useState } from 'react';
import { Minimize2, Minus, Plus, X } from 'lucide-react';
import type { TemperatureUnit, ClockFormat } from '../hooks/useAppPreferences';
import type {
  WeatherForecastData,
  WeatherLocationStatus,
} from '../hooks/useWeatherForecast';
import { TopBarWeather } from './TopBarWeather';

export type NavTab = 'upcoming' | 'history' | 'preferences';

interface TopBarProps {
  onSelectTab: (tab: NavTab) => void;
  showWeather?: boolean;
  weatherStatus: WeatherLocationStatus;
  weatherForecast: WeatherForecastData | null;
  weatherError: string | null;
  temperatureUnit: TemperatureUnit;
  clockFormat?: ClockFormat;
  onToggleTemperatureUnit: (unit: TemperatureUnit) => void;
  onRequestWeatherLocation: () => Promise<void>;
  onRefreshWeather: () => Promise<void>;
  isWebExpanded?: boolean;
  onWebMinimize?: () => void;
  onWebToggleExpand?: () => void;
  onWebClose?: () => void;
}

export const GoogleMark: React.FC<{ className?: string }> = ({
  className = 'h-3.5 w-3.5',
}) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.24 0-5.99-2.19-6.97-5.13H1.02v3.14C3.04 21.19 7.21 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.03 14.04A7.2 7.2 0 0 1 4.65 12c0-.71.13-1.4.38-2.04V6.82H1.02A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.02 5.18l4.01-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.04 2.81 1.02 6.82l4.01 3.14c.98-2.94 3.73-5.21 6.97-5.21Z"
    />
  </svg>
);

export const TopBar: React.FC<TopBarProps> = ({
  onSelectTab,
  showWeather = true,
  weatherStatus,
  weatherForecast,
  weatherError,
  temperatureUnit,
  clockFormat = '24h',
  onToggleTemperatureUnit,
  onRequestWeatherLocation,
  onRefreshWeather,
  isWebExpanded = false,
  onWebMinimize,
  onWebToggleExpand,
  onWebClose,
}) => {
  const [isDesktopMaximized, setIsDesktopMaximized] = useState(false);
  const isDesktop = Boolean(window.qikkiDesktop?.isDesktop);
  const effectiveMaximized = isDesktop ? isDesktopMaximized : isWebExpanded;

  // Sync native Electron maximize state
  useEffect(() => {
    const desktop = window.qikkiDesktop;
    let cleanupElectron: (() => void) | undefined;

    if (desktop?.isDesktop) {
      desktop.isMaximized?.().then((val) => setIsDesktopMaximized(Boolean(val))).catch(() => {});
      if (desktop.onMaximizeChange) {
        cleanupElectron = desktop.onMaximizeChange((val) => setIsDesktopMaximized(val));
      }
    }

    return () => {
      cleanupElectron?.();
    };
  }, []);

  const handleMinimize = () => {
    if (window.qikkiDesktop?.minimizeWindow) {
      void window.qikkiDesktop.minimizeWindow();
      return;
    }
    onWebMinimize?.();
  };

  const handleToggleMaximize = async () => {
    if (window.qikkiDesktop?.toggleMaximizeWindow) {
      const next = await window.qikkiDesktop.toggleMaximizeWindow();
      setIsDesktopMaximized(Boolean(next));
      return;
    }
    onWebToggleExpand?.();
    try {
      if (!document.fullscreenElement && !isWebExpanded) {
        await document.documentElement.requestFullscreen();
      } else if (document.fullscreenElement && isWebExpanded) {
        await document.exitFullscreen();
      }
    } catch {
      // Web expanded full-width workspace remains active even if fullscreen is restricted
    }
  };

  const handleClose = () => {
    if (window.qikkiDesktop?.closeWindow) {
      void window.qikkiDesktop.closeWindow();
      return;
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    onWebClose?.();
  };

  const handleHeaderDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, nav')) return;
    void handleToggleMaximize();
  };

  return (
    <header
      onDoubleClick={handleHeaderDoubleClick}
      className="qikki-glass-topbar window-drag fixed inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top)]"
    >
      <div className="grid h-11 w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:h-12 sm:gap-4 sm:px-4">
        {/* Left: macOS Traffic-Light Window Controls (hidden in Phone mode <640px, restored at sm+) */}
        <div className="justify-self-start shrink-0">
          <div
            role="group"
            aria-label="Window controls"
            className="window-no-drag group/traffic hidden items-center gap-0.5 sm:flex"
          >
          <button
            type="button"
            onClick={handleClose}
            title={isDesktop ? 'Minimize to tray' : 'Close panel or minimize'}
            aria-label="Close"
            className="flex h-7 w-6 items-center justify-center rounded-md transition-transform active:scale-90 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FF5F57] text-[#6B0F0A] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_2px_rgba(0,0,0,0.18)] ring-1 ring-black/15 transition-transform group-hover/traffic:scale-105 dark:ring-white/10">
              <X
                className="h-2.5 w-2.5 stroke-[2.75] opacity-0 transition-opacity duration-150 group-hover/traffic:opacity-100"
                aria-hidden="true"
              />
            </span>
          </button>

          <button
            type="button"
            onClick={handleMinimize}
            title={isDesktop ? 'Minimize window' : 'Minimize Qikki to floating bar'}
            aria-label="Minimize"
            className="flex h-7 w-6 items-center justify-center rounded-md transition-transform active:scale-90 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FEBC2E] text-[#7A4E00] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_2px_rgba(0,0,0,0.18)] ring-1 ring-black/15 transition-transform group-hover/traffic:scale-105 dark:ring-white/10">
              <Minus
                className="h-2.5 w-2.5 stroke-[2.75] opacity-0 transition-opacity duration-150 group-hover/traffic:opacity-100"
                aria-hidden="true"
              />
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleToggleMaximize()}
            title={
              effectiveMaximized
                ? 'Restore window size'
                : isDesktop
                  ? 'Maximize window'
                  : 'Expand full width'
            }
            aria-label={effectiveMaximized ? 'Restore window' : 'Maximize window'}
            className="flex h-7 w-6 items-center justify-center rounded-md transition-transform active:scale-90 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#28C840] text-[#0A5714] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_2px_rgba(0,0,0,0.18)] ring-1 ring-black/15 transition-transform group-hover/traffic:scale-105 dark:ring-white/10">
              {effectiveMaximized ? (
                <Minimize2
                  className="h-2 w-2 stroke-[2.75] opacity-0 transition-opacity duration-150 group-hover/traffic:opacity-100"
                  aria-hidden="true"
                />
              ) : (
                <Plus
                  className="h-2.5 w-2.5 stroke-[2.75] opacity-0 transition-opacity duration-150 group-hover/traffic:opacity-100"
                  aria-hidden="true"
                />
              )}
            </span>
          </button>
          </div>
        </div>

        {/* Center: Decorative Qikki Logo (inert on click, window-draggable, rainbow neon trace) */}
        <div
          aria-label="Qikki"
          className="justify-self-center px-2 py-0 select-none"
        >
          <span className="qikki-logo-font relative block text-[21px] leading-none text-slate-900 whitespace-nowrap select-none sm:text-[26px] dark:text-white/95">
            Qikki
            <span
              aria-hidden="true"
              className="qikki-neon-trace-halo pointer-events-none absolute inset-0 select-none"
            >
              Qikki
            </span>
            <span
              aria-hidden="true"
              className="qikki-neon-trace-core pointer-events-none absolute inset-0 select-none"
            >
              Qikki
            </span>
          </span>
        </div>

        {/* Right: Weather Widget */}
        <div className="window-no-drag flex items-center justify-end justify-self-end min-w-0 shrink-0">
          {showWeather && (
            <TopBarWeather
              status={weatherStatus}
              forecast={weatherForecast}
              errorMessage={weatherError}
              unit={temperatureUnit}
              clockFormat={clockFormat}
              onToggleUnit={onToggleTemperatureUnit}
              onRequestLocation={onRequestWeatherLocation}
              onRefresh={onRefreshWeather}
              onOpenPreferences={() => onSelectTab('preferences')}
            />
          )}
        </div>
      </div>
    </header>
  );
};
