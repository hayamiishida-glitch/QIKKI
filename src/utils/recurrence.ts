import type { RecurrenceRule } from '../types/reminder';
import {
  isDateExcludedForReminder,
  isDatePastStopCutoff,
  type OccurrenceExclusions,
} from './occurrenceExclusions';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function createDefaultRecurrence(referenceDate = new Date()): RecurrenceRule {
  return {
    frequency: 'none',
    interval: 1,
    weekdays: [referenceDate.getDay()],
    monthlyMode: 'day-of-month',
    dayOfMonth: referenceDate.getDate(),
    nthWeek: Math.min(4, Math.ceil(referenceDate.getDate() / 7)),
    weekday: referenceDate.getDay(),
    targetCount: 12,
  };
}

export function getDefaultTargetCount(rule: RecurrenceRule): number {
  if (rule.frequency === 'monthly') {
    return Math.max(1, Math.round(12 / Math.max(1, rule.interval || 1)));
  }
  if (rule.frequency === 'weekly') {
    const daysPerWeek = Math.max(1, rule.weekdays.length || 1);
    return Math.max(4, Math.round((daysPerWeek * 4) / Math.max(1, rule.interval || 1)));
  }
  return 1;
}

export function getRecurrenceProgress(
  completedCount: number,
  rule: RecurrenceRule
): { completed: number; total: number; percent: number } {
  if (rule.targetCount === null || rule.targetCount === 0) {
    return { completed: Math.max(0, completedCount), total: 0, percent: 0 };
  }
  const total = Math.max(
    1,
    rule.targetCount && rule.targetCount > 0
      ? rule.targetCount
      : getDefaultTargetCount(rule)
  );
  const completed = Math.max(0, completedCount);
  const percent = Math.min(100, Math.round((completed / total) * 100));
  return { completed, total, percent };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getNthWeekdayOfMonth(
  year: number,
  monthIndex: number,
  weekday: number,
  nthWeek: number
): Date {
  if (nthWeek === -1) {
    const lastDay = daysInMonth(year, monthIndex);
    const d = new Date(year, monthIndex, lastDay);
    const diff = (d.getDay() - weekday + 7) % 7;
    d.setDate(lastDay - diff);
    return d;
  }
  const first = new Date(year, monthIndex, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const targetDay = 1 + offset + (nthWeek - 1) * 7;
  const maxDay = daysInMonth(year, monthIndex);
  if (targetDay > maxDay) {
    // Fallback to last occurrence in month if 5th/etc doesn't exist
    return getNthWeekdayOfMonth(year, monthIndex, weekday, -1);
  }
  return new Date(year, monthIndex, targetDay);
}

/**
 * Computes the next scheduled Date strictly after `afterDate` using the time-of-day
 * anchored in `anchorDate` and the recurrence rule.
 */
export function computeNextOccurrence(
  anchorIso: string,
  rule: RecurrenceRule,
  afterDate: Date = new Date()
): Date | null {
  if (rule.frequency === 'none') {
    return null;
  }

  const anchor = new Date(anchorIso);
  if (Number.isNaN(anchor.getTime())) {
    return null;
  }

  const hours = anchor.getHours();
  const minutes = anchor.getMinutes();
  const seconds = anchor.getSeconds();
  const interval = Math.max(1, rule.interval || 1);

  if (rule.frequency === 'weekly') {
    const selectedDays =
      rule.weekdays.length > 0
        ? [...new Set(rule.weekdays)].sort((a, b) => a - b)
        : [anchor.getDay()];

    // Start searching from the later of anchor date or afterDate's calendar day
    const startSearch = new Date(
      Math.max(anchor.getTime(), afterDate.getTime())
    );
    const anchorWeekStart = new Date(anchor);
    anchorWeekStart.setHours(0, 0, 0, 0);
    anchorWeekStart.setDate(anchorWeekStart.getDate() - anchorWeekStart.getDay());

    // Search up to 365 * interval days safely
    for (let dayOffset = 0; dayOffset <= 366 * interval; dayOffset++) {
      const candidate = new Date(startSearch);
      candidate.setHours(hours, minutes, seconds, 0);
      candidate.setDate(startSearch.getDate() + dayOffset);

      if (candidate.getTime() <= afterDate.getTime()) {
        continue;
      }

      if (!selectedDays.includes(candidate.getDay())) {
        continue;
      }

      if (interval > 1) {
        const candWeekStart = new Date(candidate);
        candWeekStart.setHours(0, 0, 0, 0);
        candWeekStart.setDate(candWeekStart.getDate() - candWeekStart.getDay());
        const weeksDiff = Math.round(
          (candWeekStart.getTime() - anchorWeekStart.getTime()) /
            (7 * 24 * 60 * 60 * 1000)
        );
        if (weeksDiff >= 0 && weeksDiff % interval !== 0) {
          continue;
        }
      }

      return candidate;
    }
    return null;
  }

  if (rule.frequency === 'monthly') {
    const baseYear = anchor.getFullYear();
    const baseMonth = anchor.getMonth();

    for (let step = 0; step <= 120; step++) {
      const totalMonths = baseYear * 12 + baseMonth + step * interval;
      const targetYear = Math.floor(totalMonths / 12);
      const targetMonth = totalMonths % 12;

      let candidate: Date;
      if (rule.monthlyMode === 'last-day') {
        const last = daysInMonth(targetYear, targetMonth);
        candidate = new Date(targetYear, targetMonth, last, hours, minutes, seconds, 0);
      } else if (rule.monthlyMode === 'nth-weekday') {
        const d = getNthWeekdayOfMonth(
          targetYear,
          targetMonth,
          rule.weekday,
          rule.nthWeek
        );
        d.setHours(hours, minutes, seconds, 0);
        candidate = d;
      } else {
        const maxDay = daysInMonth(targetYear, targetMonth);
        const clampedDay = Math.min(Math.max(1, rule.dayOfMonth || 1), maxDay);
        candidate = new Date(
          targetYear,
          targetMonth,
          clampedDay,
          hours,
          minutes,
          seconds,
          0
        );
      }

      if (candidate.getTime() > afterDate.getTime()) {
        return candidate;
      }
    }
    return null;
  }

  return null;
}

/**
 * Advances past any locally skipped dates and returns null if the next occurrence
 * falls on or after a reminder's stop-after cutoff date.
 */
export function computeNextUnskippedOccurrence(
  reminderId: string,
  anchorIso: string,
  rule: RecurrenceRule,
  afterDate: Date,
  exclusions?: OccurrenceExclusions
): Date | null {
  let cursor = afterDate;
  for (let i = 0; i < 64; i++) {
    const next = computeNextOccurrence(anchorIso, rule, cursor);
    if (!next) return null;
    if (exclusions && isDatePastStopCutoff(reminderId, next, exclusions)) {
      return null;
    }
    if (!exclusions || !isDateExcludedForReminder(reminderId, next, exclusions)) {
      return next;
    }
    cursor = next;
  }
  return null;
}

export function previewUpcomingOccurrences(
  anchorIso: string,
  rule: RecurrenceRule,
  count = 3
): Date[] {
  if (rule.frequency === 'none') return [];
  const results: Date[] = [];
  let cursor = new Date(anchorIso);
  if (Number.isNaN(cursor.getTime())) return [];

  // Include first future occurrence from anchor itself if anchor > now, otherwise from now
  const now = new Date();
  let probeFrom = cursor.getTime() > now.getTime() ? new Date(cursor.getTime() - 1000) : now;

  for (let i = 0; i < count; i++) {
    const next = computeNextOccurrence(anchorIso, rule, probeFrom);
    if (!next) break;
    results.push(next);
    probeFrom = next;
  }
  return results;
}

export interface MonthCalendarOccurrence {
  reminderId: string;
  date: Date;
  dayOfMonth: number;
  isSnoozed: boolean;
  isRecurringProjection: boolean;
}

/**
 * Computes all active/snoozed reminder occurrences falling within a given calendar month.
 * Projects weekly and monthly recurrence rules across the displayed month starting from
 * each reminder's scheduled anchor date.
 */
export function getMonthReminderOccurrences(
  reminders: {
    id: string;
    triggerAt: string;
    snoozedUntil?: string | null;
    status: string;
    recurrence: RecurrenceRule;
  }[],
  year: number,
  monthIndex: number,
  exclusions?: OccurrenceExclusions
): Map<number, MonthCalendarOccurrence[]> {
  const byDay = new Map<number, MonthCalendarOccurrence[]>();
  const totalDays = daysInMonth(year, monthIndex);
  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, monthIndex, totalDays, 23, 59, 59, 999);

  const pushOcc = (occ: MonthCalendarOccurrence) => {
    const list = byDay.get(occ.dayOfMonth) ?? [];
    list.push(occ);
    byDay.set(occ.dayOfMonth, list);
  };

  for (const item of reminders) {
    if (item.status === 'completed') continue;

    const effectiveIso =
      item.status === 'snoozed' && item.snoozedUntil
        ? item.snoozedUntil
        : item.triggerAt;
    const effectiveDate = new Date(effectiveIso);
    const anchorDate = new Date(item.triggerAt);
    if (Number.isNaN(anchorDate.getTime())) continue;

    const hours = anchorDate.getHours();
    const minutes = anchorDate.getMinutes();
    const seconds = anchorDate.getSeconds();

    // Always place the immediate active/snoozed occurrence if it lands in this month
    const placedDays = new Set<number>();
    if (
      !Number.isNaN(effectiveDate.getTime()) &&
      effectiveDate.getFullYear() === year &&
      effectiveDate.getMonth() === monthIndex &&
      (!exclusions || !isDateExcludedForReminder(item.id, effectiveDate, exclusions))
    ) {
      const day = effectiveDate.getDate();
      placedDays.add(day);
      pushOcc({
        reminderId: item.id,
        date: effectiveDate,
        dayOfMonth: day,
        isSnoozed: item.status === 'snoozed' && Boolean(item.snoozedUntil),
        isRecurringProjection: false,
      });
    }

    const rule = item.recurrence;
    if (!rule || rule.frequency === 'none') continue;

    const interval = Math.max(1, rule.interval || 1);
    const anchorDayStart = new Date(
      anchorDate.getFullYear(),
      anchorDate.getMonth(),
      anchorDate.getDate(),
      0,
      0,
      0,
      0
    );

    if (rule.frequency === 'weekly') {
      const selectedDays =
        rule.weekdays.length > 0
          ? new Set(rule.weekdays)
          : new Set([anchorDate.getDay()]);

      const anchorWeekStart = new Date(anchorDayStart);
      anchorWeekStart.setDate(anchorWeekStart.getDate() - anchorWeekStart.getDay());

      for (let d = 1; d <= totalDays; d++) {
        if (placedDays.has(d)) continue;
        const cand = new Date(year, monthIndex, d, hours, minutes, seconds, 0);
        if (cand.getTime() < anchorDate.getTime()) continue;
        if (!selectedDays.has(cand.getDay())) continue;

        if (interval > 1) {
          const candWeekStart = new Date(year, monthIndex, d, 0, 0, 0, 0);
          candWeekStart.setDate(candWeekStart.getDate() - candWeekStart.getDay());
          const weeksDiff = Math.round(
            (candWeekStart.getTime() - anchorWeekStart.getTime()) /
              (7 * 24 * 60 * 60 * 1000)
          );
          if (weeksDiff < 0 || weeksDiff % interval !== 0) continue;
        }

        if (exclusions && isDateExcludedForReminder(item.id, cand, exclusions)) {
          continue;
        }

        placedDays.add(d);
        pushOcc({
          reminderId: item.id,
          date: cand,
          dayOfMonth: d,
          isSnoozed: false,
          isRecurringProjection: true,
        });
      }
    } else if (rule.frequency === 'monthly') {
      const anchorTotalMonths =
        anchorDate.getFullYear() * 12 + anchorDate.getMonth();
      const targetTotalMonths = year * 12 + monthIndex;
      const monthDiff = targetTotalMonths - anchorTotalMonths;
      if (monthDiff < 0 || monthDiff % interval !== 0) continue;

      let targetDay: number;
      if (rule.monthlyMode === 'last-day') {
        targetDay = totalDays;
      } else if (rule.monthlyMode === 'nth-weekday') {
        const nthDate = getNthWeekdayOfMonth(
          year,
          monthIndex,
          rule.weekday,
          rule.nthWeek
        );
        targetDay = nthDate.getDate();
      } else {
        targetDay = Math.min(Math.max(1, rule.dayOfMonth || 1), totalDays);
      }

      if (!placedDays.has(targetDay)) {
        const cand = new Date(year, monthIndex, targetDay, hours, minutes, seconds, 0);
        if (
          cand >= monthStart &&
          cand <= monthEnd &&
          cand.getTime() >= anchorDate.getTime() &&
          (!exclusions || !isDateExcludedForReminder(item.id, cand, exclusions))
        ) {
          placedDays.add(targetDay);
          pushOcc({
            reminderId: item.id,
            date: cand,
            dayOfMonth: targetDay,
            isSnoozed: false,
            isRecurringProjection: true,
          });
        }
      }
    }
  }

  for (const [day, list] of byDay.entries()) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    byDay.set(day, list);
  }

  return byDay;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatRecurrenceSummary(rule: RecurrenceRule): string {
  if (rule.frequency === 'none') return 'Once';

  const interval = Math.max(1, rule.interval || 1);

  if (rule.frequency === 'weekly') {
    const days = [...new Set(rule.weekdays)].sort((a, b) => a - b);
    const dayText =
      days.length === 7
        ? 'Every day'
        : days.length === 5 &&
            days.join(',') === '1,2,3,4,5'
          ? 'Weekdays'
          : days.map((d) => WEEKDAY_SHORT[d]).join(', ');
    if (interval === 1) {
      return days.length === 7 || days.join(',') === '1,2,3,4,5'
        ? `Weekly · ${dayText}`
        : `Every ${dayText}`;
    }
    return `Every ${interval} wks · ${dayText}`;
  }

  if (rule.frequency === 'monthly') {
    const prefix = interval === 1 ? 'Monthly' : `Every ${interval} mos`;
    if (rule.monthlyMode === 'last-day') {
      return `${prefix} · Last day`;
    }
    if (rule.monthlyMode === 'nth-weekday') {
      const nthLabel = rule.nthWeek === -1 ? 'Last' : ordinal(rule.nthWeek);
      return `${prefix} · ${nthLabel} ${WEEKDAY_LONG[rule.weekday]}`;
    }
    return `${prefix} · ${ordinal(rule.dayOfMonth)}`;
  }

  return 'Once';
}

export function formatRelativeCountdown(
  targetIso: string,
  nowMs: number
): { label: string; isOverdue: boolean; isDueSoon: boolean } {
  const targetMs = new Date(targetIso).getTime();
  const diffMs = targetMs - nowMs;
  const absMs = Math.abs(diffMs);

  const totalMinutes = Math.floor(absMs / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (diffMs < -30000) {
    if (totalMinutes < 1) return { label: 'Due now', isOverdue: true, isDueSoon: true };
    if (totalMinutes < 60) return { label: `${totalMinutes}m overdue`, isOverdue: true, isDueSoon: true };
    if (totalHours < 24) return { label: `${totalHours}h ${totalMinutes % 60}m overdue`, isOverdue: true, isDueSoon: true };
    return { label: `${totalDays}d overdue`, isOverdue: true, isDueSoon: true };
  }

  if (absMs <= 45000) {
    return { label: 'Due now', isOverdue: false, isDueSoon: true };
  }

  if (totalMinutes < 60) {
    const secs = Math.floor((absMs % 60000) / 1000);
    if (totalMinutes < 1) {
      return { label: `in ${secs}s`, isOverdue: false, isDueSoon: true };
    }
    return {
      label: `in ${totalMinutes}m`,
      isOverdue: false,
      isDueSoon: totalMinutes <= 15,
    };
  }

  if (totalHours < 24) {
    const remMins = totalMinutes % 60;
    return {
      label: remMins > 0 ? `in ${totalHours}h ${remMins}m` : `in ${totalHours}h`,
      isOverdue: false,
      isDueSoon: false,
    };
  }

  if (totalDays < 7) {
    const remHours = totalHours % 24;
    return {
      label: remHours > 0 ? `in ${totalDays}d ${remHours}h` : `in ${totalDays}d`,
      isOverdue: false,
      isDueSoon: false,
    };
  }

  return {
    label: `in ${totalDays}d`,
    isOverdue: false,
    isDueSoon: false,
  };
}

export function formatScheduleDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();

  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (isToday) return `Today · ${timeStr}`;
  if (isTomorrow) return `Tomorrow · ${timeStr}`;

  const dateStr = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
  return `${dateStr} · ${timeStr}`;
}

export function toLocalDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toLocalTimeInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '09:00';
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

export function fromLocalDateAndTime(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const dt = new Date(
    y || new Date().getFullYear(),
    (m || 1) - 1,
    d || 1,
    hh || 0,
    mm || 0,
    0,
    0
  );
  return dt.toISOString();
}

export const DELETED_RETENTION_DAYS = 7;
export const DELETED_RETENTION_MS = DELETED_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function computeDeletionExpiry(deletedAtIso: string): string {
  const baseMs = new Date(deletedAtIso).getTime();
  const safeMs = Number.isNaN(baseMs) ? Date.now() : baseMs;
  return new Date(safeMs + DELETED_RETENTION_MS).toISOString();
}

export function getDeletionExpiryMs(
  deletedAtIso?: string | null,
  expiresAtIso?: string | null
): number | null {
  if (expiresAtIso) {
    const ms = new Date(expiresAtIso).getTime();
    if (!Number.isNaN(ms)) return ms;
  }
  if (deletedAtIso) {
    const ms = new Date(deletedAtIso).getTime();
    if (!Number.isNaN(ms)) return ms + DELETED_RETENTION_MS;
  }
  return null;
}

export function isDeletedExpired(
  deletedAtIso?: string | null,
  expiresAtIso?: string | null,
  nowMs = Date.now()
): boolean {
  if (!deletedAtIso) return false;
  const expMs = getDeletionExpiryMs(deletedAtIso, expiresAtIso);
  if (expMs === null) return false;
  return expMs <= nowMs;
}

export function formatDeletionTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const dateStr = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateStr}, ${timeStr}`;
}

export function formatRemainingRetention(
  deletedAtIso?: string | null,
  expiresAtIso?: string | null,
  nowMs = Date.now()
): string {
  const expMs = getDeletionExpiryMs(deletedAtIso, expiresAtIso);
  if (expMs === null) return '7d left';
  const diffMs = expMs - nowMs;
  if (diffMs <= 0) return 'Expired';

  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;

  if (days >= 1) {
    return remHours > 0 ? `${days}d ${remHours}h left` : `${days}d left`;
  }
  if (totalHours >= 1) {
    const remMins = totalMinutes % 60;
    return remMins > 0 ? `${totalHours}h ${remMins}m left` : `${totalHours}h left`;
  }
  return `${Math.max(1, totalMinutes)}m left`;
}

