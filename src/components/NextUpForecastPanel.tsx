import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Droplets,
  MapPin,
  RefreshCw,
  Settings2,
  Wind,
} from 'lucide-react';
import type { ClockFormat, TemperatureUnit } from '../hooks/useAppPreferences';
import {
  formatShortTemperature,
  formatTemperature,
  type WeatherConditionKind,
  type WeatherForecastData,
  type WeatherLocationStatus,
} from '../hooks/useWeatherForecast';
import { AnimatedWeatherIcon } from './TopBarWeather';

interface NextUpForecastPanelProps {
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

function getWeatherBackdropGlow(
  condition: WeatherConditionKind,
  isDay: boolean
): string {
  if (condition === 'clear' && isDay) {
    return 'from-amber-400/20 via-sky-400/10 to-transparent dark:from-amber-400/18 dark:via-sky-500/10 dark:to-transparent';
  }
  if (condition === 'clear' && !isDay) {
    return 'from-indigo-500/22 via-blue-500/10 to-transparent dark:from-indigo-400/20 dark:via-blue-500/10 dark:to-transparent';
  }
  if (condition === 'partly-cloudy') {
    return isDay
      ? 'from-amber-300/16 via-sky-400/12 to-transparent dark:from-amber-300/12 dark:via-sky-500/12 dark:to-transparent'
      : 'from-sky-500/18 via-indigo-500/10 to-transparent dark:from-sky-400/16 dark:via-indigo-500/12 dark:to-transparent';
  }
  if (condition === 'rain' || condition === 'drizzle') {
    return 'from-sky-500/22 via-cyan-500/10 to-transparent dark:from-sky-500/20 dark:via-cyan-500/10 dark:to-transparent';
  }
  if (condition === 'thunderstorm') {
    return 'from-violet-500/20 via-amber-400/10 to-transparent dark:from-indigo-500/24 dark:via-amber-400/10 dark:to-transparent';
  }
  if (condition === 'snow') {
    return 'from-cyan-300/22 via-sky-200/12 to-transparent dark:from-sky-300/16 dark:via-indigo-300/10 dark:to-transparent';
  }
  return 'from-slate-400/18 via-sky-400/10 to-transparent dark:from-slate-400/14 dark:via-sky-500/8 dark:to-transparent';
}

const HeroWeatherAnimation: React.FC<{
  condition: WeatherConditionKind;
  isDay?: boolean;
}> = ({ condition, isDay = true }) => {
  const reduceMotion = useReducedMotion();

  if (condition === 'clear' && isDay) {
    return (
      <svg
        viewBox="0 0 80 80"
        fill="none"
        className="h-[72px] w-[72px] shrink-0 overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="qikkiSunCore" cx="42%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="55%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#F59E0B" />
          </radialGradient>
        </defs>
        {/* Breathing outer solar halo */}
        <motion.circle
          cx="40"
          cy="40"
          r="28"
          fill="#FBBF24"
          opacity={0.18}
          animate={
            reduceMotion
              ? undefined
              : { scale: [0.94, 1.12, 0.94], opacity: [0.14, 0.28, 0.14] }
          }
          transition={
            reduceMotion
              ? undefined
              : { duration: 4.2, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{ originX: '40px', originY: '40px' }}
        />
        {/* Rotating primary sun rays */}
        <motion.g
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 28, repeat: Infinity, ease: 'linear' }
          }
          style={{ originX: '40px', originY: '40px' }}
          stroke="#F59E0B"
          strokeWidth="2.6"
          strokeLinecap="round"
        >
          <line x1="40" y1="6" x2="40" y2="14" />
          <line x1="40" y1="66" x2="40" y2="74" />
          <line x1="6" y1="40" x2="14" y2="40" />
          <line x1="66" y1="40" x2="74" y2="40" />
          <line x1="16" y1="16" x2="21.6" y2="21.6" />
          <line x1="58.4" y1="58.4" x2="64" y2="64" />
          <line x1="64" y1="16" x2="58.4" y2="21.6" />
          <line x1="21.6" y1="58.4" x2="16" y2="64" />
        </motion.g>
        {/* Counter-rotating soft secondary rays */}
        <motion.g
          animate={reduceMotion ? undefined : { rotate: -360 }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 42, repeat: Infinity, ease: 'linear' }
          }
          style={{ originX: '40px', originY: '40px' }}
          stroke="#FBBF24"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity={0.7}
        >
          <line x1="27" y1="8.6" x2="29.4" y2="14.2" />
          <line x1="50.6" y1="65.8" x2="53" y2="71.4" />
          <line x1="8.6" y1="53" x2="14.2" y2="50.6" />
          <line x1="65.8" y1="29.4" x2="71.4" y2="27" />
        </motion.g>
        {/* Luminous Sun Disc */}
        <motion.circle
          cx="40"
          cy="40"
          r="16.5"
          fill="url(#qikkiSunCore)"
          stroke="#F59E0B"
          strokeWidth="1.4"
          animate={reduceMotion ? undefined : { scale: [1, 1.05, 1] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{ originX: '40px', originY: '40px' }}
        />
      </svg>
    );
  }

