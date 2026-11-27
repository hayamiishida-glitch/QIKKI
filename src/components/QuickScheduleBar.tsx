import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Repeat, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import type { RecurrenceFrequency, SoundPresetId } from '../types/reminder';
import {
  playReminderSound,
  SOUND_PRESETS,
  unlockAudioEngine,
} from '../services/soundEngine';
import {
  formatScheduleDateTime,
  fromLocalDateAndTime,
  toLocalDateInputValue,
  toLocalTimeInputValue,
} from '../utils/recurrence';

interface QuickScheduleBarProps {
  defaultSoundPreset?: SoundPresetId;
  defaultSoundVolume?: number;
  onQuickCreate: (payload: {
    title: string;
    triggerAt: string;
    frequency: RecurrenceFrequency;
    soundPreset: SoundPresetId;
    soundVolume: number;
  }) => void;
  onOpenDetailedComposer: (prefill: {
    title: string;
    triggerAt: string;
    frequency: RecurrenceFrequency;
    soundPreset: SoundPresetId;
    soundVolume: number;
  }) => void;
}

type QuickTimeKey = '15m' | '1h' | 'tonight' | 'tomorrow' | 'custom';

function computePresetIso(key: QuickTimeKey): string {
  const now = new Date();
  if (key === '15m') {
    const d = new Date(now.getTime() + 15 * 60000);
    d.setSeconds(0, 0);
    return d.toISOString();
  }
  if (key === '1h') {
    const d = new Date(now.getTime() + 60 * 60000);
    d.setSeconds(0, 0);
    return d.toISOString();
  }
  if (key === 'tonight') {
    const d = new Date(now);
    d.setHours(20, 0, 0, 0);
    if (d.getTime() <= now.getTime()) {
      d.setDate(d.getDate() + 1);
    }
    return d.toISOString();
  }
  const tmr = new Date(now);
  tmr.setDate(now.getDate() + 1);
  tmr.setHours(9, 0, 0, 0);
  return tmr.toISOString();
}

