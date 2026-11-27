import React, { useEffect, useRef, useState } from 'react';
import { Play, Plus, Square, Trash2, Vibrate } from 'lucide-react';
import type { VibrationConfig } from '../types/reminder';
import {
  supportsHardwareVibration,
  triggerVibrationPattern,
  VIBRATION_PRESETS,
} from '../services/vibrationEngine';

interface VibrationPatternEditorProps {
  value: VibrationConfig;
  onChange: (next: VibrationConfig) => void;
}

export const VibrationPatternEditor: React.FC<VibrationPatternEditorProps> = ({
  value,
  onChange,
}) => {
  const [isTesting, setIsTesting] = useState(false);
  const [isPulsingNow, setIsPulsingNow] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedTimes, setRecordedTimes] = useState<
    { down: number; up: number }[]
  >([]);
  const pressStartRef = useRef<number | null>(null);
  const stopTestRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      stopTestRef.current?.();
    };
  }, []);

  const handleSelectPreset = (preset: VibrationConfig) => {
    stopTestRef.current?.();
    setIsTesting(false);
    onChange({
      presetId: preset.presetId,
      label: preset.label,
      pattern: [...preset.pattern],
    });
  };

  const handleTest = () => {
    if (isTesting) {
      stopTestRef.current?.();
      setIsTesting(false);
      setIsPulsingNow(false);
      setActiveStepIndex(-1);
      return;
    }

    if (value.pattern.length === 0) return;

    setIsTesting(true);
    const totalMs = value.pattern.reduce((a, b) => a + Math.max(20, b), 0);

    stopTestRef.current = triggerVibrationPattern(
      value.pattern,
      (pulsing, stepIdx) => {
        setIsPulsingNow(pulsing);
        setActiveStepIndex(stepIdx);
      }
    );

    window.setTimeout(() => {
      setIsTesting(false);
      setIsPulsingNow(false);
      setActiveStepIndex(-1);
    }, totalMs + 60);
  };

  const handleUpdateStep = (index: number, ms: number) => {
    const clamped = Math.max(30, Math.min(1200, Math.round(ms)));
    const next = [...value.pattern];
    next[index] = clamped;
    onChange({
      presetId: 'custom',
      label: 'Custom Pattern',
      pattern: next,
    });
  };

  const handleAddPulse = () => {
    const next =
      value.pattern.length === 0
        ? [150]
        : value.pattern.length % 2 === 1
          ? [...value.pattern, 100, 150]
          : [...value.pattern, 150];
    onChange({
      presetId: 'custom',
      label: 'Custom Pattern',
      pattern: next.slice(0, 11),
    });
  };

  const handleRemoveLastPulse = () => {
    if (value.pattern.length <= 1) {
      onChange({
        presetId: 'none',
        label: 'Off',
        pattern: [],
      });
      return;
    }
    const next =
      value.pattern.length >= 3
        ? value.pattern.slice(0, value.pattern.length - 2)
        : value.pattern.slice(0, 1);
    onChange({
      presetId: 'custom',
      label: 'Custom Pattern',
      pattern: next,
    });
  };

  const startTapRecording = () => {
    setIsRecording(true);
    setRecordedTimes([]);
    pressStartRef.current = null;
  };

  const finishTapRecording = () => {
    setIsRecording(false);
    if (recordedTimes.length === 0) return;
    const pattern: number[] = [];
    recordedTimes.forEach((seg, idx) => {
      if (idx > 0) {
        const pause = Math.max(40, Math.min(800, Math.round(seg.down - recordedTimes[idx - 1].up)));
        pattern.push(pause);
      }
      const dur = Math.max(50, Math.min(900, Math.round(seg.up - seg.down)));
      pattern.push(dur);
    });
    if (pattern.length > 0) {
      onChange({
        presetId: 'custom',
        label: 'Custom Pattern',
        pattern: pattern.slice(0, 11),
      });
    }
    setRecordedTimes([]);
  };

  const handlePadDown = () => {
    if (!isRecording) return;
    pressStartRef.current = performance.now();
  };

  const handlePadUp = () => {
    if (!isRecording || pressStartRef.current === null) return;
    const up = performance.now();
    const down = pressStartRef.current;
    pressStartRef.current = null;
    setRecordedTimes((prev) => [...prev, { down, up }]);
  };

  const hardwareSupported = supportsHardwareVibration();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Vibration Pattern
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {hardwareSupported
              ? 'Hardware haptics active on this device'
              : 'Visual pulse preview on Windows · Haptics active on mobile'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleTest}
          disabled={value.pattern.length === 0}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 ${
            isTesting
              ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {isTesting ? (
            <>
              <Square className="h-3 w-3 fill-current" aria-hidden="true" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3 fill-current" aria-hidden="true" />
              <span>Test Pattern</span>
            </>
          )}
        </button>
      </div>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        {VIBRATION_PRESETS.map((preset) => {
          const active = value.presetId === preset.presetId;
          return (
            <button
              key={preset.presetId}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Live Haptic Simulator Bar + Custom Sequence */}
      <div
        className={`rounded-lg bg-slate-50 p-3.5 transition-transform dark:bg-slate-900/70 ${
          isPulsingNow ? 'animate-haptic ring-1 ring-blue-500' : ''
        }`}
      >
        {value.pattern.length === 0 ? (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Vibration disabled for this reminder.
            </span>
            <button
              type="button"
              onClick={handleAddPulse}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add Pulse</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Visual Waveform Timeline */}
            <div className="flex items-center gap-1 overflow-x-auto py-1">
              {value.pattern.map((ms, idx) => {
                const isPulse = idx % 2 === 0;
                const isCurrent = activeStepIndex === idx;
                const widthPx = Math.max(24, Math.min(84, Math.round(ms / 6)));
                return (
                  <div
                    key={`${idx}-${isPulse ? 'v' : 'p'}`}
                    style={{ width: `${widthPx}px` }}
                    className={`flex h-7 shrink-0 items-center justify-center rounded text-[11px] font-mono tabular-nums transition-colors ${
                      isPulse
                        ? isCurrent
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : isCurrent
                          ? 'bg-slate-300 text-slate-900 dark:bg-slate-700 dark:text-white'
                          : 'bg-slate-200/80 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                    title={isPulse ? `Vibrate ${ms}ms` : `Pause ${ms}ms`}
                  >
                    {ms}
                  </div>
                );
              })}
            </div>

            {/* Numeric step fine-tuning */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {value.pattern.map((ms, idx) => {
                const isPulse = idx % 2 === 0;
                return (
                  <label
                    key={`input-${idx}`}
                    className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <span className="text-slate-500 dark:text-slate-400">
                      {isPulse ? `Pulse ${Math.floor(idx / 2) + 1}` : `Pause ${Math.floor(idx / 2) + 1}`}
                    </span>
                    <input
                      type="number"
                      min={30}
                      max={1200}
                      step={1}
                      value={ms}
                      onChange={(e) => handleUpdateStep(idx, Number(e.target.value))}
                      className="w-14 bg-transparent text-right font-mono text-xs font-medium text-slate-900 tabular-nums focus:outline-none dark:text-slate-100"
                    />
                  </label>
                );
              })}
            </div>

            {/* Controls: Add / Remove / Tap Rhythm */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddPulse}
                  disabled={value.pattern.length >= 11}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40 dark:text-blue-400"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Add Pulse</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveLastPulse}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Trim</span>
                </button>
              </div>

              {!isRecording ? (
                <button
                  type="button"
                  onClick={startTapRecording}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                >
                  <Vibrate className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tap Custom Rhythm</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onMouseDown={handlePadDown}
                    onMouseUp={handlePadUp}
                    onTouchStart={handlePadDown}
                    onTouchEnd={handlePadUp}
                    className="qikki-accent-btn rounded-md px-3 py-1 text-xs font-medium active:scale-95"
                  >
                    Tap / Hold Here ({recordedTimes.length})
                  </button>
                  <button
                    type="button"
                    onClick={finishTapRecording}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
