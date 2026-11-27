import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarClock, CalendarX2, MapPin, Play, Square, Trash2, Volume2, X } from 'lucide-react';
import type {
  MonthlyMode,
  RecurrenceFrequency,
  RecurrenceRule,
  Reminder,
  SoundConfig,
  SoundPresetId,
  VibrationConfig,
} from '../types/reminder';
import {
  createDefaultRecurrence,
  formatRecurrenceSummary,
  fromLocalDateAndTime,
  getDefaultTargetCount,
  previewUpcomingOccurrences,
  toLocalDateInputValue,
  toLocalTimeInputValue,
} from '../utils/recurrence';
import { playReminderSound, SOUND_PRESETS } from '../services/soundEngine';
import { VIBRATION_PRESETS } from '../services/vibrationEngine';
import { VibrationPatternEditor } from './VibrationPatternEditor';

export interface ComposerDraft {
  id?: string;
  title: string;
  notes: string;
  location?: string;
  triggerAt: string;
  recurrence: RecurrenceRule;
  sound: SoundConfig;
  vibration: VibrationConfig;
}

interface ReminderComposerProps {
  isOpen: boolean;
  initialDraft: ComposerDraft | null;
  onClose: () => void;
  onSave: (draft: ComposerDraft) => void;
  onDeleteEvent?: (reminderId: string) => void;
  onDeleteRepeatingUpcoming?: (reminderId: string) => void;
}

const WEEKDAY_LABELS = [
  { idx: 0, short: 'Sun' },
  { idx: 1, short: 'Mon' },
  { idx: 2, short: 'Tue' },
  { idx: 3, short: 'Wed' },
  { idx: 4, short: 'Thu' },
  { idx: 5, short: 'Fri' },
  { idx: 6, short: 'Sat' },
];

export function createEmptyDraft(
  overrides?: Partial<ComposerDraft>
): ComposerDraft {
  const defaultTrigger = new Date(Date.now() + 30 * 60000);
  defaultTrigger.setSeconds(0, 0);
  return {
    title: '',
    notes: '',
    location: '',
    triggerAt: defaultTrigger.toISOString(),
    recurrence: createDefaultRecurrence(defaultTrigger),
    sound: {
      presetId: 'crystal-chime',
      volume: 0.85,
      repeatCount: 1,
    },
    vibration: { ...VIBRATION_PRESETS[0] },
    ...overrides,
  };
}

export function reminderToDraft(r: Reminder): ComposerDraft {
  return {
    id: r.id,
    title: r.title,
    notes: r.notes,
    location: r.location || '',
    triggerAt: r.triggerAt,
    recurrence: { ...r.recurrence, weekdays: [...r.recurrence.weekdays] },
    sound: { ...r.sound },
    vibration: { ...r.vibration, pattern: [...r.vibration.pattern] },
  };
}

