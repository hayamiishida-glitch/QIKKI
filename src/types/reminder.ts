export type RecurrenceFrequency = 'none' | 'weekly' | 'monthly';

export type MonthlyMode = 'day-of-month' | 'last-day' | 'nth-weekday';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number; // e.g., every 1 week or every 2 months
  weekdays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat (used when frequency === 'weekly')
  monthlyMode: MonthlyMode;
  dayOfMonth: number; // 1..31 (used when monthlyMode === 'day-of-month')
  nthWeek: number; // 1, 2, 3, 4, or -1 (last) (used when monthlyMode === 'nth-weekday')
  weekday: number; // 0..6 (used when monthlyMode === 'nth-weekday')
  targetCount?: number | null; // Expected total occurrences / duration limit (null or 0 = unlimited ♾️)
}

export type SoundPresetId =
  | 'ios-tri-tone'
  | 'ios-note'
  | 'ios-chime'
  | 'ios-bamboo'
  | 'ios-aurora'
  | 'ios-pulse'
  | 'crystal-chime'
  | 'soft-pulse'
  | 'beacon-tone'
  | 'zen-gong'
  | 'digital-ping'
  | 'aurora-harp'
  | 'amber-marimba'
  | 'dewdrop-bell'
  | 'horizon-chord'
  | 'brisk-triad'
  | 'midnight-sonar'
  | 'silent';

export interface SoundConfig {
  presetId: SoundPresetId;
  volume: number; // 0..1
  repeatCount: number; // 1..3
}

export interface VibrationConfig {
  presetId: string;
  label: string;
  pattern: number[]; // Alternating vibrate/pause durations in ms
}

export type ReminderStatus = 'active' | 'snoozed' | 'completed';

export interface Reminder {
  id: string;
  title: string;
  notes: string;
  location?: string;
  triggerAt: string; // ISO 8601 UTC timestamp
  timezone: string; // IANA timezone string
  recurrence: RecurrenceRule;
  sound: SoundConfig;
  vibration: VibrationConfig;
  status: ReminderStatus;
  snoozedUntil?: string | null;
  lastTriggeredAt?: string | null;
  completedCount: number;
  // Cross-platform & future cloud sync metadata
  createdAt: string;
  updatedAt: string;
  syncVersion: number;
  deviceOrigin: string;
  deletedAt?: string | null;
  expiresAt?: string | null;
}

export interface SyncAdapterStatus {
  provider: 'local-indexeddb' | 'cloud-rest' | 'firebase-cloud';
  connected: boolean;
  lastSyncedAt: string | null;
  pendingChanges: number;
  deviceId: string;
  deviceName: string;
  endpointUrl: string;
}

export interface PortableSyncBundle {
  schemaVersion: 1;
  exportedAt: string;
  deviceOrigin: string;
  reminders: Reminder[];
}
