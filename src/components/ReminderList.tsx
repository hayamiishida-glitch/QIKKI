import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BellRing,
  CalendarClock,
  Check,
  Clock,
  MapPin,
  Plus,
  Repeat,
  RotateCcw,
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

export interface ReminderListHeaderConfig {
  title: string;
  subtitle?: string;
  count?: number;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ReminderListProps {
  reminders: Reminder[];
  nowMs: number;
  variant?: 'default' | 'recurring';
  cardHeader?: ReminderListHeaderConfig;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onComplete: (reminder: Reminder) => void;
  onReactivate?: (reminder: Reminder) => void;
  onSnooze: (reminder: Reminder, minutes: number) => void;
  onEdit: (reminder: Reminder) => void;
  onTestAlert: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
  onContextMenuReminder?: (
    reminder: Reminder,
    event: React.MouseEvent
  ) => void;
}

function formatDateParts(iso: string): {
  weekdayMonth: string;
  dayNum: string;
  timeStr: string;
  fullDateLabel: string;
} {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return {
      weekdayMonth: 'DATE',
      dayNum: '--',
      timeStr: '--:--',
      fullDateLabel: 'Unscheduled',
    };
  }
  const weekday = d.toLocaleDateString([], { weekday: 'short' });
  const month = d.toLocaleDateString([], { month: 'short' });
  const dayNum = String(d.getDate());
  const timeStr = d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const fullDateLabel = d.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year:
      d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });

  return {
    weekdayMonth: `${weekday} · ${month}`,
    dayNum,
    timeStr,
    fullDateLabel,
  };
}

