import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@firebase/auth';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Sun, Sunrise, Moon } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import type { LocalizedHoliday } from '../services/holidayService';

interface WelcomeGreetingCardProps {
  user: User | null;
  avatarUrl?: string | null;
  onOpenAvatarPicker?: () => void;
  activeCount: number;
  nextReminderTitle?: string | null;
  nextCountdownLabel?: string | null;
  todayHoliday?: LocalizedHoliday | null;
}

const WARM_WELCOME_MESSAGES = [
  "Ready to take control of your schedule? We've got you.",
  'One calm step at a time — your day is lined up and waiting.',
  "Everything important in one quiet place. Let's make today count.",
  'Breathe easy — Qikki keeps watch so nothing slips through the cracks.',
  "A clear mind starts with a clear schedule. You're right on track.",
  "Small routines build great days. What's first on your mind today?",
  "Your focus matters — we'll handle the timing and gentle nudges.",
  'Fresh page, calm pace. Every reminder is ready when you are.',
  'Stay present in the moment — your upcoming plans are safely queued.',
];

function getTimeSalutation(): {
  greeting: string;
  period: 'morning' | 'afternoon' | 'evening';
} {
  const hour = new Date().getHours();
  if (hour < 12) {
    return { greeting: 'Good morning', period: 'morning' };
  }
  if (hour < 17) {
    return { greeting: 'Good afternoon', period: 'afternoon' };
  }
  return { greeting: 'Good evening', period: 'evening' };
}

function pickRandomMessageIndex(excludeIndex: number | null): number {
  const len = WARM_WELCOME_MESSAGES.length;
  if (len <= 1) return 0;
  let next = Math.floor(Math.random() * len);
  if (excludeIndex !== null && next === excludeIndex) {
    next = (next + 1 + Math.floor(Math.random() * (len - 1))) % len;
  }
  return next;
}

export const WelcomeGreetingCard: React.FC<WelcomeGreetingCardProps> = ({
  user,
  avatarUrl,
  onOpenAvatarPicker,
  activeCount,
  nextReminderTitle,
  nextCountdownLabel,
  todayHoliday,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [messageIndex, setMessageIndex] = useState<number>(() =>
    pickRandomMessageIndex(null)
  );
  const [greetingCycle, setGreetingCycle] = useState(0);
  const prevUidRef = useRef<string | null>(user?.uid ?? null);

  // Re-randomize greeting whenever the user logs in or switches accounts
  useEffect(() => {
    const nextUid = user?.uid ?? null;
    if (nextUid && nextUid !== prevUidRef.current) {
      setMessageIndex((prev) => pickRandomMessageIndex(prev));
      setGreetingCycle((c) => c + 1);
    }
    prevUidRef.current = nextUid;
  }, [user?.uid]);

  const { greeting, period } = useMemo(() => getTimeSalutation(), []);

  const firstName = useMemo(() => {
    const raw =
      user?.displayName?.trim() ||
      user?.email?.split('@')[0]?.trim() ||
      '';
    if (!raw) return '';
    const first = raw.split(/\s+/)[0];
    return first.slice(0, 24);
  }, [user?.displayName, user?.email]);

  const headline = firstName ? `${greeting}, ${firstName}` : greeting;
  const welcomeLine = WARM_WELCOME_MESSAGES[messageIndex];
  const animKey = `${user?.uid ?? 'guest'}-${greetingCycle}-${messageIndex}`;

  const todayFormatted = useMemo(
    () =>
      new Date().toLocaleDateString([], {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    []
  );

  const PeriodIcon =
    period === 'morning' ? Sunrise : period === 'afternoon' ? Sun : Moon;

  return (
    <section
      aria-label="Welcome greeting"
      className="qikki-glass-card select-none relative overflow-hidden rounded-3xl border border-white/80 bg-white/58 px-5 py-4 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] sm:px-6 sm:py-5 dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]"
    >
      {/* Subtle ambient warmth highlight inside the glass surface */}
      {!shouldReduceMotion && (
        <motion.div
          aria-hidden="true"
          initial={{ x: '-35%', opacity: 0 }}
          animate={{ x: ['-35%', '115%'], opacity: [0, 0.55, 0] }}
          transition={{
            duration: 3.6,
            ease: [0.22, 1, 0.36, 1],
            delay: 0.15,
          }}
          key={`sweep-${animKey}`}
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent dark:via-sky-300/[0.08]"
        />
      )}

      <AnimatePresence mode="wait" initial={true}>
        <motion.div
          key={animKey}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-row items-center justify-between gap-4"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                delay: 0.04,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex items-center gap-2"
            >
              <motion.span
                initial={
                  shouldReduceMotion
                    ? false
                    : { scale: 0.72, rotate: -14, opacity: 0 }
                }
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 18,
                  delay: 0.08,
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300"
              >
                <PeriodIcon className="h-4 w-4" aria-hidden="true" />
              </motion.span>
              <span className="font-display text-sm font-semibold tracking-tight text-slate-700 dark:text-slate-200">
                {headline}
              </span>
            </motion.div>

            <motion.h2
              initial={
                shouldReduceMotion
                  ? false
                  : { opacity: 0, y: 8, filter: 'blur(4px)' }
              }
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{
                duration: 0.58,
                delay: 0.14,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="font-display text-lg font-bold leading-snug tracking-tight text-slate-950 [text-wrap:balance] sm:text-xl dark:text-white"
            >
              {welcomeLine}
            </motion.h2>

            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.48,
                delay: 0.24,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-0.5 text-xs text-slate-600 dark:text-slate-300/80"
            >
              <span>{todayFormatted}</span>
              {todayHoliday && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    title={`${todayHoliday.localName}${
                      todayHoliday.name &&
                      todayHoliday.name.toLowerCase() !==
                        todayHoliday.localName.toLowerCase()
                        ? ` (${todayHoliday.name})`
                        : ''
                    } · ${todayHoliday.countryName}`}
                    className="inline-flex max-w-[230px] items-center gap-1 truncate rounded-md bg-rose-500/12 px-1.5 py-0.5 font-medium text-rose-700 dark:bg-rose-400/15 dark:text-rose-200"
                  >
                    <span className="truncate">{todayHoliday.localName}</span>
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {activeCount === 0
                  ? 'No active reminders'
                  : `${activeCount} active reminder${activeCount === 1 ? '' : 's'}`}
              </span>
              {nextReminderTitle && nextCountdownLabel && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate max-w-[260px] sm:max-w-[340px]">
                    Next: <strong className="font-semibold text-slate-800 dark:text-slate-100">{nextReminderTitle}</strong>{' '}
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-300/75">
                      ({nextCountdownLabel})
                    </span>
                  </span>
                </>
              )}
            </motion.div>
          </div>

          <div className="flex shrink-0 items-center">
            <UserAvatar
              photoURL={avatarUrl}
              displayName={user?.displayName}
              email={user?.email}
              size="lg"
              showTracing={true}
              showEditBadge={false}
              onClick={onOpenAvatarPicker}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
};
