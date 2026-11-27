import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Reminder } from '../types/reminder';
import {
  toLocalDateKey,
  type OccurrenceExclusions,
} from '../utils/occurrenceExclusions';
import {
  getMonthReminderOccurrences,
  type MonthCalendarOccurrence,
} from '../utils/recurrence';
import type { LocalizedHoliday } from '../services/holidayService';

interface MonthCalendarViewProps {
  reminders: Reminder[];
  exclusions?: OccurrenceExclusions;
  nowMs: number;
  viewYear: number;
  viewMonth: number;
  selectedDate: Date | null;
  holidaysByDate?: Map<string, LocalizedHoliday[]>;
  showHolidays?: boolean;
  onChangeMonth: (year: number, month: number) => void;
  onJumpToToday: () => void;
  onSelectDate: (date: Date | null) => void;
  onSelectReminder: (reminder: Reminder) => void;
  onContextMenuReminder?: (
    reminder: Reminder,
    event: React.MouseEvent,
    occurrenceDate?: Date,
    isProjected?: boolean
  ) => void;
  onScheduleOnDate: (date: Date) => void;
}

interface CalendarCell {
  date: Date;
  day: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getEventAccent(reminder: Reminder, isSnoozed: boolean) {
  if (isSnoozed) {
    return {
      bar: 'bg-amber-500',
      pill: 'bg-amber-500/15 text-amber-950 hover:bg-amber-500/24 dark:bg-amber-500/22 dark:text-amber-100 dark:hover:bg-amber-500/32',
    };
  }
  if (reminder.recurrence.frequency === 'weekly') {
    return {
      bar: 'bg-teal-500',
      pill: 'bg-teal-500/14 text-teal-950 hover:bg-teal-500/22 dark:bg-teal-500/22 dark:text-teal-100 dark:hover:bg-teal-500/32',
    };
  }
  if (reminder.recurrence.frequency === 'monthly') {
    return {
      bar: 'bg-indigo-500',
      pill: 'bg-indigo-500/14 text-indigo-950 hover:bg-indigo-500/22 dark:bg-indigo-500/24 dark:text-indigo-100 dark:hover:bg-indigo-500/34',
    };
  }
  return {
    bar: 'bg-blue-500',
    pill: 'bg-blue-500/14 text-blue-950 hover:bg-blue-500/22 dark:bg-blue-500/22 dark:text-blue-100 dark:hover:bg-blue-500/32',
  };
}

function formatEventTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export const MonthCalendarView: React.FC<MonthCalendarViewProps> = ({
  reminders,
  exclusions,
  nowMs,
  viewYear,
  viewMonth,
  selectedDate,
  holidaysByDate,
  showHolidays = false,
  onChangeMonth,
  onJumpToToday,
  onSelectDate,
  onSelectReminder,
  onContextMenuReminder,
  onScheduleOnDate,
}) => {
  const today = useMemo(() => new Date(nowMs), [nowMs]);
  const isViewingCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const reminderMap = useMemo(() => {
    const map = new Map<string, Reminder>();
    for (const r of reminders) {
      map.set(r.id, r);
    }
    return map;
  }, [reminders]);

  const occurrencesByDay = useMemo(
    () => getMonthReminderOccurrences(reminders, viewYear, viewMonth, exclusions),
    [reminders, viewYear, viewMonth, exclusions]
  );

  const cells: CalendarCell[] = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = firstOfMonth.getDay();
    const totalInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();

    const totalCells = startOffset + totalInMonth > 35 ? 42 : 35;
    const list: CalendarCell[] = [];

    for (let i = 0; i < totalCells; i++) {
      let cellDate: Date;
      let inCurrentMonth = true;
      if (i < startOffset) {
        const dayNum = prevMonthLastDay - startOffset + i + 1;
        cellDate = new Date(viewYear, viewMonth - 1, dayNum);
        inCurrentMonth = false;
      } else if (i >= startOffset + totalInMonth) {
        const dayNum = i - (startOffset + totalInMonth) + 1;
        cellDate = new Date(viewYear, viewMonth + 1, dayNum);
        inCurrentMonth = false;
      } else {
        const dayNum = i - startOffset + 1;
        cellDate = new Date(viewYear, viewMonth, dayNum);
      }

      const dayOfWeek = cellDate.getDay();
      list.push({
        date: cellDate,
        day: cellDate.getDate(),
        inCurrentMonth,
        isToday: isSameCalendarDay(cellDate, today),
        isSelected: selectedDate ? isSameCalendarDay(cellDate, selectedDate) : false,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      });
    }
    return list;
  }, [viewYear, viewMonth, today, selectedDate]);

  const monthLabel = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).toLocaleDateString([], {
      month: 'long',
    });
  }, [viewYear, viewMonth]);

  const monthEventCount = useMemo(() => {
    let total = 0;
    occurrencesByDay.forEach((arr) => {
      total += arr.length;
    });
    return total;
  }, [occurrencesByDay]);

  const handlePrevMonth = () => {
    const prev = new Date(viewYear, viewMonth - 1, 1);
    onChangeMonth(prev.getFullYear(), prev.getMonth());
  };

  const handleNextMonth = () => {
    const next = new Date(viewYear, viewMonth + 1, 1);
    onChangeMonth(next.getFullYear(), next.getMonth());
  };

  const activeDay = selectedDate ?? (isViewingCurrentMonth ? today : null);
  const activeDayOccurrences: MonthCalendarOccurrence[] = useMemo(() => {
    if (
      !activeDay ||
      activeDay.getFullYear() !== viewYear ||
      activeDay.getMonth() !== viewMonth
    ) {
      return [];
    }
    return occurrencesByDay.get(activeDay.getDate()) ?? [];
  }, [activeDay, viewYear, viewMonth, occurrencesByDay]);

  const activeDayHolidays: LocalizedHoliday[] = useMemo(() => {
    if (!showHolidays || !activeDay || !holidaysByDate) return [];
    return holidaysByDate.get(toLocalDateKey(activeDay)) ?? [];
  }, [showHolidays, activeDay, holidaysByDate]);

  return (
    <section
      aria-label={`${monthLabel} ${viewYear} Calendar`}
      className="qikki-glass-card select-none overflow-hidden rounded-3xl border border-white/80 bg-white/60 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]"
    >
      {/* Apple Calendar Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900/[0.08] px-3.5 py-3 sm:px-5 sm:py-3.5 dark:border-white/[0.09]">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="font-display text-lg font-bold tracking-tight text-slate-950 sm:text-xl dark:text-white">
            {monthLabel}{' '}
            <span className="font-normal text-slate-500 tabular-nums dark:text-slate-300/80">
              {viewYear}
            </span>
          </h1>
          <span className="hidden text-xs text-slate-500 tabular-nums sm:inline dark:text-slate-300/75">
            · {monthEventCount} {monthEventCount === 1 ? 'event' : 'events'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex items-center rounded-lg border border-slate-900/10 bg-white/65 p-0.5 dark:border-white/12 dark:bg-white/[0.06]">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-900/[0.07] hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onJumpToToday}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                isViewingCurrentMonth && !selectedDate
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.14] dark:text-white'
                  : 'text-slate-700 hover:bg-slate-900/[0.06] dark:text-slate-200 dark:hover:bg-white/10'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-900/[0.07] hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday Column Headers */}
      <div className="grid grid-cols-7 border-b border-slate-900/[0.07] bg-slate-900/[0.02] dark:border-white/[0.08] dark:bg-white/[0.02]">
        {WEEKDAYS.map((day, idx) => (
          <div
            key={day}
            className={`py-2 text-center text-[11px] font-semibold tracking-wide ${
              idx === 0 || idx === 6
                ? 'text-slate-400 dark:text-slate-400/75'
                : 'text-slate-600 dark:text-slate-300/85'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Apple Calendar Month Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-slate-900/[0.06] dark:divide-white/[0.07]">
        {cells.map((cell) => {
          const cellDateKey = toLocalDateKey(cell.date);
          const dayHolidays =
            showHolidays && holidaysByDate
              ? holidaysByDate.get(cellDateKey) ?? []
              : [];
          const dayOccurrences = cell.inCurrentMonth
            ? occurrencesByDay.get(cell.day) ?? []
            : [];
          const visibleHolidays = dayHolidays.slice(
            0,
            dayOccurrences.length > 0 ? 1 : 2
          );
          const visibleEvents = dayOccurrences.slice(
            0,
            Math.max(0, 3 - visibleHolidays.length)
          );
          const extraCount = Math.max(
            0,
            dayHolidays.length -
              visibleHolidays.length +
              (dayOccurrences.length - visibleEvents.length)
          );

          return (
            <div
              key={cell.date.toISOString()}
              role="button"
              tabIndex={0}
              aria-label={`${cell.date.toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}${
                dayHolidays.length > 0
                  ? `, Holiday: ${dayHolidays.map((h) => h.localName).join(', ')}`
                  : ''
              }${
                dayOccurrences.length > 0
                  ? `, ${dayOccurrences.length} reminder${dayOccurrences.length > 1 ? 's' : ''}`
                  : ''
              }`}
              aria-pressed={cell.isSelected}
              onClick={() => {
                if (!cell.inCurrentMonth) {
                  onChangeMonth(cell.date.getFullYear(), cell.date.getMonth());
                }
                if (cell.isSelected) {
                  onSelectDate(null);
                } else {
                  onSelectDate(cell.date);
                }
              }}
              onDoubleClick={() => onScheduleOnDate(cell.date)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!cell.inCurrentMonth) {
                    onChangeMonth(cell.date.getFullYear(), cell.date.getMonth());
                  }
                  onSelectDate(cell.isSelected ? null : cell.date);
                }
              }}
              className={`group relative flex min-h-[58px] cursor-pointer flex-col p-1 transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-500 sm:min-h-[84px] sm:p-1.5 ${
                !cell.inCurrentMonth
                  ? 'bg-slate-900/[0.025] text-slate-400 dark:bg-black/20 dark:text-slate-500/75'
                  : cell.isSelected
                    ? 'bg-blue-500/[0.09] dark:bg-blue-500/[0.14]'
                    : cell.isToday
                      ? 'bg-red-500/[0.04] hover:bg-red-500/[0.07] dark:bg-red-500/[0.06] dark:hover:bg-red-500/[0.1]'
                      : cell.isWeekend
                        ? 'bg-slate-900/[0.015] hover:bg-white/40 dark:bg-white/[0.015] dark:hover:bg-white/[0.05]'
                        : 'hover:bg-white/50 dark:hover:bg-white/[0.05]'
              }`}
            >
              {/* Day Number Row */}
              <div className="flex items-center justify-between px-0.5">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-semibold tabular-nums transition-colors ${
                    cell.isToday
                      ? 'bg-[#FF3B30] text-white shadow-xs'
                      : cell.isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : cell.inCurrentMonth
                          ? dayHolidays.length > 0
                            ? 'text-rose-600 dark:text-rose-300'
                            : 'text-slate-800 dark:text-slate-100'
                          : dayHolidays.length > 0
                            ? 'text-rose-400/80 dark:text-rose-400/60'
                            : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {cell.day}
                </span>

                {cell.inCurrentMonth && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onScheduleOnDate(cell.date);
                    }}
                    aria-label={`Add reminder on ${cell.date.toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}`}
                    className="hidden h-5 w-5 items-center justify-center rounded-md text-slate-400 opacity-0 transition-opacity hover:bg-slate-900/10 hover:text-slate-800 group-hover:opacity-100 sm:inline-flex dark:text-slate-400 dark:hover:bg-white/15 dark:hover:text-white"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Desktop / Tablet: Localized Holidays & Event Strips inside the date cell */}
              {(dayHolidays.length > 0 || dayOccurrences.length > 0) && (
                <>
                  <div className="mt-1 hidden flex-col gap-0.5 sm:flex">
                    {visibleHolidays.map((holiday, idx) => (
                      <button
                        key={`${cellDateKey}-holiday-${idx}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!cell.inCurrentMonth) {
                            onChangeMonth(
                              cell.date.getFullYear(),
                              cell.date.getMonth()
                            );
                          }
                          onSelectDate(cell.date);
                        }}
                        title={`${holiday.localName}${
                          holiday.name &&
                          holiday.name.toLowerCase() !==
                            holiday.localName.toLowerCase()
                            ? ` (${holiday.name})`
                            : ''
                        } · ${holiday.countryName}`}
                        className={`flex w-full items-center gap-1 rounded-[5px] px-1 py-0.5 text-left text-[11px] leading-tight transition-colors ${
                          cell.inCurrentMonth
                            ? 'bg-rose-500/14 text-rose-900 hover:bg-rose-500/22 dark:bg-rose-500/22 dark:text-rose-100 dark:hover:bg-rose-500/32'
                            : 'bg-rose-500/8 text-rose-700/75 hover:bg-rose-500/14 dark:bg-rose-500/12 dark:text-rose-200/70'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-0.5 shrink-0 rounded-full bg-rose-500"
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {holiday.localName}
                        </span>
                      </button>
                    ))}
                    {visibleEvents.map((occ) => {
                      const rem = reminderMap.get(occ.reminderId);
                      if (!rem) return null;
                      const accent = getEventAccent(rem, occ.isSnoozed);
                      return (
                        <button
                          key={`${occ.reminderId}-${occ.dayOfMonth}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectReminder(rem);
                          }}
                          onContextMenu={(e) => {
                            if (!onContextMenuReminder) return;
                            e.preventDefault();
                            e.stopPropagation();
                            onContextMenuReminder(
                              rem,
                              e,
                              occ.date,
                              occ.isRecurringProjection
                            );
                          }}
                          title={`${formatEventTime(occ.date)} · ${rem.title}`}
                          className={`flex w-full items-center gap-1 rounded-[5px] px-1 py-0.5 text-left text-[11px] leading-tight transition-colors ${accent.pill}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-2.5 w-0.5 shrink-0 rounded-full ${accent.bar}`}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {rem.title}
                          </span>
                          <span className="hidden shrink-0 font-mono text-[10px] opacity-75 tabular-nums md:inline">
                            {formatEventTime(occ.date)}
                          </span>
                        </button>
                      );
                    })}
                    {extraCount > 0 && (
                      <div className="px-1 text-[10px] font-medium text-slate-500 tabular-nums dark:text-slate-300/80">
                        +{extraCount} more
                      </div>
                    )}
                  </div>

                  {/* Narrow/Compact window (< 640px): compact holiday & event dots */}
                  <div className="mt-auto flex flex-wrap items-center justify-center gap-1 pb-0.5 sm:hidden">
                    {dayHolidays.length > 0 && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-rose-500"
                      />
                    )}
                    {dayOccurrences.slice(0, 3).map((occ) => {
                      const rem = reminderMap.get(occ.reminderId);
                      if (!rem) return null;
                      const accent = getEventAccent(rem, occ.isSnoozed);
                      return (
                        <span
                          key={`${occ.reminderId}-${occ.dayOfMonth}-dot`}
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full ${accent.bar}`}
                        />
                      );
                    })}
                    {dayOccurrences.length > 3 && (
                      <span className="font-mono text-[9px] font-semibold text-slate-500 dark:text-slate-300">
                        +
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Day Agenda Bar */}
      {activeDay && (
        <div className="border-t border-slate-900/[0.08] bg-slate-900/[0.025] px-3.5 py-2.5 sm:px-5 dark:border-white/[0.09] dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-900 dark:text-white">
                {isSameCalendarDay(activeDay, today)
                  ? `Today · ${activeDay.toLocaleDateString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}`
                  : activeDay.toLocaleDateString([], {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })}
              </span>
              <span className="text-slate-500 tabular-nums dark:text-slate-300/75">
                {activeDayHolidays.length > 0 && (
                  <>
                    · {activeDayHolidays.length}{' '}
                    {activeDayHolidays.length === 1 ? 'holiday' : 'holidays'}{' '}
                  </>
                )}
                ·{' '}
                {activeDayOccurrences.length === 0
                  ? 'No events scheduled'
                  : `${activeDayOccurrences.length} event${activeDayOccurrences.length > 1 ? 's' : ''}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => onSelectDate(null)}
                  className="text-xs font-medium text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                >
                  Show all dates
                </button>
              )}
              <button
                type="button"
                onClick={() => onScheduleOnDate(activeDay)}
                className="text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
              >
                + Schedule on this day
              </button>
            </div>
          </div>

          {(activeDayHolidays.length > 0 || activeDayOccurrences.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {activeDayHolidays.map((holiday, idx) => (
                <div
                  key={`${holiday.date}-agenda-${idx}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-rose-500/14 px-2.5 py-1 text-xs text-rose-950 dark:bg-rose-500/22 dark:text-rose-100"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-0.5 shrink-0 rounded-full bg-rose-500"
                  />
                  <span className="truncate font-semibold">
                    {holiday.localName}
                  </span>
                  {holiday.name &&
                    holiday.name.toLowerCase() !==
                      holiday.localName.toLowerCase() && (
                      <span className="hidden truncate text-[11px] opacity-75 sm:inline">
                        ({holiday.name})
                      </span>
                    )}
                  <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-400/20 dark:text-rose-200">
                    {holiday.isGlobal ? 'Public Holiday' : 'Regional'}
                  </span>
                </div>
              ))}
              {activeDayOccurrences.map((occ) => {
                const rem = reminderMap.get(occ.reminderId);
                if (!rem) return null;
                const accent = getEventAccent(rem, occ.isSnoozed);
                return (
                  <button
                    key={`${occ.reminderId}-${occ.dayOfMonth}-chip`}
                    type="button"
                    onClick={() => onSelectReminder(rem)}
                    onContextMenu={(e) => {
                      if (!onContextMenuReminder) return;
                      e.preventDefault();
                      e.stopPropagation();
                      onContextMenuReminder(
                        rem,
                        e,
                        occ.date,
                        occ.isRecurringProjection
                      );
                    }}
                    className={`inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors ${accent.pill}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-0.5 shrink-0 rounded-full ${accent.bar}`}
                    />
                    <span className="font-mono text-[11px] opacity-80 tabular-nums">
                      {formatEventTime(occ.date)}
                    </span>
                    <span className="truncate font-medium">{rem.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
