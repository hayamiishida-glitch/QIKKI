import React, { useState } from 'react';
import type { User } from '@firebase/auth';
import { ExternalLink, Loader2, Sparkles } from 'lucide-react';
import type { Reminder } from '../types/reminder';
import { generateGeminiSchedules } from '../services/geminiScheduleService';
import { GoogleMark } from './TopBar';

interface GeminiScheduleBarProps {
  user: User | null;
  isSigningIn: boolean;
  needsNewTabForAuth: boolean;
  onGoogleSignIn: () => Promise<User | null>;
  onSchedulesCreated: (reminders: Reminder[], summary: string) => Promise<void>;
}

const EXAMPLE_PROMPTS = [
  'Team standup every Mon, Wed, Fri at 9:30 AM',
  'Pay rent on the 28th of every month at 6 PM',
  'Drink water in 20 minutes and stretch at 4 PM today',
];

export const GeminiScheduleBar: React.FC<GeminiScheduleBarProps> = ({
  user,
  isSigningIn,
  needsNewTabForAuth,
  onGoogleSignIn,
  onSchedulesCreated,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) return;

    if (!user) {
      setStatusMessage({
        ok: false,
        text: 'Sign in with Google first so Gemini can save schedules directly to your account.',
      });
      return;
    }

    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const result = await generateGeminiSchedules(trimmed, user);
      await onSchedulesCreated(result.reminders, result.reply);
      setPrompt('');
      setStatusMessage({
        ok: true,
        text: result.reply,
      });
    } catch (err) {
      setStatusMessage({
        ok: false,
        text:
          err instanceof Error
            ? err.message
            : 'Could not generate schedules right now.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section
      aria-label="Ask Gemini to schedule reminders"
      className="qikki-glass-card rounded-2xl border border-white/60 bg-white/78 p-4 shadow-[0_14px_38px_-14px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl backdrop-saturate-150 transition-[border-color,box-shadow] duration-150 focus-within:border-indigo-400/70 focus-within:ring-2 focus-within:ring-indigo-500/15 dark:border-white/[0.12] dark:bg-slate-900/46 dark:shadow-[0_18px_44px_-14px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.12)] dark:focus-within:border-indigo-400/50"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
          <Sparkles
            className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300"
            aria-hidden="true"
          />
          <span>Ask Gemini to Schedule</span>
        </div>

        {user ? (
          <span className="text-[11px] text-slate-500 dark:text-slate-300/75">
            Saves directly to {user.email || 'your Google account'}
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {needsNewTabForAuth && (
              <a
                href={typeof window !== 'undefined' ? window.location.href : '/'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700 whitespace-nowrap"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                <span>Open in New Tab</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => void onGoogleSignIn()}
              disabled={isSigningIn}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/12 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-900 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              <GoogleMark className="h-3 w-3" />
              <span>
                {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
              </span>
            </button>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isGenerating}
          placeholder='e.g. "Remind me to stretch Mon/Wed/Fri at 10 AM and pay electricity every 25th"'
          aria-label="Ask Gemini to create a reminder schedule"
          className="min-w-0 flex-1 rounded-xl border border-slate-900/10 bg-white/70 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none disabled:opacity-60 dark:border-white/12 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-slate-400"
        />

        <button
          type="submit"
          disabled={!prompt.trim() || isGenerating || !user}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-xs transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>Scheduling...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Create Schedule</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {EXAMPLE_PROMPTS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setPrompt(example)}
            className="rounded-md bg-slate-900/[0.05] px-2 py-1 text-[11px] text-slate-600 transition-colors hover:bg-slate-900/[0.1] hover:text-slate-900 dark:bg-white/[0.06] dark:text-slate-300/80 dark:hover:bg-white/[0.12] dark:hover:text-white"
          >
            {example}
          </button>
        ))}
      </div>

      {statusMessage && (
        <p
          className={`mt-2.5 text-xs ${
            statusMessage.ok
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-amber-700 dark:text-amber-300'
          }`}
        >
          {statusMessage.text}
        </p>
      )}
    </section>
  );
};