export const ReminderComposer: React.FC<ReminderComposerProps> = ({
  isOpen,
  initialDraft,
  onClose,
  onSave,
  onDeleteEvent,
  onDeleteRepeatingUpcoming,
}) => {
  const [draft, setDraft] = useState<ComposerDraft>(() => createEmptyDraft());
  const [titleError, setTitleError] = useState<string | null>(null);
  const [previewingSoundId, setPreviewingSoundId] =
    useState<SoundPresetId | null>(null);
  const stopAudioRef = useRef<(() => void) | null>(null);
  const volumePreviewTimerRef = useRef<number | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(initialDraft ?? createEmptyDraft());
      setTitleError(null);
      const t = window.setTimeout(() => titleInputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    } else {
      stopAudioRef.current?.();
      if (volumePreviewTimerRef.current !== null) {
        window.clearTimeout(volumePreviewTimerRef.current);
        volumePreviewTimerRef.current = null;
      }
      setPreviewingSoundId(null);
      setTitleError(null);
    }
  }, [isOpen, initialDraft]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const dateVal = toLocalDateInputValue(draft.triggerAt);
  const timeVal = toLocalTimeInputValue(draft.triggerAt);

  const upcomingPreview = useMemo(() => {
    return previewUpcomingOccurrences(draft.triggerAt, draft.recurrence, 3);
  }, [draft.triggerAt, draft.recurrence]);

  const handleDateOrTimeChange = (nextDate: string, nextTime: string) => {
    const iso = fromLocalDateAndTime(nextDate, nextTime);
    const d = new Date(iso);
    setDraft((prev) => ({
      ...prev,
      triggerAt: iso,
      recurrence: {
        ...prev.recurrence,
        dayOfMonth: d.getDate(),
        weekday: d.getDay(),
        nthWeek: Math.min(4, Math.ceil(d.getDate() / 7)),
      },
    }));
  };

  const applyQuickOffset = (minutesFromNow: number) => {
    const d = new Date(Date.now() + minutesFromNow * 60000);
    d.setSeconds(0, 0);
    setDraft((prev) => ({
      ...prev,
      triggerAt: d.toISOString(),
      recurrence: {
        ...prev.recurrence,
        dayOfMonth: d.getDate(),
        weekday: d.getDay(),
        nthWeek: Math.min(4, Math.ceil(d.getDate() / 7)),
      },
    }));
  };

  const applyTomorrowMorning = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    setDraft((prev) => ({
      ...prev,
      triggerAt: d.toISOString(),
      recurrence: {
        ...prev.recurrence,
        dayOfMonth: d.getDate(),
        weekday: d.getDay(),
        nthWeek: Math.min(4, Math.ceil(d.getDate() / 7)),
      },
    }));
  };

  const toggleWeekday = (dayIdx: number) => {
    setDraft((prev) => {
      const exists = prev.recurrence.weekdays.includes(dayIdx);
      let nextDays = exists
        ? prev.recurrence.weekdays.filter((d) => d !== dayIdx)
        : [...prev.recurrence.weekdays, dayIdx];
      if (nextDays.length === 0) {
        nextDays = [dayIdx];
      }
      return {
        ...prev,
        recurrence: {
          ...prev.recurrence,
          weekdays: nextDays.sort((a, b) => a - b),
        },
      };
    });
  };

  const handlePreviewSound = (
    presetId: SoundPresetId,
    options?: { toggleIfSame?: boolean; volumeOverride?: number }
  ) => {
    stopAudioRef.current?.();
    if (options?.toggleIfSame && previewingSoundId === presetId) {
      setPreviewingSoundId(null);
      return;
    }
    if (presetId === 'silent') {
      setPreviewingSoundId(null);
      return;
    }
    const vol = options?.volumeOverride ?? draft.sound.volume;
    if (vol <= 0) {
      setPreviewingSoundId(null);
      return;
    }
    setPreviewingSoundId(presetId);
    stopAudioRef.current = playReminderSound(presetId, vol, 1);
    window.setTimeout(() => {
      setPreviewingSoundId((curr) => (curr === presetId ? null : curr));
    }, 1300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) {
      setTitleError('Please enter a reminder title.');
      titleInputRef.current?.focus();
      return;
    }
    setTitleError(null);
    const parsedTrigger = new Date(draft.triggerAt);
    const safeTriggerAt = Number.isNaN(parsedTrigger.getTime())
      ? new Date(Date.now() + 30 * 60000).toISOString()
      : parsedTrigger.toISOString();
    const safeTargetCount =
      draft.recurrence.frequency === 'none'
        ? draft.recurrence.targetCount
        : draft.recurrence.targetCount === null || draft.recurrence.targetCount === 0
          ? null
          : Math.max(1, Math.min(365, Math.round(draft.recurrence.targetCount || 1)));
    stopAudioRef.current?.();
    onSave({
      ...draft,
      title: trimmedTitle,
      notes: draft.notes.trim(),
      location: draft.location?.trim() || undefined,
      triggerAt: safeTriggerAt,
      recurrence: {
        ...draft.recurrence,
        interval: Math.max(1, Math.min(12, Math.round(draft.recurrence.interval || 1))),
        dayOfMonth: Math.max(1, Math.min(31, Math.round(draft.recurrence.dayOfMonth || 1))),
        targetCount: safeTargetCount,
      },
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6">
          {/* Dimmed Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
            }}
            exit={{
              opacity: 0,
              transition: { duration: 0.14, ease: [0.2, 0, 0, 1] },
            }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/42 backdrop-blur-[2px]"
          />

          {/* Centered Popup Card + Ambient Liquid-Glass Aura */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
            }}
            exit={{
              opacity: 0,
              scale: 0.97,
              y: 6,
              transition: { duration: 0.14, ease: [0.2, 0, 0, 1] },
            }}
            className="relative z-10 w-full max-w-xl"
          >
            {/* Ambient edge aura glow around popup card (pure opacity/transform, never animates backdrop-filter) */}
            <div
              aria-hidden="true"
              className="qikki-modal-halo pointer-events-none absolute -inset-3 rounded-[30px] bg-gradient-to-br from-blue-400/26 via-sky-300/18 to-indigo-400/24 blur-2xl dark:from-blue-500/24 dark:via-cyan-400/14 dark:to-violet-500/22"
            />

            <section
              role="dialog"
              aria-modal="true"
              aria-label={draft.id ? 'Edit Reminder' : 'Schedule Reminder'}
              className="qikki-glass-card qikki-glass-modal relative flex max-h-[min(88vh,760px)] w-full flex-col overflow-hidden rounded-3xl border border-white/85 bg-white/76 shadow-[0_28px_72px_-16px_rgba(15,23,42,0.34),inset_0_1.5px_0_rgba(255,255,255,0.96)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/66 dark:shadow-[0_32px_80px_-14px_rgba(0,0,0,0.82),inset_0_1.5px_0_rgba(255,255,255,0.24)]"
            >
              <div className="flex items-center justify-between border-b border-slate-900/[0.08] px-4 py-3.5 sm:px-6 sm:py-4 dark:border-white/[0.09]">
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  {draft.id ? 'Edit Reminder' : 'Schedule Reminder'}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close popup"
                  className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-900/10 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                noValidate
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
                {/* Title & Notes */}
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="reminder-title"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                    >
                      Reminder Title
                    </label>
                    <input
                      ref={titleInputRef}
                      id="reminder-title"
                      type="text"
                      required
                      value={draft.title}
                      onChange={(e) => {
                        if (titleError) setTitleError(null);
                        setDraft((p) => ({ ...p, title: e.target.value }));
                      }}
                      placeholder="e.g. Monthly server backup check"
                      aria-invalid={Boolean(titleError)}
                      className={`mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none dark:bg-slate-900 dark:text-slate-100 ${
                        titleError
                          ? 'border-red-500 focus:border-red-600 dark:border-red-400'
                          : 'border-slate-200 focus:border-blue-600 dark:border-slate-700 dark:focus:border-blue-500'
                      }`}
                    />
                    {titleError && (
                      <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                        {titleError}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="reminder-notes"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                    >
                      Notes (optional)
                    </label>
                    <textarea
                      id="reminder-notes"
                      rows={2}
                      value={draft.notes}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, notes: e.target.value }))
                      }
                      placeholder="Add context, links, or checklist details..."
                      className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reminder-location"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                    >
                      Location (optional)
                    </label>
                    <div className="relative mt-1.5">
                      <MapPin
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                        aria-hidden="true"
                      />
                      <input
                        id="reminder-location"
                        type="text"
                        value={draft.location || ''}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, location: e.target.value }))
                        }
                        placeholder="e.g. Conference Room B, 123 Main St, or Online / Zoom"
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="space-y-2.5 border-t border-slate-100 pt-5 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      <CalendarClock
                        className="h-4 w-4 text-slate-500"
                        aria-hidden="true"
                      />
                      <span>Date &amp; Time</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyQuickOffset(5)}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        +5m
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickOffset(15)}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        +15m
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickOffset(60)}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        +1h
                      </button>
                      <button
                        type="button"
                        onClick={applyTomorrowMorning}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        9 AM Tmrw
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                    <input
                      type="date"
                      value={dateVal}
                      onChange={(e) =>
                        handleDateOrTimeChange(e.target.value, timeVal)
                      }
                      aria-label="Date"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <input
                      type="time"
                      value={timeVal}
                      onChange={(e) =>
                        handleDateOrTimeChange(dateVal, e.target.value)
                      }
                      aria-label="Time"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Recurrence */}
                <div className="space-y-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Recurrence
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatRecurrenceSummary(draft.recurrence)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
                    {(
                      [
                        { id: 'none', label: 'One-Time' },
                        { id: 'weekly', label: 'Weekly' },
                        { id: 'monthly', label: 'Monthly' },
                      ] as { id: RecurrenceFrequency; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setDraft((p) => {
                            const nextRule = {
                              ...p.recurrence,
                              frequency: opt.id,
                            };
                            if (p.recurrence.frequency === 'none' && opt.id !== 'none') {
                              nextRule.targetCount = getDefaultTargetCount(nextRule);
                            }
                            return { ...p, recurrence: nextRule };
                          })
                        }
                        className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                          draft.recurrence.frequency === opt.id
                            ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {draft.recurrence.frequency === 'weekly' && (
                    <div className="space-y-3 rounded-lg bg-slate-50 p-3.5 dark:bg-slate-900/70">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Repeat on days
                        </span>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <span>Every</span>
                          <input
                            type="number"
                            min={1}
                            max={12}
                            value={draft.recurrence.interval}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                recurrence: {
                                  ...p.recurrence,
                                  interval: Math.max(1, Number(e.target.value) || 1),
                                },
                              }))
                            }
                            className="w-12 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-center font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          />
                          <span>week(s)</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-7 gap-1.5">
                        {WEEKDAY_LABELS.map((day) => {
                          const selected =
                            draft.recurrence.weekdays.includes(day.idx);
                          return (
                            <button
                              key={day.idx}
                              type="button"
                              onClick={() => toggleWeekday(day.idx)}
                              className={`rounded-md py-2 text-xs font-medium transition-colors ${
                                selected
                                  ? 'qikki-accent-btn'
                                  : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                              }`}
                            >
                              {day.short}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-slate-200/60 pt-3 dark:border-slate-800">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Max times per month
                        </span>
                        <div className="flex items-center gap-1.5">
                          {[null, 1, 2, 4].map((limitVal) => {
                            const active =
                              (draft.recurrence.monthlyLimit ?? null) ===
                              limitVal;
                            return (
                              <button
                                key={String(limitVal)}
                                type="button"
                                onClick={() =>
                                  setDraft((p) => ({
                                    ...p,
                                    recurrence: {
                                      ...p.recurrence,
                                      monthlyLimit: limitVal,
                                    },
                                  }))
                                }
                                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                                  active
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                }`}
                              >
                                {limitVal === null ? 'Unlimited' : `${limitVal}x`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {draft.recurrence.frequency === 'monthly' && (
                    <div className="space-y-3 rounded-lg bg-slate-50 p-3.5 dark:bg-slate-900/70">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Monthly rule
                        </span>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <span>Every</span>
                          <input
                            type="number"
                            min={1}
                            max={12}
                            value={draft.recurrence.interval}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                recurrence: {
                                  ...p.recurrence,
                                  interval: Math.max(1, Number(e.target.value) || 1),
                                },
                              }))
                            }
                            className="w-12 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-center font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          />
                          <span>month(s)</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: 'day-of-month', label: 'Day of Month' },
                            { id: 'nth-weekday', label: 'Nth Weekday' },
                            { id: 'last-day', label: 'Last Day' },
                          ] as { id: MonthlyMode; label: string }[]
                        ).map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() =>
                              setDraft((p) => ({
                                ...p,
                                recurrence: {
                                  ...p.recurrence,
                                  monthlyMode: mode.id,
                                },
                              }))
                            }
                            className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                              draft.recurrence.monthlyMode === mode.id
                                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>

                      {draft.recurrence.monthlyMode === 'day-of-month' && (
                        <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                          <span>Day of month (1–31)</span>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={draft.recurrence.dayOfMonth}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                recurrence: {
                                  ...p.recurrence,
                                  dayOfMonth: Math.min(
                                    31,
                                    Math.max(1, Number(e.target.value) || 1)
                                  ),
                                },
                              }))
                            }
                            className="w-16 rounded border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </label>
                      )}

                      <div className="flex items-center justify-between gap-2 border-t border-slate-200/60 pt-3 dark:border-slate-800">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Max times per month
                        </span>
                        <div className="flex items-center gap-1.5">
                          {[null, 1, 2, 4].map((limitVal) => {
                            const active =
                              (draft.recurrence.monthlyLimit ?? null) ===
                              limitVal;
                            return (
                              <button
                                key={String(limitVal)}
                                type="button"
                                onClick={() =>
                                  setDraft((p) => ({
                                    ...p,
                                    recurrence: {
                                      ...p.recurrence,
                                      monthlyLimit: limitVal,
                                    },
                                  }))
                                }
                                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                                  active
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                }`}
                              >
                                {limitVal === null ? 'Unlimited' : `${limitVal}x`}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {draft.recurrence.monthlyMode === 'nth-weekday' && (
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            aria-label="Week occurrence"
                            value={draft.recurrence.nthWeek}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                recurrence: {
                                  ...p.recurrence,
                                  nthWeek: Number(e.target.value),
                                },
                              }))
                            }
                            className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          >
                            <option value={1}>1st</option>
                            <option value={2}>2nd</option>
                            <option value={3}>3rd</option>
                            <option value={4}>4th</option>
                            <option value={-1}>Last</option>
                          </select>
                          <select
                            aria-label="Weekday"
                            value={draft.recurrence.weekday}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                recurrence: {
                                  ...p.recurrence,
                                  weekday: Number(e.target.value),
                                },
                              }))
                            }
                            className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {WEEKDAY_LABELS.map((d) => (
                              <option key={d.idx} value={d.idx}>
                                {d.short}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {draft.recurrence.frequency !== 'none' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3.5 py-2.5 dark:bg-slate-900/70">
                      <div>
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          How long this event keeps going
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Choose duration limit or ♾️ for ongoing
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {([4, 8, 12, 24, null] as (number | null)[]).map((presetNum) => {
                          const isSelected =
                            presetNum === null
                              ? draft.recurrence.targetCount === null || draft.recurrence.targetCount === 0
                              : draft.recurrence.targetCount === presetNum;
                          return (
                            <button
                              key={presetNum === null ? 'unlimited' : presetNum}
                              type="button"
                              onClick={() =>
                                setDraft((p) => ({
                                  ...p,
                                  recurrence: {
                                    ...p.recurrence,
                                    targetCount: presetNum,
                                  },
                                }))
                              }
                              title={
                                presetNum === null
                                  ? 'Ongoing / Unlimited'
                                  : `${presetNum} occurrences`
                              }
                              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                presetNum === null ? 'text-sm font-bold' : 'font-mono'
                              } ${
                                isSelected
                                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                  : 'bg-white text-slate-600 hover:bg-slate-200/70 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {presetNum === null ? '♾️' : presetNum}
                            </button>
                          );
                        })}
                        {draft.recurrence.targetCount !== null &&
                          draft.recurrence.targetCount !== 0 && (
                          <input
                            type="number"
                            min={1}
                            max={365}
                            aria-label="Custom occurrences"
                            value={
                              draft.recurrence.targetCount ??
                              getDefaultTargetCount(draft.recurrence)
                            }
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                recurrence: {
                                  ...p.recurrence,
                                  targetCount: Math.max(
                                    1,
                                    Math.min(365, Number(e.target.value) || 1)
                                  ),
                                },
                              }))
                            }
                            className="w-14 rounded border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {upcomingPreview.length > 0 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <span>Next dates: </span>
                      <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {upcomingPreview
                          .map((d) =>
                            d.toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })
                          )
                          .join(' · ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sound Options */}
                <div className="space-y-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      <Volume2
                        className="h-4 w-4 text-slate-500"
                        aria-hidden="true"
                      />
                      <span>Reminder Sound</span>
                    </span>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Repeat</span>
                      {([1, 2, 3] as const).map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() =>
                            setDraft((p) => ({
                              ...p,
                              sound: { ...p.sound, repeatCount: cnt },
                            }))
                          }
                          className={`rounded px-2 py-0.5 font-mono text-xs font-medium ${
                            draft.sound.repeatCount === cnt
                              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {cnt}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {SOUND_PRESETS.map((preset) => {
                      const selected = draft.sound.presetId === preset.id;
                      const isPlaying = previewingSoundId === preset.id;
                      return (
                        <div
                          key={preset.id}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                            selected
                              ? 'border-blue-600 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/40'
                              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setDraft((p) => ({
                                ...p,
                                sound: { ...p.sound, presetId: preset.id },
                              }));
                              handlePreviewSound(preset.id);
                            }}
                            className="flex-1 text-left"
                          >
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {preset.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {preset.description}
                            </div>
                          </button>

                          {preset.id !== 'silent' && (
                            <button
                              type="button"
                              onClick={() =>
                                handlePreviewSound(preset.id, {
                                  toggleIfSame: true,
                                })
                              }
                              aria-label={`Preview ${preset.name}`}
                              className="ml-2 rounded-md p-1.5 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              {isPlaying ? (
                                <Square
                                  className="h-3 w-3 fill-current text-blue-600"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Play
                                  className="h-3 w-3 fill-current"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {draft.sound.presetId !== 'silent' && (
                    <label className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                      <span className="w-14">Volume</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={draft.sound.volume}
                        onChange={(e) => {
                          const nextVol = Number(e.target.value);
                          const currentPreset = draft.sound.presetId;
                          setDraft((p) => ({
                            ...p,
                            sound: {
                              ...p.sound,
                              volume: nextVol,
                            },
                          }));
                          if (volumePreviewTimerRef.current !== null) {
                            window.clearTimeout(volumePreviewTimerRef.current);
                          }
                          if (currentPreset === 'silent' || nextVol <= 0) {
                            stopAudioRef.current?.();
                            setPreviewingSoundId(null);
                            return;
                          }
                          volumePreviewTimerRef.current = window.setTimeout(() => {
                            handlePreviewSound(currentPreset, {
                              volumeOverride: nextVol,
                            });
                            volumePreviewTimerRef.current = null;
                          }, 150);
                        }}
                        className="flex-1 accent-blue-600"
                      />
                      <span className="w-10 text-right font-mono tabular-nums">
                        {Math.round(draft.sound.volume * 100)}%
                      </span>
                    </label>
                  )}
                </div>

                {/* Custom Vibration Pattern */}
                <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
                  <VibrationPatternEditor
                    value={draft.vibration}
                    onChange={(nextVib) =>
                      setDraft((p) => ({ ...p, vibration: nextVib }))
                    }
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-900/[0.08] bg-white/45 px-4 py-3.5 backdrop-blur-md sm:px-6 sm:py-4 dark:border-white/[0.09] dark:bg-white/[0.03]">
                {draft.id && (onDeleteEvent || onDeleteRepeatingUpcoming) && (
                  <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-900/[0.07] pb-3 dark:border-white/[0.08]">
                    {onDeleteEvent && (
                      <button
                        type="button"
                        onClick={() => {
                          stopAudioRef.current?.();
                          if (draft.id) onDeleteEvent(draft.id);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/80 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/12 dark:text-red-300 dark:hover:bg-red-500/22"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Delete event</span>
                      </button>
                    )}

                    {onDeleteRepeatingUpcoming && (
                      <button
                        type="button"
                        disabled={draft.recurrence.frequency === 'none'}
                        title={
                          draft.recurrence.frequency !== 'none'
                            ? 'Delete this and all repeating upcoming events'
                            : 'Only available for repeating events'
                        }
                        onClick={() => {
                          stopAudioRef.current?.();
                          if (draft.id && draft.recurrence.frequency !== 'none') {
                            onDeleteRepeatingUpcoming(draft.id);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/80 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100/70 disabled:text-slate-400 dark:border-red-500/25 dark:bg-red-500/12 dark:text-red-300 dark:hover:bg-red-500/22 dark:disabled:border-white/10 dark:disabled:bg-white/[0.04] dark:disabled:text-slate-500"
                      >
                        <CalendarX2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Delete repeating upcoming event</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-900/12 bg-white/75 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.13]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!draft.title.trim()}
                    className="qikki-accent-btn rounded-lg px-5 py-2 text-sm font-medium transition-colors disabled:opacity-40"
                  >
                    {draft.id ? 'Save Changes' : 'Save Reminder'}
                  </button>
                </div>
              </div>
              </form>
            </section>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
