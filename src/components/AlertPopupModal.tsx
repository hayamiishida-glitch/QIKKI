import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, Clock, MapPin, RotateCcw, Vibrate, Volume2, X } from 'lucide-react';
import type { Reminder } from '../types/reminder';
import type { ThemeMode } from '../hooks/useTheme';
import {
  computeNextOccurrence,
  formatRecurrenceSummary,
  formatScheduleDateTime,
  getRecurrenceProgress,
} from '../utils/recurrence';
import { getSoundName, playReminderSound } from '../services/soundEngine';
import {
  formatVibrationSummary,
  triggerVibrationPattern,
} from '../services/vibrationEngine';

interface AlertPopupModalProps {
  queue: Reminder[];
  isTestPreview: boolean;
  notificationTheme: ThemeMode;
  defaultSnoozeMinutes?: number;
  onComplete: (reminder: Reminder) => void;
  onSnooze: (reminder: Reminder, minutes: number) => void;
  onDismiss: (reminder: Reminder) => void;
}

export const AlertPopupModal: React.FC<AlertPopupModalProps> = ({
  queue,
  isTestPreview,
  notificationTheme,
  defaultSnoozeMinutes = 15,
  onComplete,
  onSnooze,
  onDismiss,
}) => {
  const activeReminder = queue[0] ?? null;
  const [isVibrating, setIsVibrating] = useState(false);
  const stopAudioRef = useRef<(() => void) | null>(null);
  const stopVibRef = useRef<(() => void) | null>(null);

  const replayCue = (reminder: Reminder) => {
    stopAudioRef.current?.();
    stopVibRef.current?.();

    stopAudioRef.current = playReminderSound(
      reminder.sound.presetId,
      reminder.sound.volume,
      reminder.sound.repeatCount
    );

    if (reminder.vibration.pattern.length > 0) {
      stopVibRef.current = triggerVibrationPattern(
        reminder.vibration.pattern,
        (pulsing) => setIsVibrating(pulsing)
      );
    } else {
      setIsVibrating(false);
    }
  };

  useEffect(() => {
    if (!activeReminder) {
      stopAudioRef.current?.();
      stopVibRef.current?.();
      setIsVibrating(false);
      return;
    }

    replayCue(activeReminder);

    return () => {
      stopAudioRef.current?.();
      stopVibRef.current?.();
      setIsVibrating(false);
    };
  }, [activeReminder?.id, isTestPreview]);

  const isRecurring = activeReminder
    ? activeReminder.recurrence.frequency !== 'none'
    : false;
  const targetCount = activeReminder?.recurrence.targetCount;
  const reachedTargetOnComplete =
    typeof targetCount === 'number' &&
    targetCount > 0 &&
    (activeReminder?.completedCount ?? 0) + 1 >= targetCount;
  const nextOccurrence =
    activeReminder && isRecurring && !reachedTargetOnComplete
      ? (() => {
          const triggerMs = new Date(activeReminder.triggerAt).getTime();
          const snoozeMs = activeReminder.snoozedUntil
            ? new Date(activeReminder.snoozedUntil).getTime()
            : 0;
          const advanceAfter = new Date(
            Math.max(
              Date.now(),
              Number.isNaN(triggerMs) ? 0 : triggerMs,
              Number.isNaN(snoozeMs) ? 0 : snoozeMs
            )
          );
          return computeNextOccurrence(
            activeReminder.triggerAt,
            activeReminder.recurrence,
            advanceAfter
          );
        })()
      : null;

  const isDark = notificationTheme === 'dark';

  return (
    <AnimatePresence mode="wait">
      {activeReminder && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="alert-popup-title"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
          }}
          exit={{
            opacity: 0,
            transition: { duration: 0.14, ease: [0.2, 0, 0, 1] },
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[6px]"
        >
          <motion.div
            key={activeReminder.id}
            initial={{ opacity: 0, y: 14, scale: 0.965 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] },
            }}
            exit={{
              opacity: 0,
              y: 6,
              scale: 0.975,
              transition: { duration: 0.14, ease: [0.2, 0, 0, 1] },
            }}
            className={`relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border backdrop-blur-[28px] backdrop-saturate-[185%] transition-shadow duration-300 ${
              isDark
                ? 'border-white/20 bg-slate-900/60 text-slate-100 shadow-[0_28px_70px_-14px_rgba(0,0,0,0.78),inset_0_1.5px_0_rgba(255,255,255,0.24)]'
                : 'border-white/85 bg-white/70 text-slate-900 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.26),inset_0_1.5px_0_rgba(255,255,255,0.96)]'
            } ${
              isVibrating
                ? isDark
                  ? 'ring-2 ring-blue-400/55 shadow-[0_0_36px_rgba(59,130,246,0.24),0_28px_70px_-14px_rgba(0,0,0,0.75)]'
                  : 'ring-2 ring-blue-500/45 shadow-[0_0_32px_rgba(37,99,235,0.2),0_24px_60px_-15px_rgba(15,23,42,0.28)]'
                : ''
            }`}
          >
            {/* Subtle liquid-glass specular refraction sheen */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${
                isDark
                  ? 'from-white/[0.1] via-white/[0.025] to-transparent'
                  : 'from-white/75 via-white/20 to-transparent'
              }`}
            />

            {/* Gentle one-shot glass sheen sweep on card fade-in */}
            <motion.div
              aria-hidden="true"
              initial={{ x: '-110%', opacity: 0 }}
              animate={{ x: '130%', opacity: [0, 0.45, 0] }}
              transition={{ duration: 0.95, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent ${
                isDark ? 'via-white/[0.08]' : 'via-white/50'
              } to-transparent`}
            />

            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
              className={`relative flex items-center justify-between border-b px-4 py-3.5 sm:px-6 sm:py-4 ${
                isDark ? 'border-white/10' : 'border-slate-900/[0.06]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-xl backdrop-blur-md transition-colors duration-300 ${
                    isDark
                      ? isVibrating
                        ? 'bg-blue-500/30 text-blue-200 ring-1 ring-blue-400/40'
                        : 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/25'
                      : isVibrating
                        ? 'bg-blue-600/15 text-blue-700 ring-1 ring-blue-600/25'
                        : 'bg-blue-600/10 text-blue-600 ring-1 ring-blue-600/15'
                  }`}
                >
                  <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span
                  className={`text-xs font-semibold tracking-tight ${
                    isDark ? 'text-slate-200' : 'text-slate-800'
                  }`}
                >
                  {isTestPreview ? 'Alert Preview' : 'Reminder Due'}
                  {queue.length > 1 ? ` · 1 of ${queue.length}` : ''}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => replayCue(activeReminder)}
                  title="Replay sound and vibration"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isDark
                      ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                      : 'text-slate-600 hover:bg-slate-900/[0.06] hover:text-slate-900'
                  }`}
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  <span>Replay</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss(activeReminder)}
                  aria-label="Close alert"
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                    isDark
                      ? 'text-slate-400 hover:bg-white/10 hover:text-white'
                      : 'text-slate-500 hover:bg-slate-900/[0.06] hover:text-slate-900'
                  }`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </motion.div>

            {/* Body */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="relative px-4 py-4 sm:px-6 sm:py-5"
            >
              <h2
                id="alert-popup-title"
                className={`font-display text-[22px] font-semibold leading-snug tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-950'
                }`}
              >
                {activeReminder.title}
              </h2>

              {activeReminder.notes && (
                <p
                  className={`mt-2 text-sm leading-relaxed ${
                    isDark ? 'text-slate-300/90' : 'text-slate-600'
                  }`}
                >
                  {activeReminder.notes}
                </p>
              )}

              {activeReminder.location && (
                <p
                  className={`mt-2 inline-flex items-center gap-1.5 text-xs ${
                    isDark ? 'text-slate-300/85' : 'text-slate-600'
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{activeReminder.location}</span>
                </p>
              )}

              <div
                className={`mt-5 space-y-2 border-t pt-4 text-xs ${
                  isDark
                    ? 'border-white/10 text-slate-400'
                    : 'border-slate-900/[0.07] text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>Scheduled</span>
                  <span
                    className={`font-mono font-medium tabular-nums ${
                      isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    {formatScheduleDateTime(
                      activeReminder.snoozedUntil || activeReminder.triggerAt
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Recurrence</span>
                  <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>
                    {formatRecurrenceSummary(activeReminder.recurrence)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Sound</span>
                  </span>
                  <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>
                    {getSoundName(activeReminder.sound.presetId)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Vibrate className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Vibration</span>
                  </span>
                  <span
                    className={`font-mono tabular-nums ${
                      isDark ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    {formatVibrationSummary(activeReminder.vibration)}
                  </span>
                </div>
              </div>

              {isRecurring &&
                (() => {
                  const progress = getRecurrenceProgress(
                    activeReminder.completedCount,
                    activeReminder.recurrence
                  );
                  if (progress.total <= 0) return null;
                  return (
                    <div
                      className={`mt-4 space-y-1.5 border-t pt-4 ${
                        isDark ? 'border-white/10' : 'border-slate-900/[0.07]'
                      }`}
                    >
                      <div
                        className={`flex items-center justify-between text-xs ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        <span>Cycle completion</span>
                        <span
                          className={`font-mono font-medium tabular-nums ${
                            isDark ? 'text-slate-100' : 'text-slate-900'
                          }`}
                        >
                          {progress.completed} / {progress.total} ({progress.percent}%)
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label="Cycle completion progress"
                        aria-valuenow={progress.completed}
                        aria-valuemin={0}
                        aria-valuemax={progress.total}
                        className={`h-1.5 w-full overflow-hidden rounded-full ${
                          isDark ? 'bg-white/10' : 'bg-slate-900/[0.08]'
                        }`}
                      >
                        <div
                          style={{ transform: `scaleX(${progress.percent / 100})` }}
                          className={`h-full w-full origin-left rounded-full transition-transform duration-300 ease-out ${
                            isDark ? 'bg-blue-400' : 'bg-blue-600'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })()}

              {nextOccurrence && (
                <div
                  className={`mt-4 rounded-xl px-3.5 py-2.5 text-xs backdrop-blur-sm ${
                    isDark
                      ? 'bg-white/[0.06] text-slate-300 ring-1 ring-white/10'
                      : 'bg-slate-900/[0.04] text-slate-600 ring-1 ring-slate-900/[0.05]'
                  }`}
                >
                  Next occurrence auto-schedules for{' '}
                  <span
                    className={`font-mono font-medium tabular-nums ${
                      isDark ? 'text-white' : 'text-slate-950'
                    }`}
                  >
                    {formatScheduleDateTime(nextOccurrence.toISOString())}
                  </span>
                </div>
              )}
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.13, ease: [0.16, 1, 0.3, 1] }}
              className={`relative space-y-2.5 border-t px-4 py-3.5 sm:px-6 sm:py-4 ${
                isDark
                  ? 'border-white/10 bg-white/[0.03]'
                  : 'border-slate-900/[0.06] bg-white/40'
              }`}
            >
              <button
                type="button"
                onClick={() => onComplete(activeReminder)}
                className="qikki-accent-btn flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-150 active:scale-[0.99]"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>
                  {isTestPreview
                    ? 'Close Preview'
                    : isRecurring
                      ? 'Complete & Schedule Next'
                      : 'Mark Complete'}
                </span>
              </button>

              {!isTestPreview && (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from(
                    new Set([
                      defaultSnoozeMinutes === 5 ? 15 : 5,
                      defaultSnoozeMinutes,
                      60,
                    ])
                  )
                    .sort((a, b) => a - b)
                    .slice(0, 3)
                    .map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => onSnooze(activeReminder, mins)}
                        className={`inline-flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-xs font-medium backdrop-blur-sm transition-all duration-150 active:scale-[0.98] ${
                          mins === defaultSnoozeMinutes
                            ? isDark
                              ? 'border-blue-400/40 bg-blue-500/20 text-blue-100 hover:bg-blue-500/30'
                              : 'border-blue-500/35 bg-blue-50/85 text-blue-800 hover:bg-blue-100/80'
                            : isDark
                              ? 'border-white/12 bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]'
                              : 'border-slate-900/10 bg-white/70 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{mins === 60 ? 'Snooze 1h' : `Snooze ${mins}m`}</span>
                      </button>
                    ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
