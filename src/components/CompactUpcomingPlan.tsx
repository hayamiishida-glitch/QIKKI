import React, { useState } from 'react';
import {
  BellRing,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { Reminder } from '../types/reminder';
import {
  formatRecurrenceSummary,
  formatRelativeCountdown,
  formatScheduleDateTime,
} from '../utils/recurrence';

interface CompactUpcomingPlanProps {
  reminders: Reminder[];
  nowMs: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  listFilter: 'all' | 'today' | 'weekly' | 'monthly';
  onFilterChange: (filter: 'all' | 'today' | 'weekly' | 'monthly') => void;
  selectedDateLabel?: string | null;
  onClearSelectedDate?: () => void;
  onCreateFirst: () => void;
  onComplete: (reminder: Reminder) => void;
  onSnooze: (reminder: Reminder, minutes: number) => void;
  onEdit: (reminder: Reminder) => void;
  onTestAlert: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
}

const COMPACT_LIMIT = 5;

export const CompactUpcomingPlan: React.FC<CompactUpcomingPlanProps> = ({
  reminders,
  nowMs,
  searchQuery,
  onSearchChange,
  listFilter,
  onFilterChange,
  selectedDateLabel,
  onClearSelectedDate,
  onCreateFirst,
  onComplete,
  onSnooze,
  onEdit,
  onTestAlert,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(false);

  const visibleReminders =
    expanded || reminders.length <= COMPACT_LIMIT
      ? reminders
      : reminders.slice(0, COMPACT_LIMIT);
  const hiddenCount = Math.max(0, reminders.length - visibleReminders.length);

  return (
    <section
      aria-label="Upcoming Plan"
      className="qikki-glass-card overflow-hidden rounded-2xl border border-white/60 bg-white/78 shadow-[0_14px_38px_-14px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/[0.12] dark:bg-slate-900/46 dark:shadow-[0_18px_44px_-14px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.12)]"
    >
      {/* Compact Header & Toolbar */}
      <div className="flex flex-col gap-2.5 border-b border-slate-900/[0.07] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-white/[0.08]">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="font-display text-sm font-semibold text-slate-950 dark:text-white">
            {selectedDateLabel ? `Plan · ${selectedDateLabel}` : 'Upcoming Plan'}
          </h2>
          <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-300/75">
            {reminders.length} {reminders.length === 1 ? 'item' : 'items'}
          </span>
          {selectedDateLabel && onClearSelectedDate && (
            <button
              type="button"
              onClick={onClearSelectedDate}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
            >
              Show all
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-44 sm:flex-none">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter plan..."
              aria-label="Filter upcoming plan"
              className="w-full rounded-lg border border-slate-900/10 bg-white/70 py-1 pl-7 pr-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none dark:border-white/12 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-slate-400"
            />
          </div>

          <div
            role="tablist"
            aria-label="Filter upcoming plan"
            className="no-scrollbar inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-slate-900/[0.06] p-0.5 dark:bg-white/[0.07]"
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'today', label: 'Today' },
                { id: 'weekly', label: 'Weekly' },
                { id: 'monthly', label: 'Monthly' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={listFilter === tab.id}
                onClick={() => onFilterChange(tab.id)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  listFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.16] dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300/80 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Compact Upcoming Rows */}
      {reminders.length === 0 ? (
        <div className="px-4 py-7 text-center">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
            {searchQuery || listFilter !== 'all' || selectedDateLabel
              ? 'No scheduled events match this view.'
              : 'Your upcoming plan is clear.'}
          </p>
          {!searchQuery && listFilter === 'all' && !selectedDateLabel && (
            <button
              type="button"
              onClick={onCreateFirst}
              className="mt-2.5 inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Schedule Reminder
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.07]">
            {visibleReminders.map((item) => {
              const effectiveIso =
                item.status === 'snoozed' && item.snoozedUntil
                  ? item.snoozedUntil
                  : item.triggerAt;
              const countdown = formatRelativeCountdown(effectiveIso, nowMs);
              const recurrenceLabel = formatRecurrenceSummary(item.recurrence);

              return (
                <li
                  key={item.id}
                  className="group flex items-center justify-between gap-2 px-3.5 py-2 transition-colors hover:bg-white/45 sm:px-5 dark:hover:bg-white/[0.05]"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onComplete(item)}
                      aria-label={`Mark "${item.title}" complete`}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-900/20 bg-white/70 text-slate-500 transition-colors hover:border-blue-600 hover:bg-blue-50 hover:text-blue-600 dark:border-white/25 dark:bg-white/[0.07] dark:text-slate-400 dark:hover:border-blue-400 dark:hover:bg-blue-500/20 dark:hover:text-blue-300"
                    >
                      <Check className="h-3 w-3" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="truncate text-[13px] font-semibold text-slate-950 dark:text-white">
                          {item.title}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-300/75">
                          <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                            {formatScheduleDateTime(effectiveIso)}
                          </span>
                          {recurrenceLabel !== 'Once' && (
                            <>
                              {' '}
                              · {recurrenceLabel}
                            </>
                          )}
                          {item.status === 'snoozed' && (
                            <span className="text-amber-700 dark:text-amber-300">
                              {' '}
                              · Snoozed
                            </span>
                          )}
                        </span>
                      </div>
                    </button>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`font-mono text-[11px] font-semibold tabular-nums whitespace-nowrap ${
                        countdown.isOverdue
                          ? 'text-red-600 dark:text-red-400'
                          : countdown.isDueSoon
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {countdown.label}
                    </span>

                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => onTestAlert(item)}
                        title="Test alert"
                        aria-label={`Test alert for ${item.title}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-900/10 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-blue-300"
                      >
                        <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSnooze(item, 15)}
                        title="Snooze 15m"
                        aria-label={`Snooze ${item.title} by 15 minutes`}
                        className="hidden h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-900/10 hover:text-slate-950 sm:flex dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        title="Edit"
                        aria-label={`Edit ${item.title}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-900/10 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        title="Delete"
                        aria-label={`Delete ${item.title}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/15 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {reminders.length > COMPACT_LIMIT && (
            <div className="border-t border-slate-900/[0.06] px-4 py-2 text-center dark:border-white/[0.07]">
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Show fewer</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Show {hiddenCount} more in upcoming plan</span>
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};
