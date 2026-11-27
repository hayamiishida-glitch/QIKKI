export interface OccurrenceExclusions {
  skippedDates: Record<string, string[]>;
  stopAfterDates: Record<string, string>;
}

const EXCLUSIONS_KEY = 'qikki_occurrence_exclusions_v1';

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function loadOccurrenceExclusions(): OccurrenceExclusions {
  try {
    const raw = localStorage.getItem(EXCLUSIONS_KEY);
    if (!raw) return { skippedDates: {}, stopAfterDates: {} };
    const parsed = JSON.parse(raw) as Partial<OccurrenceExclusions>;
    return {
      skippedDates:
        parsed.skippedDates && typeof parsed.skippedDates === 'object'
          ? parsed.skippedDates
          : {},
      stopAfterDates:
        parsed.stopAfterDates && typeof parsed.stopAfterDates === 'object'
          ? parsed.stopAfterDates
          : {},
    };
  } catch {
    return { skippedDates: {}, stopAfterDates: {} };
  }
}

export function saveOccurrenceExclusions(exclusions: OccurrenceExclusions): void {
  try {
    localStorage.setItem(EXCLUSIONS_KEY, JSON.stringify(exclusions));
  } catch {
    // Ignore storage quota errors
  }
}

export function isDateExcludedForReminder(
  reminderId: string,
  date: Date,
  exclusions: OccurrenceExclusions
): boolean {
  const key = toLocalDateKey(date);
  const stopAfter = exclusions.stopAfterDates[reminderId];
  if (stopAfter && key >= stopAfter) {
    return true;
  }
  const skipped = exclusions.skippedDates[reminderId];
  if (skipped && skipped.includes(key)) {
    return true;
  }
  return false;
}

export function isDatePastStopCutoff(
  reminderId: string,
  date: Date,
  exclusions: OccurrenceExclusions
): boolean {
  const stopAfter = exclusions.stopAfterDates[reminderId];
  if (!stopAfter) return false;
  return toLocalDateKey(date) >= stopAfter;
}

export function addSkippedDateForReminder(
  exclusions: OccurrenceExclusions,
  reminderId: string,
  date: Date
): OccurrenceExclusions {
  const key = toLocalDateKey(date);
  const prev = exclusions.skippedDates[reminderId] ?? [];
  if (prev.includes(key)) return exclusions;
  return {
    ...exclusions,
    skippedDates: {
      ...exclusions.skippedDates,
      [reminderId]: [...prev, key],
    },
  };
}

export function setStopAfterDateForReminder(
  exclusions: OccurrenceExclusions,
  reminderId: string,
  date: Date
): OccurrenceExclusions {
  const key = toLocalDateKey(date);
  const existing = exclusions.stopAfterDates[reminderId];
  const nextStop = existing && existing < key ? existing : key;
  return {
    ...exclusions,
    stopAfterDates: {
      ...exclusions.stopAfterDates,
      [reminderId]: nextStop,
    },
  };
}

export function clearExclusionsForReminder(
  exclusions: OccurrenceExclusions,
  reminderId: string
): OccurrenceExclusions {
  if (
    !(reminderId in exclusions.skippedDates) &&
    !(reminderId in exclusions.stopAfterDates)
  ) {
    return exclusions;
  }
  const nextSkipped = { ...exclusions.skippedDates };
  const nextStops = { ...exclusions.stopAfterDates };
  delete nextSkipped[reminderId];
  delete nextStops[reminderId];
  return {
    skippedDates: nextSkipped,
    stopAfterDates: nextStops,
  };
}