  if (condition === 'clear' && !isDay) {
    return (
      <svg
        viewBox="0 0 80 80"
        fill="none"
        className="h-[72px] w-[72px] shrink-0 overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="qikkiMoonGrad" x1="20" y1="16" x2="58" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E0F2FE" />
            <stop offset="55%" stopColor="#93C5FD" />
            <stop offset="100%" stopColor="#60A5FA" />
          </linearGradient>
        </defs>
        <motion.circle
          cx="39"
          cy="41"
          r="24"
          fill="#60A5FA"
          opacity={0.14}
          animate={
            reduceMotion
              ? undefined
              : { scale: [0.95, 1.08, 0.95], opacity: [0.1, 0.22, 0.1] }
          }
          transition={
            reduceMotion
              ? undefined
              : { duration: 5, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{ originX: '39px', originY: '41px' }}
        />
        <motion.path
          d="M57 46.8A20.5 20.5 0 0 1 30.2 20a20.5 20.5 0 1 0 26.8 26.8Z"
          fill="url(#qikkiMoonGrad)"
          stroke="#60A5FA"
          strokeWidth="1.6"
          strokeLinejoin="round"
          animate={reduceMotion ? undefined : { rotate: [-4, 4, -4], y: [0, -1.5, 0] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 6, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{ originX: '39px', originY: '41px' }}
        />
        {[
          { cx: 56, cy: 20, r: 2.2, delay: 0 },
          { cx: 64, cy: 31, r: 1.5, delay: 0.7 },
          { cx: 22, cy: 18, r: 1.6, delay: 1.2 },
        ].map((star, idx) => (
          <motion.circle
            key={idx}
            cx={star.cx}
            cy={star.cy}
            r={star.r}
            fill="#E0F2FE"
            animate={
              reduceMotion
                ? undefined
                : { opacity: [0.25, 1, 0.25], scale: [0.75, 1.25, 0.75] }
            }
            transition={
              reduceMotion
                ? undefined
                : { duration: 2.8, delay: star.delay, repeat: Infinity, ease: 'easeInOut' }
            }
            style={{ originX: `${star.cx}px`, originY: `${star.cy}px` }}
          />
        ))}
      </svg>
    );
  }

  if (condition === 'partly-cloudy') {
    return (
      <svg
        viewBox="0 0 80 80"
        fill="none"
        className="h-[72px] w-[72px] shrink-0 overflow-visible"
        aria-hidden="true"
      >
        {/* Sun / Moon peeking behind cloud */}
        <motion.g
          animate={reduceMotion ? undefined : isDay ? { rotate: 360 } : { rotate: [-4, 4, -4] }}
          transition={
            reduceMotion
              ? undefined
              : isDay
                ? { duration: 30, repeat: Infinity, ease: 'linear' }
                : { duration: 6, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{ originX: '28px', originY: '28px' }}
        >
          {isDay ? (
            <>
              <circle cx="28" cy="28" r="11.5" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1.2" />
              <path
                d="M28 11v4M28 41v4M11 28h4M41 28h4M16 16l2.8 2.8M37.2 37.2L40 40M40 16l-2.8 2.8M18.8 37.2L16 40"
                stroke="#F59E0B"
                strokeWidth="2.1"
                strokeLinecap="round"
              />
            </>
          ) : (
            <path
              d="M36.5 32.5A12 12 0 0 1 21 17a12 12 0 1 0 15.5 15.5Z"
              fill="#93C5FD"
              stroke="#60A5FA"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          )}
        </motion.g>
        {/* Back cloud drift */}
        <motion.path
          d="M28 57h27a10 10 0 0 0 1.2-19.9A13.8 13.8 0 0 0 29.4 33.4 11.8 11.8 0 0 0 28 57Z"
          fill="currentColor"
          className="text-white/90 dark:text-slate-300"
          stroke="#94A3B8"
          strokeWidth="1.5"
          animate={reduceMotion ? undefined : { x: [-2.4, 2.6, -2.4] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 5.5, repeat: Infinity, ease: 'easeInOut' }
          }
        />
        {/* Soft foreground puff */}
        <motion.path
          d="M20 60h21a7.5 7.5 0 0 0 .8-14.9 10.2 10.2 0 0 0-19.7-2.6A8.8 8.8 0 0 0 20 60Z"
          fill="currentColor"
          className="text-slate-100/95 dark:text-slate-200/90"
          stroke="#CBD5E1"
          strokeWidth="1.2"
          animate={reduceMotion ? undefined : { x: [2, -2, 2] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 4.8, repeat: Infinity, ease: 'easeInOut' }
          }
        />
      </svg>
    );
  }

  if (condition === 'rain' || condition === 'drizzle') {
    const isHeavy = condition === 'rain';
    const drops = isHeavy
      ? [
          { x: 24, delay: 0, dur: 0.85 },
          { x: 34, delay: 0.28, dur: 0.82 },
          { x: 44, delay: 0.14, dur: 0.88 },
          { x: 54, delay: 0.42, dur: 0.84 },
        ]
      : [
          { x: 26, delay: 0, dur: 1.25 },
          { x: 39, delay: 0.4, dur: 1.25 },
          { x: 52, delay: 0.75, dur: 1.25 },
        ];

    return (
      <svg
        viewBox="0 0 80 80"
        fill="none"
        className="h-[72px] w-[72px] shrink-0 overflow-visible"
        aria-hidden="true"
      >
        <motion.path
          d="M21 47h36a10.8 10.8 0 0 0 1.4-21.5A15.4 15.4 0 0 0 27.6 21.4 13 13 0 0 0 21 47Z"
          fill="currentColor"
          className="text-slate-200 dark:text-slate-400"
          stroke="#64748B"
          strokeWidth="1.6"
          animate={reduceMotion ? undefined : { y: [-1, 1.5, -1] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 3.8, repeat: Infinity, ease: 'easeInOut' }
          }
        />
        {drops.map((drop, idx) => (
          <motion.line
            key={idx}
            x1={drop.x}
            y1="51"
            x2={drop.x - 3.5}
            y2={isHeavy ? '62' : '58'}
            stroke="#38BDF8"
            strokeWidth={isHeavy ? '2.5' : '2'}
            strokeLinecap="round"
            animate={
              reduceMotion
                ? undefined
                : { y: [-2, 13], opacity: [0, 1, 0] }
            }
            transition={
              reduceMotion
                ? undefined
                : {
                    duration: drop.dur,
                    delay: drop.delay,
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
        viewBox="0 0 80 80"
        fill="none"
        className="h-[72px] w-[72px] shrink-0 overflow-visible"
        aria-hidden="true"
      >
        <motion.circle
          cx="40"
          cy="48"
          r="20"
          fill="#FBBF24"
          opacity={0}
          animate={
            reduceMotion
              ? undefined
              : { opacity: [0, 0.28, 0.04, 0.22, 0] }
          }
          transition={
            reduceMotion
              ? undefined
              : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }
          }
        />
        <motion.path
          d="M20 45h38a10.8 10.8 0 0 0 1.3-21.5A15.4 15.4 0 0 0 28.4 19.4 13 13 0 0 0 20 45Z"
          fill="currentColor"
          className="text-slate-300 dark:text-slate-500"
          stroke="#475569"
          strokeWidth="1.6"
          animate={reduceMotion ? undefined : { x: [-1.2, 1.2, -1.2] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }
          }
        />
        {[26, 52].map((x, idx) => (
          <motion.line
            key={x}
            x1={x}
            y1="50"
            x2={x - 3}
            y2="59"
            stroke="#38BDF8"
            strokeWidth="2.1"
            strokeLinecap="round"
            animate={
              reduceMotion
                ? undefined
                : { y: [-2, 11], opacity: [0, 0.9, 0] }
            }
            transition={
              reduceMotion
                ? undefined
                : { duration: 0.95, delay: idx * 0.35, repeat: Infinity, ease: 'linear' }
            }
          />
        ))}
        <motion.path
          d="M42.5 41 34.5 54.5h7.2l-3.2 12.2 12.2-15.6h-7.8l3.6-10.1Z"
          fill="#FBBF24"
          stroke="#F59E0B"
          strokeWidth="0.9"
          strokeLinejoin="round"
          animate={
            reduceMotion
              ? undefined
              : { opacity: [0.35, 1, 0.25, 1, 0.35], scale: [0.97, 1.04, 0.98, 1.03, 0.97] }
          }
          transition={
            reduceMotion
              ? undefined
              : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{ originX: '40px', originY: '54px' }}
        />
      </svg>
    );
  }

  if (condition === 'snow') {
    const flakes = [
      { cx: 25, cy: 52, r: 2.6, drift: 3.5, delay: 0 },
      { cx: 36, cy: 50, r: 2.2, drift: -3, delay: 0.45 },
      { cx: 47, cy: 52, r: 2.8, drift: 3, delay: 0.2 },
      { cx: 56, cy: 50, r: 2.1, drift: -2.5, delay: 0.75 },
    ];
    return (
      <svg
        viewBox="0 0 80 80"
        fill="none"
        className="h-[72px] w-[72px] shrink-0 overflow-visible"
        aria-hidden="true"
      >
        <motion.path
          d="M21 47h36a10.8 10.8 0 0 0 1.4-21.5A15.4 15.4 0 0 0 27.6 21.4 13 13 0 0 0 21 47Z"
          fill="currentColor"
          className="text-slate-100 dark:text-slate-300"
          stroke="#94A3B8"
          strokeWidth="1.6"
          animate={reduceMotion ? undefined : { x: [-1.5, 1.5, -1.5] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 5.2, repeat: Infinity, ease: 'easeInOut' }
          }
        />
        {flakes.map((f, idx) => (
          <motion.circle
            key={idx}
            cx={f.cx}
            cy={f.cy}
            r={f.r}
            fill="#BAE6FD"
            stroke="#E0F2FE"
            strokeWidth="0.7"
            animate={
              reduceMotion
                ? undefined
                : {
                    y: [-2, 16],
                    x: [0, f.drift, 0],
                    opacity: [0, 1, 0],
                  }
            }
            transition={
              reduceMotion
                ? undefined
                : {
                    duration: 2.1,
                    delay: f.delay,
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
      viewBox="0 0 80 80"
      fill="none"
      className="h-[72px] w-[72px] shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <motion.path
        d="M28 45h28a9.5 9.5 0 0 0 1.2-18.9 13.4 13.4 0 0 0-25.8-3.6 11 11 0 0 0-3.4 22.5Z"
        fill="currentColor"
        className="text-slate-200/80 dark:text-slate-400/70"
        stroke="#94A3B8"
        strokeWidth="1.4"
        animate={reduceMotion ? undefined : { x: [2.5, -2.5, 2.5] }}
        transition={
          reduceMotion
            ? undefined
            : { duration: 6.5, repeat: Infinity, ease: 'easeInOut' }
        }
      />
      <motion.path
        d="M18 54h35a10 10 0 0 0 1.2-19.9 14.2 14.2 0 0 0-27.8-3.5A12 12 0 0 0 18 54Z"
        fill="currentColor"
        className="text-white/95 dark:text-slate-300"
        stroke="#94A3B8"
        strokeWidth="1.6"
        animate={reduceMotion ? undefined : { x: [-2.5, 2.5, -2.5] }}
        transition={
          reduceMotion
            ? undefined
            : { duration: 5.2, repeat: Infinity, ease: 'easeInOut' }
        }
      />
      {condition === 'fog' && (
        <g stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round">
          <motion.line
            x1="18"
            y1="61"
            x2="58"
            y2="61"
            animate={reduceMotion ? undefined : { x: [-3, 3, -3], opacity: [0.4, 0.9, 0.4] }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }
            }
          />
          <motion.line
            x1="24"
            y1="67"
            x2="52"
            y2="67"
            animate={reduceMotion ? undefined : { x: [3, -3, 3], opacity: [0.35, 0.8, 0.35] }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 4.2, repeat: Infinity, ease: 'easeInOut' }
            }
          />
        </g>
      )}
    </svg>
  );
};

export const NextUpForecastPanel: React.FC<NextUpForecastPanelProps> = ({
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
  const glowClass = forecast
    ? getWeatherBackdropGlow(forecast.condition, forecast.isDay)
    : 'from-sky-400/16 via-blue-500/8 to-transparent dark:from-sky-400/14 dark:via-blue-500/10 dark:to-transparent';

  const todayRange = forecast?.daily?.[0];

  return (
    <section className="relative overflow-hidden p-4 xl:p-4.5">
      {/* Subtle atmospheric radial sheen */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b ${glowClass}`}
      />

      <div className="relative z-10">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300/85">
              Forecast
            </h2>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-semibold text-slate-900 dark:text-white">
              <MapPin className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
              <span className="truncate">
                {forecast ? forecast.locationName : 'Local Weather'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="inline-flex rounded-lg bg-slate-900/[0.06] p-0.5 text-[10px] font-semibold dark:bg-white/[0.08]">
              {(['c', 'f'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => onToggleUnit(u)}
                  aria-label={`Use ${u === 'c' ? 'Celsius' : 'Fahrenheit'}`}
                  className={`rounded-md px-1.5 py-0.5 uppercase transition-colors ${
                    unit === u
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.18] dark:text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  °{u}
                </button>
              ))}
            </div>

            {forecast && (
              <button
                type="button"
                onClick={() => void onRefresh()}
                disabled={status === 'loading'}
                title="Refresh live forecast"
                aria-label="Refresh live forecast"
                className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-900/10 bg-white/65 text-slate-600 transition-colors hover:bg-white hover:text-slate-950 disabled:opacity-50 dark:border-white/12 dark:bg-white/[0.07] dark:text-slate-300 dark:hover:bg-white/[0.14]"
              >
                <RefreshCw
                  className={`h-3 w-3 ${status === 'loading' ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        </div>

        {forecast ? (
          <div className="mt-3 space-y-3.5">
            {/* Hero Temperature + Animated Atmospheric Illustration */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[34px] font-bold leading-none tracking-tight tabular-nums text-slate-950 dark:text-white">
                  {formatTemperature(forecast.tempC, unit)}
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {forecast.conditionLabel}
                </p>
                <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-300/80">
                  Feels {formatShortTemperature(forecast.feelsLikeC, unit)}
                  {todayRange
                    ? ` · H:${formatShortTemperature(todayRange.maxTempC, unit)} L:${formatShortTemperature(todayRange.minTempC, unit)}`
                    : ''}
                </p>
              </div>

              <HeroWeatherAnimation
                condition={forecast.condition}
                isDay={forecast.isDay}
              />
            </div>

            {/* Clean Hairline Metrics Strip */}
            <dl className="grid grid-cols-3 divide-x divide-slate-900/[0.08] border-y border-slate-900/[0.08] py-2.5 text-center dark:divide-white/[0.09] dark:border-white/[0.09]">
              <div className="px-1">
                <dt className="flex items-center justify-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  <Droplets className="h-3 w-3 text-sky-500" aria-hidden="true" />
                  <span>Rain</span>
                </dt>
                <dd className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                  {forecast.precipChance}%
                </dd>
              </div>
              <div className="px-1">
                <dt className="flex items-center justify-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  <Wind className="h-3 w-3 text-teal-500" aria-hidden="true" />
                  <span>Wind</span>
                </dt>
                <dd className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                  {forecast.windKmh} km/h
                </dd>
              </div>
              <div className="px-1">
                <dt className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Humidity
                </dt>
                <dd className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                  {forecast.humidity}%
                </dd>
              </div>
            </dl>

            {/* Next 4 Hours Strip */}
            {forecast.hourly.length > 0 && (
              <div className="grid grid-cols-4 gap-1 text-center">
                {forecast.hourly.slice(0, 4).map((hr) => (
                  <div
                    key={hr.timeIso}
                    className="flex flex-col items-center gap-1 rounded-xl py-1 transition-colors hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05]"
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
                      sizeClass="h-5 w-5"
                    />
                    <span className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatShortTemperature(hr.tempC, unit)}
                    </span>
                    <span className="font-mono text-[9px] tabular-nums text-sky-600 dark:text-sky-300">
                      {hr.precipChance}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-0.5 text-[11px]">
              <span className="truncate text-slate-500 dark:text-slate-400">
                {forecast.regionLabel ||
                  `Updated ${new Date(forecast.fetchedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: clockFormat === '12h',
                  })}`}
              </span>
              <button
                type="button"
                onClick={onOpenPreferences}
                className="inline-flex shrink-0 items-center gap-1 font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
              >
                <Settings2 className="h-3 w-3" aria-hidden="true" />
                <span>City</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3">
              <HeroWeatherAnimation condition="partly-cloudy" isDay={true} />
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300/85">
                {status === 'loading'
                  ? 'Detecting your local weather and upcoming hourly forecast...'
                  : 'Allow device location or choose a city for live animated forecasts.'}
              </p>
            </div>

            {errorMessage && (
              <p className="rounded-xl border border-amber-400/30 bg-amber-50/80 px-2.5 py-1.5 text-[11px] text-amber-900 dark:border-amber-400/20 dark:bg-amber-950/35 dark:text-amber-200">
                {errorMessage}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onRequestLocation()}
                disabled={status === 'loading'}
                className="qikki-accent-btn inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{status === 'loading' ? 'Locating...' : 'Allow Location'}</span>
              </button>
              <button
                type="button"
                onClick={onOpenPreferences}
                className="rounded-xl border border-slate-900/12 bg-white/70 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-white whitespace-nowrap dark:border-white/14 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.14]"
              >
                Pick City
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
