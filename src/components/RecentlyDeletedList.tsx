import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, RotateCcw, Trash2 } from 'lucide-react';
import type { Reminder } from '../types/reminder';
import {
  computeDeletionExpiry,
  formatDeletionTimestamp,
  formatRecurrenceSummary,
  formatRemainingRetention,
  formatScheduleDateTime,
} from '../utils/recurrence';

interface RecentlyDeletedListProps {
  items: Reminder[];
  nowMs: number;
  onRestore: (reminder: Reminder) => void;
  onDeleteForever: (reminder: Reminder) => void;
  onClearAll: () => void;
}

export const RecentlyDeletedList: React.FC<RecentlyDeletedListProps> = ({
  items,
  nowMs,
  onRestore,
  onDeleteForever,
  onClearAll,
}) => {
  return (
    <div className="space-y-4">
      <div className="qikki-glass-card flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/80 bg-white/58 px-5 py-4 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Recently Deleted Schedules
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300/80">
            Each deleted reminder is kept for 7 days from its deletion timestamp and automatically cleared once expired.
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 whitespace-nowrap dark:border-red-500/25 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25"
          >
            Clear All Deleted
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="qikki-glass-card rounded-3xl border border-white/80 bg-white/58 px-6 py-14 text-center shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            No recently deleted schedules
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600 dark:text-slate-300/80">
            Deleted reminders appear here with their deletion and 7-day expiration times so you can restore them before they expire.
          </p>
        </div>
      ) : (
        <div className="qikki-glass-card overflow-hidden rounded-3xl border border-white/80 bg-white/58 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]">
          <ul className="divide-y divide-slate-900/[0.07] dark:divide-white/[0.08]">
            <AnimatePresence initial={false}>
              {items.map((item) => {
                const deletedIso = item.deletedAt || item.updatedAt;
                const expiresIso =
                  item.expiresAt || computeDeletionExpiry(deletedIso);
                const remainingLabel = formatRemainingRetention(
                  deletedIso,
                  expiresIso,
                  nowMs
                );

                return (
                  <motion.li
                    key={item.id}
                    layout="position"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:hover:bg-white/[0.05]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2.5">
                        <span className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                          {item.title}
                        </span>
                        <span className="font-mono text-xs font-medium tabular-nums text-amber-700 dark:text-amber-300">
                          {remainingLabel}
                        </span>
                      </div>

                      {item.location && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                          <span className="truncate">{item.location}</span>
                        </div>
                      )}

                      {item.notes && (
                        <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300/80">
                          {item.notes}
                        </p>
                      )}

                      {/* Original schedule & per-item deletion/expiration timestamps */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-300/75">
                        <span>
                          Scheduled{' '}
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                            {formatScheduleDateTime(item.triggerAt)}
                          </span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRecurrenceSummary(item.recurrence)}</span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-300/75">
                        <span>
                          Deleted{' '}
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                            {formatDeletionTimestamp(deletedIso)}
                          </span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Expires{' '}
                          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                            {formatDeletionTimestamp(expiresIso)}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onRestore(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/12 bg-white/65 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-white hover:text-blue-600 dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.13] dark:hover:text-blue-300"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Restore</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteForever(item)}
                        title="Delete forever"
                        aria-label={`Delete ${item.title} forever`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/12 bg-white/65 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-300 dark:hover:border-red-500/30 dark:hover:bg-red-500/15 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Delete Forever</span>
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </div>
  );
};