export const ReminderList: React.FC<ReminderListProps> = ({
  reminders,
  nowMs,
  variant = 'default',
  cardHeader,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  onComplete,
  onReactivate,
  onSnooze,
  onEdit,
  onTestAlert,
  onDelete,
  onContextMenuReminder,
}) => {
  const isRecurringVariant = variant === 'recurring';

  const renderCardHeader = () => {
    if (!cardHeader) return null;
    const showSearch =
      typeof cardHeader.onSearchChange === 'function' &&
      (reminders.length > 0 || Boolean(cardHeader.searchValue?.trim()));

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/[0.07] px-4 py-3.5 sm:px-5 dark:border-white/[0.08]">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600/12 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300">
            <Repeat className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h2 className="font-display text-sm font-semibold text-slate-950 dark:text-white">
                {cardHeader.title}
              </h2>
              {typeof cardHeader.count === 'number' && (
                <span className="font-mono text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-300">
                  {cardHeader.count}
                </span>
              )}
            </div>
            {cardHeader.subtitle && (
              <p className="truncate text-xs text-slate-500 dark:text-slate-300/75">
                {cardHeader.subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showSearch && (
            <div className="relative w-44 sm:w-52">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-slate-300/75"
                aria-hidden="true"
              />
              <input
                type="search"
                value={cardHeader.searchValue ?? ''}
                onChange={(e) => cardHeader.onSearchChange?.(e.target.value)}
                placeholder={cardHeader.searchPlaceholder ?? 'Filter...'}
                aria-label={cardHeader.searchPlaceholder ?? 'Filter reminders'}
                className="w-full rounded-xl border border-slate-900/10 bg-white/75 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none dark:border-white/[0.12] dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-400"
              />
            </div>
          )}

          {cardHeader.actionLabel && cardHeader.onAction && (
            <button
              type="button"
              onClick={cardHeader.onAction}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{cardHeader.actionLabel}</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  if (reminders.length === 0) {
    return (
      <div className="qikki-glass-card select-none overflow-hidden rounded-3xl border border-white/80 bg-white/58 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]">
        {renderCardHeader()}
        <div
          className={`px-6 text-center ${cardHeader ? 'py-10' : 'py-16'}`}
        >
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            {emptyTitle}
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300/85">
            {emptyDescription}
          </p>
          {emptyActionLabel && onEmptyAction && (
            <button
              type="button"
              onClick={onEmptyAction}
              className="mt-5 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              {emptyActionLabel}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="qikki-glass-card select-none overflow-hidden rounded-3xl border border-white/80 bg-white/58 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]">
      {renderCardHeader()}
      <ul className="divide-y divide-slate-900/[0.07] dark:divide-white/[0.08]">
        <AnimatePresence initial={false}>
          {reminders.map((item) => {
            const effectiveIso =
              item.status === 'snoozed' && item.snoozedUntil
                ? item.snoozedUntil
                : item.triggerAt;
            const countdown = formatRelativeCountdown(effectiveIso, nowMs);
            const recurrenceLabel = formatRecurrenceSummary(item.recurrence);
            const isCompleted = item.status === 'completed';
            const dateParts = isRecurringVariant
              ? formatDateParts(effectiveIso)
              : null;

            return (
              <motion.li
                key={item.id}
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                onContextMenu={(e) => {
                  if (!onContextMenuReminder) return;
                  e.preventDefault();
                  e.stopPropagation();
                  onContextMenuReminder(item, e);
                }}
                className={`group flex flex-col gap-3 px-4 transition-colors hover:bg-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:hover:bg-white/[0.05] ${
                  isRecurringVariant ? 'py-4.5' : 'py-4 sm:items-start'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                  {!isCompleted ? (
                    <button
                      type="button"
                      onClick={() => onComplete(item)}
                      aria-label={`Mark "${item.title}" complete`}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-900/20 bg-white/70 text-slate-500 transition-all duration-150 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-600 active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-white/20 dark:bg-white/[0.07] dark:text-slate-400 dark:hover:border-blue-400 dark:hover:bg-blue-500/20 dark:hover:text-blue-300 ${
                        isRecurringVariant ? 'mt-2' : 'mt-0.5'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onReactivate?.(item)}
                      aria-label={`Restore "${item.title}"`}
                      title="Restore reminder"
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-600/15 text-emerald-700 transition-colors hover:bg-emerald-600/25 dark:bg-emerald-500/20 dark:text-emerald-300"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}

                  {isRecurringVariant && dateParts ? (
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      {/* Prominent Date Anchor Block */}
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        title="Edit recurring schedule"
                        className={`flex shrink-0 items-center gap-3 rounded-xl border px-3.5 py-2 text-left transition-colors sm:w-32 sm:flex-col sm:items-center sm:justify-center sm:gap-0.5 sm:px-3 sm:py-2.5 sm:text-center ${
                          countdown.isOverdue
                            ? 'border-red-500/35 bg-red-500/10 hover:bg-red-500/15 dark:border-red-400/30 dark:bg-red-500/12'
                            : countdown.isDueSoon
                              ? 'border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15 dark:border-amber-400/30 dark:bg-amber-500/12'
                              : 'border-blue-500/25 bg-blue-50/85 hover:bg-blue-100/80 dark:border-blue-400/22 dark:bg-blue-500/[0.12] dark:hover:bg-blue-500/[0.18]'
                        }`}
                      >
                        <span
                          className={`text-[11px] font-bold uppercase tracking-wider ${
                            countdown.isOverdue
                              ? 'text-red-600 dark:text-red-300'
                              : countdown.isDueSoon
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {dateParts.weekdayMonth}
                        </span>
                        <span className="font-mono text-2xl font-bold leading-none tabular-nums text-slate-950 dark:text-white">
                          {dateParts.dayNum}
                        </span>
                        <span className="font-mono text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200 sm:mt-0.5">
                          {dateParts.timeStr}
                        </span>
                      </button>

                      {/* Prominent Event Title + Schedule Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            className="text-left text-base font-bold leading-snug tracking-tight text-slate-950 transition-colors hover:text-blue-700 sm:text-[17px] dark:text-white dark:hover:text-blue-300"
                          >
                            {item.title}
                          </button>
                          {item.status === 'snoozed' && (
                            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                              Snoozed
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                          <span
                            className={`inline-flex items-center gap-1.5 font-mono font-semibold tabular-nums ${
                              countdown.isOverdue
                                ? 'text-red-600 dark:text-red-300'
                                : countdown.isDueSoon
                                  ? 'text-amber-700 dark:text-amber-300'
                                  : 'text-blue-700 dark:text-blue-300'
                            }`}
                          >
                            <CalendarClock
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>
                              Next: {dateParts.fullDateLabel} at{' '}
                              {dateParts.timeStr}
                            </span>
                          </span>
                          <span
                            aria-hidden="true"
                            className="text-slate-400 dark:text-slate-500"
                          >
                            ·
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                            {recurrenceLabel}
                          </span>
                        </div>

                        {item.location && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                            <span className="truncate">{item.location}</span>
                          </div>
                        )}

                        {item.notes && (
                          <p className="mt-1 line-clamp-1 text-xs text-slate-600 dark:text-slate-300/85">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <span
                          className={`text-[15px] font-semibold leading-snug ${
                            isCompleted
                              ? 'text-slate-400 line-through dark:text-slate-500'
                              : 'text-slate-950 dark:text-white'
                          }`}
                        >
                          {item.title}
                        </span>
                        {item.status === 'snoozed' && (
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            Snoozed
                          </span>
                        )}
                      </div>

                      {item.location && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                          <span className="truncate">{item.location}</span>
                        </div>
                      )}

                      {item.notes && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-600 dark:text-slate-300/80">
                          {item.notes}
                        </p>
                      )}

                      {/* Clean unboxed metadata with typographic separators */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-300/75">
                        <span className="font-mono font-medium tabular-nums text-slate-800 dark:text-slate-200">
                          {formatScheduleDateTime(effectiveIso)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{recurrenceLabel}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right zone: Countdown + Action affordances */}
                <div className="flex items-center justify-between gap-3 pl-9 sm:shrink-0 sm:justify-end sm:pl-0">
                  {!isCompleted && (
                    <span
                      className={`font-mono font-semibold tabular-nums whitespace-nowrap ${
                        isRecurringVariant ? 'text-sm font-bold' : 'text-xs'
                      } ${
                        countdown.isOverdue
                          ? 'text-red-600 dark:text-red-400'
                          : countdown.isDueSoon
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {countdown.label}
                    </span>
                  )}

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onTestAlert(item)}
                      title="Test popup, sound & vibration"
                      aria-label={`Test alert for ${item.title}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-900/10 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-blue-300"
                    >
                      <BellRing className="h-4 w-4" aria-hidden="true" />
                    </button>

                    {!isCompleted && (
                      <button
                        type="button"
                        onClick={() => onSnooze(item, 15)}
                        title="Snooze 15 minutes"
                        aria-label={`Snooze ${item.title} by 15 minutes`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-900/10 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        <Clock className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      title="Edit reminder"
                      aria-label={`Edit ${item.title}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-900/10 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      title="Delete reminder"
                      aria-label={`Delete ${item.title}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/15 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
};
