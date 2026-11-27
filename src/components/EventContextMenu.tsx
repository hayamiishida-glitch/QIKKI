import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarX2, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { Reminder } from '../types/reminder';
import { formatRecurrenceSummary, formatScheduleDateTime } from '../utils/recurrence';

export interface EventContextMenuState {
  reminder: Reminder;
  x: number;
  y: number;
  occurrenceDate?: Date;
  isProjected?: boolean;
}

interface EventContextMenuProps {
  menu: EventContextMenuState | null;
  onClose: () => void;
  onEdit: (reminder: Reminder) => void;
  onDeleteEvent: (
    reminder: Reminder,
    occurrenceDate?: Date,
    isProjected?: boolean
  ) => void;
  onDeleteRepeatingUpcoming: (
    reminder: Reminder,
    occurrenceDate?: Date,
    isProjected?: boolean
  ) => void;
}

export const EventContextMenu: React.FC<EventContextMenuProps> = ({
  menu,
  onClose,
  onEdit,
  onDeleteEvent,
  onDeleteRepeatingUpcoming,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });

  useLayoutEffect(() => {
    if (!menu) return;
    const margin = 10;
    const fallbackW = 248;
    const fallbackH = 196;
    const rect = menuRef.current?.getBoundingClientRect();
    const width = rect?.width || fallbackW;
    const height = rect?.height || fallbackH;

    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);
    setCoords({
      left: Math.min(Math.max(margin, menu.x), maxX),
      top: Math.min(Math.max(margin, menu.y), maxY),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (menuRef.current && target && menuRef.current.contains(target)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    const handleClose = () => onClose();

    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleClose, { capture: true, passive: true });
    window.addEventListener('blur', handleClose);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, {
        capture: true,
      });
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleClose, { capture: true });
      window.removeEventListener('blur', handleClose);
    };
  }, [menu, onClose]);

  return (
    <AnimatePresence>
      {menu && (
        <motion.div
          key={`${menu.reminder.id}-${menu.x}-${menu.y}`}
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${menu.reminder.title}`}
          initial={{ opacity: 0, scale: 0.96, y: -2 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { duration: 0.14, ease: [0.16, 1, 0.3, 1] },
          }}
          exit={{
            opacity: 0,
            scale: 0.97,
            y: -2,
            transition: { duration: 0.1, ease: [0.2, 0, 0, 1] },
          }}
          style={{ left: `${coords.left}px`, top: `${coords.top}px` }}
          className="fixed z-50 w-64 overflow-hidden rounded-2xl border border-white/75 bg-white/88 p-1.5 text-slate-900 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.36),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/15 dark:bg-slate-900/86 dark:text-slate-100 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.12)]"
        >
          {(() => {
            const { reminder, occurrenceDate, isProjected } = menu;
            const isRepeating = reminder.recurrence.frequency !== 'none';
            const displayIso = occurrenceDate
              ? occurrenceDate.toISOString()
              : reminder.snoozedUntil || reminder.triggerAt;
            return (
              <>
                <div className="border-b border-slate-900/[0.08] px-2.5 py-2 dark:border-white/[0.09]">
                  <p className="truncate text-xs font-semibold text-slate-950 dark:text-white">
                    {reminder.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-300/75">
                    <span className="font-mono tabular-nums">
                      {formatScheduleDateTime(displayIso)}
                    </span>{' '}
                    · {formatRecurrenceSummary(reminder.recurrence)}
                  </p>
                </div>

                <div className="mt-1 space-y-0.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onClose();
                      onEdit(reminder);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-800 transition-colors hover:bg-blue-500/12 hover:text-blue-700 dark:text-slate-100 dark:hover:bg-blue-500/20 dark:hover:text-blue-200"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onClose();
                      onDeleteEvent(reminder, occurrenceDate, isProjected);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-800 transition-colors hover:bg-red-500/12 hover:text-red-700 dark:text-slate-100 dark:hover:bg-red-500/20 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                    <span>Delete event</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={!isRepeating}
                    title={
                      isRepeating
                        ? 'Delete this and all upcoming repeating occurrences'
                        : 'Available for repeating reminders only'
                    }
                    onClick={() => {
                      if (!isRepeating) return;
                      onClose();
                      onDeleteRepeatingUpcoming(reminder, occurrenceDate, isProjected);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-red-700 transition-colors hover:bg-red-500/14 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent dark:text-red-300 dark:hover:bg-red-500/22 dark:disabled:text-slate-500"
                  >
                    <CalendarX2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">Delete repeating upcoming event</span>
                  </button>
                </div>
              </>
            );
          })()}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
