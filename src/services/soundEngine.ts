import type { SoundPresetId } from '../types/reminder';

export interface SoundPresetMeta {
  id: SoundPresetId;
  name: string;
  description: string;
  durationMs: number;
}

export const SOUND_PRESETS: SoundPresetMeta[] = [
  {
    id: 'ios-tri-tone',
    name: 'iOS Tri-Tone',
    description: 'Classic bright three-note iOS chime',
    durationMs: 780,
  },
  {
    id: 'ios-note',
    name: 'iOS Note',
    description: 'Clean single glassy iOS alert ping',
    durationMs: 560,
  },
  {
    id: 'ios-chime',
    name: 'iOS Chime',
    description: 'Gentle Apple-style two-step chord',
    durationMs: 760,
  },
  {
    id: 'ios-bamboo',
    name: 'iOS Bamboo',
    description: 'Crisp wooden percussive double tap',
    durationMs: 520,
  },
  {
    id: 'ios-aurora',
    name: 'iOS Aurora',
    description: 'Airy sparkling iOS glass arpeggio',
    durationMs: 920,
  },
  {
    id: 'ios-pulse',
    name: 'iOS Pulse',
    description: 'Rhythmic crystalline iOS double beat',
    durationMs: 680,
  },
  {
    id: 'crystal-chime',
    name: 'Crystal Chime',
    description: 'Warm three-note harmonic bell',
    durationMs: 950,
  },
  {
    id: 'soft-pulse',
    name: 'Soft Pulse',
    description: 'Gentle marimba-like double tap',
    durationMs: 550,
  },
  {
    id: 'beacon-tone',
    name: 'Beacon Tone',
    description: 'Crisp ascending two-tone alert',
    durationMs: 700,
  },
  {
    id: 'zen-gong',
    name: 'Zen Gong',
    description: 'Deep resonant studio chime',
    durationMs: 1400,
  },
  {
    id: 'digital-ping',
    name: 'Digital Ping',
    description: 'Clean high-clarity notification',
    durationMs: 420,
  },
  {
    id: 'aurora-harp',
    name: 'Aurora Harp',
    description: 'Flowing four-note harp arpeggio',
    durationMs: 1150,
  },
  {
    id: 'amber-marimba',
    name: 'Amber Marimba',
    description: 'Mellow wooden harmonic cadence',
    durationMs: 780,
  },
  {
    id: 'dewdrop-bell',
    name: 'Dewdrop Bell',
    description: 'Liquid water-drop shimmer tone',
    durationMs: 850,
  },
  {
    id: 'horizon-chord',
    name: 'Horizon Chord',
    description: 'Soft ambient synth fifth swell',
    durationMs: 1250,
  },
  {
    id: 'brisk-triad',
    name: 'Brisk Triad',
    description: 'Upbeat three-note productivity chime',
    durationMs: 620,
  },
  {
    id: 'midnight-sonar',
    name: 'Midnight Sonar',
    description: 'Deep calm oceanic echo pulse',
    durationMs: 1100,
  },
  {
    id: 'silent',
    name: 'Silent',
    description: 'Visual popup and vibration only',
    durationMs: 0,
  },
];

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx) {
    sharedCtx = new AudioCtx();
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {
      // Ignored if called before user gesture
    });
  }
  return sharedCtx;
}

/**
 * Unlocks Web Audio on first user interaction so scheduled reminders play smoothly.
 */