export const QuickScheduleBar: React.FC<QuickScheduleBarProps> = ({
  defaultSoundPreset = 'ios-tri-tone',
  defaultSoundVolume = 0.85,
  onQuickCreate,
  onOpenDetailedComposer,
}) => {
  const [title, setTitle] = useState('');
  const [timeKey, setTimeKey] = useState<QuickTimeKey>('15m');
  const [customIso, setCustomIso] = useState<string>(() =>
    computePresetIso('1h')
  );
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('none');
  const [soundPreset, setSoundPreset] =
    useState<SoundPresetId>(defaultSoundPreset);
  const [soundVolume, setSoundVolume] = useState<number>(defaultSoundVolume);

  useEffect(() => {
    setSoundPreset(defaultSoundPreset);
  }, [defaultSoundPreset]);

  useEffect(() => {
    setSoundVolume(defaultSoundVolume);
  }, [defaultSoundVolume]);

  const stopPreviewRef = useRef<(() => void) | null>(null);
  const volumePreviewTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopPreviewRef.current?.();
      if (volumePreviewTimerRef.current !== null) {
        window.clearTimeout(volumePreviewTimerRef.current);
      }
    };
  }, []);

  const previewTone = (preset: SoundPresetId, vol: number) => {
    stopPreviewRef.current?.();
    if (preset === 'silent' || vol <= 0) return;
    unlockAudioEngine();
    stopPreviewRef.current = playReminderSound(preset, vol, 1);
  };

  const resolvedTriggerAt = useMemo(
    () => (timeKey === 'custom' ? customIso : computePresetIso(timeKey)),
    [timeKey, customIso]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onQuickCreate({
      title: trimmed,
      triggerAt: timeKey === 'custom' ? customIso : computePresetIso(timeKey),
      frequency,
      soundPreset,
      soundVolume,
    });
    setTitle('');
  };

  const handleSelectSound = (nextPreset: SoundPresetId) => {
    setSoundPreset(nextPreset);
    if (nextPreset === 'silent') {
      stopPreviewRef.current?.();
      return;
    }
    const effectiveVol = soundVolume <= 0 ? 0.5 : soundVolume;
    if (soundVolume <= 0) {
      setSoundVolume(effectiveVol);
    }
    previewTone(nextPreset, effectiveVol);
  };

  const handleVolumeChange = (nextVol: number) => {
    setSoundVolume(nextVol);
    if (volumePreviewTimerRef.current !== null) {
      window.clearTimeout(volumePreviewTimerRef.current);
    }
    if (soundPreset === 'silent' || nextVol <= 0) {
      stopPreviewRef.current?.();
      return;
    }
    volumePreviewTimerRef.current = window.setTimeout(() => {
      previewTone(soundPreset, nextVol);
      volumePreviewTimerRef.current = null;
    }, 150);
  };

  const isMutedOrSilent = soundPreset === 'silent' || soundVolume <= 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="qikki-glass-card rounded-2xl border border-white/60 bg-white/78 p-4 shadow-[0_14px_38px_-14px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl backdrop-saturate-150 transition-[border-color,box-shadow] duration-150 focus-within:border-blue-400/70 focus-within:ring-2 focus-within:ring-blue-500/15 dark:border-white/[0.12] dark:bg-slate-900/46 dark:shadow-[0_18px_44px_-14px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.12)] dark:focus-within:border-blue-400/50"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Quick reminder — e.g. Stand-up call, Pay invoice, Stretch..."
          aria-label="Quick reminder title"
          className="min-w-0 flex-1 bg-transparent py-1 text-base font-medium text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-white dark:placeholder:text-slate-400/80"
        />

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              onOpenDetailedComposer({
                title: title.trim(),
                triggerAt: resolvedTriggerAt,
                frequency,
                soundPreset,
                soundVolume,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/10 bg-white/60 px-3 py-2 text-xs font-medium text-slate-700 backdrop-blur-sm transition-colors hover:bg-white/90 hover:text-slate-950 whitespace-nowrap shrink-0 dark:border-white/12 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.12] dark:hover:text-white"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Customize</span>
          </button>

          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            Schedule
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-900/[0.07] pt-3 dark:border-white/[0.09]">
        {/* Quick time presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: '15m', label: 'In 15m' },
              { key: '1h', label: 'In 1h' },
              { key: 'tonight', label: 'Tonight 20:00' },
              { key: 'tomorrow', label: 'Tomorrow 09:00' },
              { key: 'custom', label: 'Custom' },
            ] as { key: QuickTimeKey; label: string }[]
          ).map((item) => {
            const active = timeKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTimeKey(item.key)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-900/[0.06] text-slate-700 hover:bg-slate-900/[0.11] hover:text-slate-950 dark:bg-white/[0.07] dark:text-slate-300 dark:hover:bg-white/[0.13] dark:hover:text-white'
                }`}
              >
                {item.key === 'custom' && (
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                )}
                <span>{item.label}</span>
              </button>
            );
          })}

          <span className="hidden pl-1.5 font-mono text-[11px] tabular-nums text-slate-500 xl:inline dark:text-slate-400">
            {formatScheduleDateTime(resolvedTriggerAt)}
          </span>
        </div>

        {/* Recurrence & Sound + Volume tidy quick selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Quick recurrence"
            className="inline-flex items-center rounded-lg bg-slate-900/[0.06] p-0.5 dark:bg-white/[0.07]"
          >
            {(
              [
                { id: 'none', label: 'Once' },
                { id: 'weekly', label: 'Weekly' },
                { id: 'monthly', label: 'Monthly' },
              ] as { id: RecurrenceFrequency; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFrequency(opt.id)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  frequency === opt.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.16] dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300/80 dark:hover:text-white'
                }`}
              >
                {opt.id !== 'none' && (
                  <Repeat className="h-3 w-3" aria-hidden="true" />
                )}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Tidy Sound Picker + Inline Volume */}
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-900/10 bg-white/65 px-2 py-1 backdrop-blur-sm dark:border-white/12 dark:bg-white/[0.06]">
            <button
              type="button"
              onClick={() => previewTone(soundPreset, soundVolume)}
              disabled={isMutedOrSilent}
              title={
                isMutedOrSilent
                  ? 'Sound muted'
                  : 'Preview selected reminder sound'
              }
              aria-label="Preview selected reminder sound"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-blue-600 transition-colors hover:bg-blue-500/10 disabled:opacity-45 dark:text-blue-400 dark:hover:bg-blue-400/15"
            >
              {isMutedOrSilent ? (
                <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>

            <select
              aria-label="Reminder sound"
              value={soundPreset}
              onChange={(e) =>
                handleSelectSound(e.target.value as SoundPresetId)
              }
              className="max-w-[122px] cursor-pointer bg-transparent pr-1 text-xs font-medium text-slate-800 focus:outline-none dark:text-slate-100 [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
            >
              {SOUND_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>

            <span
              aria-hidden="true"
              className="h-3.5 w-px shrink-0 bg-slate-900/12 dark:bg-white/15"
            />

            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={soundPreset === 'silent' ? 0 : soundVolume}
                disabled={soundPreset === 'silent'}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                aria-label="Reminder volume"
                title={`Volume: ${
                  soundPreset === 'silent' ? 0 : Math.round(soundVolume * 100)
                }%`}
                className="h-1 w-14 cursor-pointer accent-blue-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-16"
              />
              <span className="w-7 text-right font-mono text-[10px] font-medium tabular-nums text-slate-600 dark:text-slate-300">
                {soundPreset === 'silent' ? '0%' : `${Math.round(soundVolume * 100)}%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {timeKey === 'custom' && (
        <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-slate-900/[0.07] pt-3 dark:border-white/[0.09]">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Exact time
          </span>
          <input
            type="date"
            value={toLocalDateInputValue(customIso)}
            onChange={(e) =>
              setCustomIso(
                fromLocalDateAndTime(
                  e.target.value,
                  toLocalTimeInputValue(customIso)
                )
              )
            }
            aria-label="Reminder date"
            className="rounded-lg border border-slate-900/12 bg-white/70 px-2.5 py-1.5 font-mono text-xs text-slate-800 focus:border-blue-600 focus:outline-none dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-100"
          />
          <input
            type="time"
            value={toLocalTimeInputValue(customIso)}
            onChange={(e) =>
              setCustomIso(
                fromLocalDateAndTime(
                  toLocalDateInputValue(customIso),
                  e.target.value
                )
              )
            }
            aria-label="Reminder time"
            className="rounded-lg border border-slate-900/12 bg-white/70 px-2.5 py-1.5 font-mono text-xs text-slate-800 focus:border-blue-600 focus:outline-none dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-100"
          />
        </div>
      )}
    </form>
  );
};
