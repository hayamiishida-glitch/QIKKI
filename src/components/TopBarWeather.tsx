import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Droplets,
  MapPin,
  RefreshCw,
  Settings2,
  Wind,
  X,
} from 'lucide-react';
import type { ClockFormat, TemperatureUnit } from '../hooks/useAppPreferences';
import {
  formatShortTemperature,
  formatTemperature,
  type WeatherConditionKind,
  type WeatherForecastData,
  type WeatherLocationStatus,
} from '../hooks/useWeatherForecast';

interface AnimatedWeatherIconProps {
  condition: WeatherConditionKind;
  isDay?: boolean;
  sizeClass?: string;
}

export const AnimatedWeatherIcon: React.FC<AnimatedWeatherIconProps> = ({
  condition,
  isDay = true,
  sizeClass = 'h-5 w-5',
}) => {
  const reduceMotion = useReducedMotion();

  if (condition === 'clear' && isDay) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={sizeClass}
        aria-hidden="true"
      >
        <motion.g
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 24, repeat: Infinity, ease: 'linear' }
          }
          style={{ originX: '12px', originY: '12px' }}
          stroke="#F59E0B"
          strokeWidth="1.75"
          strokeLinecap="round"
        >
          <line x1="12" y1="2.2" x2="12" y2="4.4" />
          <line x1="12" y1="19.6" x2="12" y2="21.8" />
          <line x1="2.2" y1="12" x2="4.4" y2="12" />
          <line x1="19.6" y1="12" x2="21.8" y2="12" />
          <line x1="5.1" y1="5.1" x2="6.7" y2="6.7" />
          <line x1="17.3" y1="17.3" x2="18.9" y2="18.9" />
          <line x1="18.9" y1="5.1" x2="17.3" y2="6.7" />
          <line x1="6.7" y1="17.3" x2="5.1" y2="18.9" />
        </motion.g>
        <motion.circle
          cx="12"
          cy="12"
          r="4.5"
          fill="#FBBF24"
          stroke="#F59E0B"
          strokeWidth="1.2"
          animate={
            reduceMotion ? undefined : { scale: [1, 1.07, 1], opacity: [0.95, 1, 0.95] }
          }
          transition={
            reduceMotion
              ? undefined
              : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{ originX: '12px', originY: '12px' }}
        />
      </svg>
    );
  }

  if (condition === 'clear' && !isDay) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={sizeClass}
        aria-hidden="true"
      >
        <motion.path
          d="M19.2 14.4A7.2 7.2 0 0 1 9.6 4.8a7.2 7.2 0 1 0 9.6 9.6Z"
          fill="#93C5FD"
          stroke="#60A5FA"
          strokeWidth="1.4"
          strokeLinejoin="round"
          animate={reduceMotion ? undefined : { rotate: [-4, 4, -4] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 5.5, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{ originX: '12px', originY: '12px' }}
        />
        <motion.circle
          cx="17.5"
          cy="6.2"
          r="1"
          fill="#E0F2FE"
          animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35], scale: [0.8, 1.2, 0.8] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
          }
        />
      </svg>
    );
  }

  if (condition === 'partly-cloudy') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={sizeClass}
        aria-hidden="true"
      >
        <motion.g
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 26, repeat: Infinity, ease: 'linear' }
          }
          style={{ originX: '9px', originY: '9px' }}
        >
          <circle cx="9" cy="9" r="3.4" fill={isDay ? '#FBBF24' : '#93C5FD'} />
          <path
            d="M9 3.6v1.2M9 13.2v1.2M3.6 9h1.2M13.2 9h1.2M5.2 5.2l.85.85M11.95 11.95l.85.85M12.8 5.2l-.85.85"
            stroke={isDay ? '#F59E0B' : '#60A5FA'}
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </motion.g>
        <motion.path
          d="M8.5 18.5h8.2a3.3 3.3 0 0 0 .35-6.58A4.6 4.6 0 0 0 8.1 10.7a3.9 3.9 0 0 0 .4 7.8Z"
          fill="currentColor"
          className="text-slate-200 dark:text-slate-300"
          stroke="#94A3B8"
          strokeWidth="1.2"
          animate={reduceMotion ? undefined : { x: [-0.8, 0.9, -0.8] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 4.2, repeat: Infinity, ease: 'easeInOut' }
          }
        />
      </svg>
    );
  }

  if (condition === 'rain' || condition === 'drizzle') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={sizeClass}
        aria-hidden="true"
      >
        <path
          d="M7.2 15.2h9.5a3.3 3.3 0 0 0 .4-6.58A4.8 4.8 0 0 0 7.7 7.4a4 4 0 0 0-.5 7.8Z"
          fill="currentColor"
          className="text-slate-300 dark:text-slate-400"
          stroke="#64748B"
          strokeWidth="1.2"
        />
        {[8.5, 12.2, 15.8].map((x, idx) => (
          <motion.line
            key={x}
            x1={x}
            y1="16.5"
            x2={x - 1}
            y2="19.6"
            stroke="#38BDF8"
            strokeWidth="1.6"
            strokeLinecap="round"
            animate={
              reduceMotion
                ? undefined
                : { y: [-1, 3.2], opacity: [0, 1, 0] }
            }
            transition={
              reduceMotion
                ? undefined
                : {
                    duration: condition === 'drizzle' ? 1.3 : 0.9,
                    delay: idx * 0.24,
                    repeat: Infinity,
                    ease: 'linear',
                  }
            }
          />
        ))}
      </svg>
    );
  }

  if (condition === 'thunderstorm') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={sizeClass}
        aria-hidden="true"
      >
        <path
          d="M7.2 14.5h9.5a3.3 3.3 0 0 0 .4-6.58A4.8 4.8 0 0 0 7.7 6.7a4 4 0 0 0-.5 7.8Z"
          fill="currentColor"
          className="text-slate-400 dark:text-slate-500"
          stroke="#475569"
          strokeWidth="1.2"
        />
        <motion.path
          d="M12.6 13.5 10.2 17.3h2.4l-1 3.4 3.6-4.6h-2.5l1.1-2.6Z"
          fill="#FBBF24"
          animate={
            reduceMotion
              ? undefined
              : { opacity: [0.25, 1, 0.2, 0.95, 0.25] }
          }
          transition={
            reduceMotion
              ? undefined
              : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
          }
        />
      </svg>
    );
  }

  if (condition === 'snow') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={sizeClass}
        aria-hidden="true"
      >
        <path
          d="M7.2 14.8h9.5a3.3 3.3 0 0 0 .4-6.58A4.8 4.8 0 0 0 7.7 7a4 4 0 0 0-.5 7.8Z"
          fill="currentColor"
          className="text-slate-200 dark:text-slate-300"
          stroke="#94A3B8"
          strokeWidth="1.2"
        />
        {[8.8, 12.2, 15.6].map((x, idx) => (
          <motion.circle
            key={x}
            cx={x}
            cy="17"
            r="1.15"
            fill="#BAE6FD"
            animate={
              reduceMotion
                ? undefined
                : { y: [-0.8, 3.6], x: [0, idx % 2 === 0 ? 1 : -1, 0], opacity: [0, 1, 0] }
            }
            transition={
              reduceMotion
                ? undefined
                : {
                    duration: 1.7,
                    delay: idx * 0.35,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
            }
          />
        ))}
      </svg>
    );
  }

  // Cloudy / Fog
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={sizeClass}
      aria-hidden="true"
    >
      <motion.path
        d="M7.2 16.4h9.5a3.3 3.3 0 0 0 .4-6.58A4.8 4.8 0 0 0 7.7 8.6a4 4 0 0 0-.5 7.8Z"
        fill="currentColor"
        className="text-slate-200 dark:text-slate-300"
        stroke="#94A3B8"
        strokeWidth="1.25"
        animate={reduceMotion ? undefined : { x: [-1, 1, -1] }}
        transition={
          reduceMotion
            ? undefined
            : { duration: 4.8, repeat: Infinity, ease: 'easeInOut' }
        }
      />
      {condition === 'fog' && (
        <motion.path
          d="M6.5 19.2h11"
          stroke="#94A3B8"
          strokeWidth="1.5"
          strokeLinecap="round"
          animate={reduceMotion ? undefined : { opacity: [0.4, 0.9, 0.4] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
          }
        />
      )}
    </svg>
  );
};

