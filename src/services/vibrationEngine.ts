import type { VibrationConfig } from '../types/reminder';

export const VIBRATION_PRESETS: VibrationConfig[] = [
  {
    presetId: 'double-pulse',
    label: 'Double Pulse',
    pattern: [160, 90, 160],
  },
  {
    presetId: 'gentle-tap',
    label: 'Gentle Tap',
    pattern: [110],
  },
  {
    presetId: 'heartbeat',
    label: 'Heartbeat',
    pattern: [90, 70, 210, 260, 90, 70, 210],
  },
  {
    presetId: 'staccato',
    label: 'Staccato',
    pattern: [70, 60, 70, 60, 70, 60, 180],
  },
  {
    presetId: 'long-buzz',
    label: 'Long Buzz',
    pattern: [450],
  },
  {
    presetId: 'none',
    label: 'Off',
    pattern: [],
  },
];

export function supportsHardwareVibration(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  );
}

/**
 * Triggers hardware vibration when supported (e.g. Android/mobile browsers)
 * AND executes a precise timeline callback for visual/haptic feedback on Windows desktops.
 */
export function triggerVibrationPattern(
  pattern: number[],
  onStep?: (isPulsing: boolean, stepIndex: number) => void
): () => void {
  if (!pattern || pattern.length === 0) {
    onStep?.(false, -1);
    return () => {};
  }

  if (supportsHardwareVibration()) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore if blocked by browser policy
    }
  }

  let cancelled = false;
  const timers: number[] = [];
  let elapsed = 0;

  pattern.forEach((durationMs, idx) => {
    const isPulse = idx % 2 === 0;
    const t = window.setTimeout(() => {
      if (!cancelled) {
        onStep?.(isPulse, idx);
      }
    }, elapsed);
    timers.push(t);
    elapsed += Math.max(20, durationMs);
  });

  const endTimer = window.setTimeout(() => {
    if (!cancelled) {
      onStep?.(false, -1);
    }
  }, elapsed);
  timers.push(endTimer);

  return () => {
    cancelled = true;
    timers.forEach((t) => window.clearTimeout(t));
    if (supportsHardwareVibration()) {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignore
      }
    }
    onStep?.(false, -1);
  };
}

export function formatVibrationSummary(config: VibrationConfig): string {
  if (!config.pattern || config.pattern.length === 0) {
    return 'Vibration Off';
  }
  const pulses = config.pattern.filter((_, i) => i % 2 === 0);
  if (config.presetId !== 'custom') {
    return `${config.label} (${pulses.join('·')}ms)`;
  }
  return `Custom (${config.pattern.join('·')}ms)`;
}