export function unlockAudioEngine(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

function playSingleTone(
  ctx: AudioContext,
  presetId: SoundPresetId,
  volume: number,
  startOffsetSec: number
): void {
  const now = ctx.currentTime + startOffsetSec;
  const clampedVol = Math.max(0, Math.min(1, volume));
  if (clampedVol <= 0.001) return;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(clampedVol * 0.45, now);
  masterGain.connect(ctx.destination);

  const scheduleNote = (
    freq: number,
    delaySec: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    gainScale = 1,
    attackSec = 0.014,
    endFreq?: number
  ) => {
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + delaySec);
    if (endFreq && endFreq > 0) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + delaySec + durationSec * 0.45);
    }

    noteGain.gain.setValueAtTime(0.0001, now + delaySec);
    noteGain.gain.linearRampToValueAtTime(0.8 * gainScale, now + delaySec + attackSec);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + delaySec + durationSec);

    osc.connect(noteGain);
    noteGain.connect(masterGain);

    osc.start(now + delaySec);
    osc.stop(now + delaySec + durationSec + 0.02);
  };

  switch (presetId) {
    case 'ios-tri-tone':
      // Classic bright 3-note ascending glass marimba cadence
      scheduleNote(1174.66, 0, 0.28, 'sine', 0.82, 0.006); // D6
      scheduleNote(2349.32, 0, 0.16, 'triangle', 0.2, 0.004);
      scheduleNote(1567.98, 0.14, 0.3, 'sine', 0.82, 0.006); // G6
      scheduleNote(3135.96, 0.14, 0.16, 'triangle', 0.18, 0.004);
      scheduleNote(1975.53, 0.28, 0.48, 'sine', 0.88, 0.006); // B6
      scheduleNote(3951.07, 0.28, 0.24, 'triangle', 0.18, 0.004);
      break;
    case 'ios-note':
      // Clean single iOS glassy bell ping with soft octave bloom
      scheduleNote(987.77, 0, 0.54, 'sine', 0.88, 0.007); // B5
      scheduleNote(1975.53, 0, 0.36, 'triangle', 0.3, 0.005); // B6
      scheduleNote(2960.0, 0.01, 0.2, 'sine', 0.12, 0.004);
      break;
    case 'ios-chime':
      // Soft Apple-style two-note electric bell chord
      scheduleNote(783.99, 0, 0.48, 'sine', 0.78, 0.01); // G5
      scheduleNote(1567.98, 0, 0.28, 'triangle', 0.22, 0.006);
      scheduleNote(1174.66, 0.16, 0.58, 'sine', 0.84, 0.01); // D6
      scheduleNote(2349.32, 0.16, 0.32, 'triangle', 0.2, 0.006);
      break;
    case 'ios-bamboo':
      // Crisp wooden percussive double tap
      scheduleNote(520, 0, 0.14, 'triangle', 0.85, 0.004, 390);
      scheduleNote(780, 0, 0.09, 'sine', 0.32, 0.004);
      scheduleNote(690, 0.15, 0.18, 'triangle', 0.9, 0.004, 520);
      scheduleNote(1040, 0.15, 0.11, 'sine', 0.3, 0.004);
      break;
    case 'ios-aurora':
      // Airy sparkling four-note iOS glass shimmer
      scheduleNote(659.25, 0, 0.42, 'sine', 0.68, 0.012); // E5
      scheduleNote(830.61, 0.1, 0.46, 'sine', 0.7, 0.012); // G#5
      scheduleNote(987.77, 0.2, 0.52, 'triangle', 0.55, 0.012); // B5
      scheduleNote(1318.51, 0.3, 0.62, 'sine', 0.75, 0.012); // E6
      break;
    case 'ios-pulse':
      // Clean rhythmic crystalline double pulse
      scheduleNote(739.99, 0, 0.18, 'sine', 0.82, 0.006); // F#5
      scheduleNote(1479.98, 0, 0.12, 'triangle', 0.24, 0.005);
      scheduleNote(739.99, 0.16, 0.18, 'sine', 0.78, 0.006);
      scheduleNote(1108.73, 0.32, 0.36, 'sine', 0.86, 0.008); // C#6
      break;
    case 'crystal-chime':
      scheduleNote(1046.5, 0, 0.55, 'sine', 0.7); // C6
      scheduleNote(1318.5, 0.11, 0.6, 'sine', 0.65); // E6
      scheduleNote(1567.98, 0.22, 0.75, 'triangle', 0.5); // G6
      break;
    case 'soft-pulse':
      scheduleNote(440, 0, 0.18, 'sine', 0.85);
      scheduleNote(554.37, 0.17, 0.28, 'sine', 0.75);
      break;
    case 'beacon-tone':
      scheduleNote(587.33, 0, 0.22, 'triangle', 0.75); // D5
      scheduleNote(880, 0.16, 0.44, 'sine', 0.85); // A5
      break;
    case 'zen-gong':
      scheduleNote(220, 0, 1.35, 'sine', 0.9);
      scheduleNote(440, 0, 0.95, 'sine', 0.35);
      scheduleNote(659.25, 0.01, 0.7, 'triangle', 0.18);
      break;
    case 'digital-ping':
      scheduleNote(880, 0, 0.11, 'sine', 0.8);
      scheduleNote(1174.66, 0.09, 0.24, 'sine', 0.75);
      break;
    case 'aurora-harp':
      scheduleNote(523.25, 0, 0.55, 'sine', 0.65); // C5
      scheduleNote(659.25, 0.09, 0.6, 'sine', 0.65); // E5
      scheduleNote(783.99, 0.18, 0.68, 'triangle', 0.52); // G5
      scheduleNote(1174.66, 0.27, 0.85, 'sine', 0.55); // D6
      break;
    case 'amber-marimba':
      scheduleNote(349.23, 0, 0.34, 'triangle', 0.8); // F4
      scheduleNote(440, 0.14, 0.38, 'triangle', 0.75); // A4
      scheduleNote(523.25, 0.28, 0.5, 'sine', 0.72); // C5
      break;
    case 'dewdrop-bell':
      scheduleNote(620, 0, 0.36, 'sine', 0.75, 0.008, 1240);
      scheduleNote(1240, 0.16, 0.62, 'sine', 0.52);
      scheduleNote(1860, 0.18, 0.48, 'triangle', 0.22);
      break;
    case 'horizon-chord':
      scheduleNote(293.66, 0, 1.15, 'sine', 0.62, 0.14); // D4
      scheduleNote(440, 0.03, 1.12, 'sine', 0.52, 0.16); // A4
      scheduleNote(659.25, 0.08, 1.05, 'triangle', 0.3, 0.2); // E5
      break;
    case 'brisk-triad':
      scheduleNote(659.25, 0, 0.15, 'triangle', 0.72); // E5
      scheduleNote(830.61, 0.11, 0.16, 'triangle', 0.72); // G#5
      scheduleNote(987.77, 0.22, 0.38, 'sine', 0.82); // B5
      break;
    case 'midnight-sonar':
      scheduleNote(246.94, 0, 0.92, 'sine', 0.88, 0.02); // B3
      scheduleNote(493.88, 0.01, 0.65, 'sine', 0.32, 0.02); // B4
      scheduleNote(246.94, 0.42, 0.68, 'sine', 0.34, 0.03); // gentle echo
      break;
    case 'silent':
    default:
      break;
  }
}

export function playReminderSound(
  presetId: SoundPresetId,
  volume = 0.8,
  repeatCount = 1
): () => void {
  if (presetId === 'silent') return () => {};
  const ctx = getAudioContext();
  if (!ctx) return () => {};

  const preset = SOUND_PRESETS.find((p) => p.id === presetId);
  const gapSec = Math.max(0.7, ((preset?.durationMs ?? 800) + 320) / 1000);
  const count = Math.max(1, Math.min(3, repeatCount));

  let cancelled = false;
  const timers: number[] = [];

  for (let i = 0; i < count; i++) {
    const id = window.setTimeout(() => {
      if (cancelled) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      playSingleTone(ctx, presetId, volume, 0);
    }, i * gapSec * 1000);
    timers.push(id);
  }

  return () => {
    cancelled = true;
    timers.forEach((t) => window.clearTimeout(t));
  };
}

export function getSoundName(presetId: SoundPresetId): string {
  return SOUND_PRESETS.find((p) => p.id === presetId)?.name ?? 'Crystal Chime';
}