interface TopBarWeatherProps {
  status: WeatherLocationStatus;
  forecast: WeatherForecastData | null;
  errorMessage: string | null;
  unit: TemperatureUnit;
  clockFormat?: ClockFormat;
  onToggleUnit: (unit: TemperatureUnit) => void;
  onRequestLocation: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onOpenPreferences: () => void;
}

export const TopBarWeather: React.FC<TopBarWeatherProps> = ({
  status,
  forecast,
  errorMessage,
  unit,
  clockFormat = '24h',
  onToggleUnit,
  onRequestLocation,
  onRefresh,
  onOpenPreferences,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={
          forecast
            ? `${forecast.locationName}: ${formatTemperature(
                forecast.tempC,
                unit
              )} · ${forecast.conditionLabel} (${forecast.precipChance}% rain)`
            : 'Local weather forecast'
        }
        aria-expanded={open}
        aria-label="Local weather forecast"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-900/10 bg-white/65 px-2.5 text-xs font-medium text-slate-800 transition-colors hover:bg-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-white/12 dark:bg-white/[0.07] dark:text-slate-100 dark:hover:bg-white/[0.14]"
      >
        <AnimatedWeatherIcon
          condition={forecast?.condition ?? 'partly-cloudy'}
          isDay={forecast?.isDay ?? true}
          sizeClass="h-4 w-4 shrink-0"
        />

        {status === 'loading' && !forecast ? (
          <span className="text-[11px] text-slate-500 dark:text-slate-300">
            Locating...
          </span>
        ) : forecast ? (
          <>
            <span className="font-mono font-semibold tabular-nums text-slate-950 dark:text-white">
              {formatTemperature(forecast.tempC, unit)}
            </span>
            <span className="hidden text-[11px] text-slate-500 sm:inline dark:text-slate-300/80">
              {forecast.precipChance >= 25
                ? `${forecast.precipChance}% rain`
                : forecast.conditionLabel}
            </span>
            <span className="hidden max-w-[84px] truncate text-[11px] text-slate-500 lg:inline dark:text-slate-400">
              · {forecast.locationName}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-slate-700 dark:text-slate-200">
            {status === 'denied' ? 'Weather Off' : 'Weather'}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
            }}
            exit={{
              opacity: 0,
              y: 3,
              scale: 0.97,
              transition: { duration: 0.12, ease: [0.2, 0, 0, 1] },
            }}
            style={{ transformOrigin: 'top right' }}
            className="qikki-glass-modal absolute right-0 top-10 z-50 w-80 max-w-[calc(100vw-1.5rem)] rounded-3xl border border-white/80 bg-white/72 p-4 text-slate-900 shadow-[0_24px_56px_-14px_rgba(15,23,42,0.34),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.3)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/62 dark:text-slate-100 dark:shadow-[0_28px_64px_-14px_rgba(0,0,0,0.75),inset_0_1.5px_0_rgba(255,255,255,0.24),inset_0_-1px_0_rgba(255,255,255,0.06)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-xs font-semibold text-slate-900 dark:text-white">
                  {forecast ? forecast.locationName : 'Local Weather Forecast'}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {forecast
                    ? forecast.regionLabel || 'Live local conditions'
                    : 'Accurate forecast based on your location'}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className="inline-flex rounded-md bg-slate-900/[0.06] p-0.5 text-[10px] font-semibold dark:bg-white/[0.08]">
                  {(['c', 'f'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => onToggleUnit(u)}
                      className={`rounded px-1.5 py-0.5 uppercase transition-colors ${
                        unit === u
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.16] dark:text-white'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      °{u}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close forecast"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-900/10 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {forecast ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-3 border-b border-slate-900/[0.08] pb-3 dark:border-white/[0.08]">
                  <div className="flex items-center gap-3">
                    <AnimatedWeatherIcon
                      condition={forecast.condition}
                      isDay={forecast.isDay}
                      sizeClass="h-10 w-10"
                    />
                    <div>
                      <div className="font-mono text-2xl font-bold tracking-tight tabular-nums text-slate-950 dark:text-white">
                        {formatTemperature(forecast.tempC, unit)}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        {forecast.conditionLabel} · Feels{' '}
                        <span className="font-mono tabular-nums">
                          {formatShortTemperature(forecast.feelsLikeC, unit)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onRefresh()}
                    disabled={status === 'loading'}
                    title="Refresh weather"
                    aria-label="Refresh weather"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-900/10 bg-white/70 text-slate-600 hover:bg-white hover:text-slate-950 disabled:opacity-50 dark:border-white/12 dark:bg-white/[0.07] dark:text-slate-300 dark:hover:bg-white/[0.14]"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        status === 'loading' ? 'animate-spin' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                {/* Live accuracy details: rain probability, precipitation rate, wind & humidity */}
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-xl bg-slate-900/[0.04] px-2.5 py-1.5 dark:bg-white/[0.05]">
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <Droplets className="h-3 w-3 text-sky-500" aria-hidden="true" />
                      <span>Rain Rate</span>
                    </div>
                    <div className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                      {forecast.precipChance}% · {forecast.precipMm}mm
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-900/[0.04] px-2.5 py-1.5 dark:bg-white/[0.05]">
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <Wind className="h-3 w-3 text-teal-500" aria-hidden="true" />
                      <span>Wind</span>
                    </div>
                    <div className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                      {forecast.windKmh} km/h
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-900/[0.04] px-2.5 py-1.5 dark:bg-white/[0.05]">
                    <div className="text-slate-500 dark:text-slate-400">
                      Humidity
                    </div>
                    <div className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                      {forecast.humidity}%
                    </div>
                  </div>
                </div>

                {/* Next Hours Strip */}
                {forecast.hourly.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5 border-t border-slate-900/[0.08] pt-2.5 text-center dark:border-white/[0.08]">
                    {forecast.hourly.slice(0, 4).map((hr) => (
                      <div
                        key={hr.timeIso}
                        className="flex flex-col items-center gap-1 rounded-lg py-1"
                      >
                        <span className="font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                          {new Date(hr.timeIso).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: clockFormat === '12h',
                          })}
                        </span>
                        <AnimatedWeatherIcon
                          condition={hr.condition}
                          isDay={hr.isDay}
                          sizeClass="h-4 w-4"
                        />
                        <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-900 dark:text-white">
                          {formatShortTemperature(hr.tempC, unit)}
                        </span>
                        <span className="font-mono text-[9px] tabular-nums text-sky-600 dark:text-sky-300">
                          {hr.precipChance}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-900/[0.08] pt-2.5 text-[11px] dark:border-white/[0.08]">
                  <span className="text-slate-500 dark:text-slate-400">
                    Updated{' '}
                    {new Date(forecast.fetchedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: clockFormat === '12h',
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onOpenPreferences();
                    }}
                    className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                  >
                    <Settings2 className="h-3 w-3" aria-hidden="true" />
                    <span>Location settings</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Allow Qikki to access your device location for live, accurate temperature and rain forecasts. Your coordinates are never collected.
                </p>

                {errorMessage && (
                  <p className="rounded-xl border border-amber-400/30 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-400/20 dark:bg-amber-950/35 dark:text-amber-200">
                    {errorMessage}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onRequestLocation()}
                    disabled={status === 'loading'}
                    className="qikki-accent-btn inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {status === 'loading' ? 'Checking...' : 'Allow Location'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onOpenPreferences();
                    }}
                    className="rounded-xl border border-slate-900/12 bg-white/75 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white dark:border-white/14 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.14]"
                  >
                    City Setup
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
