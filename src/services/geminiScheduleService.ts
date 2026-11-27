import type { User } from '@firebase/auth';
import type { Reminder, SoundPresetId } from '../types/reminder';
import { VIBRATION_PRESETS } from './vibrationEngine';
import { detectDeviceOrigin } from './storage/syncAdapter';

export interface GeminiScheduleResponseItem {
  title: string;
  notes: string;
  triggerAt: string;
  frequency: 'none' | 'weekly' | 'monthly';
  interval: number;
  weekdays: number[];
  monthlyMode: 'day-of-month' | 'last-day' | 'nth-weekday';
  dayOfMonth: number;
  nthWeek: number;
  weekday: number;
  targetCount: number;
  soundPresetId: SoundPresetId;
}

export interface GeminiScheduleResult {
  reply: string;
  reminders: Reminder[];
}

export async function generateGeminiSchedules(
  prompt: string,
  user: User
): Promise<GeminiScheduleResult> {
  const token = await user.getIdToken();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const localIsoNow = new Date().toISOString();

  const res = await fetch('/api/gemini/schedule', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      prompt,
      timezone,
      localIsoNow,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    reply?: string;
    schedules?: GeminiScheduleResponseItem[];
  };

  if (!res.ok || !Array.isArray(data.schedules)) {
    throw new Error(
      data.error || 'Could not generate schedules with Gemini right now.'
    );
  }

  const nowIso = new Date().toISOString();
  const device = detectDeviceOrigin();

  const reminders: Reminder[] = data.schedules.map((item, idx) => ({
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `rem-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    title: item.title,
    notes: item.notes,
    triggerAt: item.triggerAt,
    timezone,
    recurrence: {
      frequency: item.frequency,
      interval: item.interval,
      weekdays: item.weekdays,
      monthlyMode: item.monthlyMode,
      dayOfMonth: item.dayOfMonth,
      nthWeek: item.nthWeek,
      weekday: item.weekday,
      targetCount: item.targetCount,
    },
    sound: {
      presetId: item.soundPresetId || 'crystal-chime',
      volume: 0.85,
      repeatCount: 1,
    },
    vibration: { ...VIBRATION_PRESETS[0] },
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
  }));

  return {
    reply: data.reply || `Scheduled ${reminders.length} reminder${reminders.length > 1 ? 's' : ''}.`,
    reminders,
  };
}
