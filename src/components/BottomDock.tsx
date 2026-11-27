import React from 'react';
import type { User } from '@firebase/auth';
import {
  CalendarDays,
  History,
  Plus,
  SlidersHorizontal,
  User as UserIcon,
} from 'lucide-react';
import type { NavTab } from './TopBar';
import { UserAvatar } from './UserAvatar';

interface BottomDockProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenCreatePopup: () => void;
  onOpenAuth: () => void;
  onOpenSyncPreferences: () => void;
  user: User | null;
  avatarUrl?: string | null;
  isSigningIn?: boolean;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  activeTab,
  onSelectTab,
  onOpenCreatePopup,
  onOpenAuth,
  onOpenSyncPreferences,
  user,
  avatarUrl,
  isSigningIn = false,
}) => {
  const firstName = user?.displayName?.trim().split(/\s+/)[0] || user?.email || 'Account';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex justify-center select-none sm:bottom-[calc(1rem+env(safe-area-inset-bottom))]">
      <nav
        aria-label="Primary dock navigation"
        className="qikki-dock-bar pointer-events-auto flex w-[392px] max-w-[calc(100vw-1.5rem)] items-center justify-between gap-1 overflow-hidden rounded-full border border-white/85 bg-white/78 px-2.5 py-1.5 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.24),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.28)] backdrop-blur-[6px] backdrop-saturate-[140%] dark:border-white/[0.2] dark:bg-slate-900/74 dark:shadow-[0_18px_44px_-12px_rgba(0,0,0,0.72),inset_0_1.5px_0_rgba(255,255,255,0.24),inset_0_-1px_0_rgba(255,255,255,0.06)]"
      >
        {/* 1. Schedule */}
        <button
          type="button"
          onClick={() => onSelectTab('upcoming')}
          aria-label="Schedule"
          title="Schedule"
          aria-current={activeTab === 'upcoming' ? 'page' : undefined}
          className={`relative flex h-11 flex-1 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
            activeTab === 'upcoming'
              ? 'text-blue-600 dark:text-sky-300'
              : 'text-slate-700 hover:bg-slate-900/[0.06] hover:text-slate-950 dark:text-slate-200/85 dark:hover:bg-white/[0.08] dark:hover:text-white'
          }`}
        >
          {activeTab === 'upcoming' && (
            <span
              aria-hidden="true"
              className="qikki-dock-tab-glow pointer-events-none absolute inset-1 rounded-full bg-radial from-blue-500/28 via-sky-400/14 to-transparent blur-[4px] dark:from-sky-400/32 dark:via-blue-500/18 dark:to-transparent"
            />
          )}
          <CalendarDays
            className={`relative z-10 h-5 w-5 transition-transform duration-150 ${
              activeTab === 'upcoming'
                ? 'scale-105 stroke-[2.25] drop-shadow-[0_0_8px_rgba(37,99,235,0.45)] dark:drop-shadow-[0_0_10px_rgba(125,211,252,0.58)]'
                : 'stroke-[1.85]'
            }`}
            aria-hidden="true"
          />
          {activeTab === 'upcoming' && (
            <span
              aria-hidden="true"
              className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 h-1 w-4 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.65)] dark:bg-sky-300 dark:shadow-[0_0_10px_rgba(125,211,252,0.85)]"
            />
          )}
        </button>

        {/* 2. History */}
        <button
          type="button"
          onClick={() => onSelectTab('history')}
          aria-label="History"
          title="History & Recently Deleted"
          aria-current={activeTab === 'history' ? 'page' : undefined}
          className={`relative flex h-11 flex-1 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
            activeTab === 'history'
              ? 'text-blue-600 dark:text-sky-300'
              : 'text-slate-700 hover:bg-slate-900/[0.06] hover:text-slate-950 dark:text-slate-200/85 dark:hover:bg-white/[0.08] dark:hover:text-white'
          }`}
        >
          {activeTab === 'history' && (
            <span
              aria-hidden="true"
              className="qikki-dock-tab-glow pointer-events-none absolute inset-1 rounded-full bg-radial from-blue-500/28 via-sky-400/14 to-transparent blur-[4px] dark:from-sky-400/32 dark:via-blue-500/18 dark:to-transparent"
            />
          )}
          <History
            className={`relative z-10 h-5 w-5 transition-transform duration-150 ${
              activeTab === 'history'
                ? 'scale-105 stroke-[2.25] drop-shadow-[0_0_8px_rgba(37,99,235,0.45)] dark:drop-shadow-[0_0_10px_rgba(125,211,252,0.58)]'
                : 'stroke-[1.85]'
            }`}
            aria-hidden="true"
          />
          {activeTab === 'history' && (
            <span
              aria-hidden="true"
              className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 h-1 w-4 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.65)] dark:bg-sky-300 dark:shadow-[0_0_10px_rgba(125,211,252,0.85)]"
            />
          )}
        </button>

        {/* 3. Center Add Schedule (+) - Anchored directly in the middle */}
        <div className="flex flex-none items-center justify-center px-1">
          <button
            type="button"
            onClick={onOpenCreatePopup}
            aria-label="Add schedule"
            title="Add new schedule"
            className="qikki-accent-fab flex h-10 w-12 items-center justify-center rounded-full border transition-all duration-150 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Plus className="h-5 w-5 stroke-[2.5]" aria-hidden="true" />
          </button>
        </div>

        {/* 4. Preferences */}
        <button
          type="button"
          onClick={() => onSelectTab('preferences')}
          aria-label="Preferences"
          title="Preferences & Sync"
          aria-current={activeTab === 'preferences' ? 'page' : undefined}
          className={`relative flex h-11 flex-1 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
            activeTab === 'preferences'
              ? 'text-blue-600 dark:text-sky-300'
              : 'text-slate-700 hover:bg-slate-900/[0.06] hover:text-slate-950 dark:text-slate-200/85 dark:hover:bg-white/[0.08] dark:hover:text-white'
          }`}
        >
          {activeTab === 'preferences' && (
            <span
              aria-hidden="true"
              className="qikki-dock-tab-glow pointer-events-none absolute inset-1 rounded-full bg-radial from-blue-500/28 via-sky-400/14 to-transparent blur-[4px] dark:from-sky-400/32 dark:via-blue-500/18 dark:to-transparent"
            />
          )}
          <SlidersHorizontal
            className={`relative z-10 h-5 w-5 transition-transform duration-150 ${
              activeTab === 'preferences'
                ? 'scale-105 stroke-[2.25] drop-shadow-[0_0_8px_rgba(37,99,235,0.45)] dark:drop-shadow-[0_0_10px_rgba(125,211,252,0.58)]'
                : 'stroke-[1.85]'
            }`}
            aria-hidden="true"
          />
          {activeTab === 'preferences' && (
            <span
              aria-hidden="true"
              className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 h-1 w-4 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.65)] dark:bg-sky-300 dark:shadow-[0_0_10px_rgba(125,211,252,0.85)]"
            />
          )}
        </button>

        {/* 5. Far Right: Sign-in / Account Profile (Instagram-style right slot) */}
        <button
          type="button"
          disabled={isSigningIn}
          onClick={() => {
            if (user) {
              onOpenSyncPreferences();
            } else {
              onOpenAuth();
            }
          }}
          aria-label={
            user
              ? `Account & Cloud Sync (${firstName})`
              : 'Sign in or Register for Cloud Sync'
          }
          title={
            user
              ? `Synced as ${user.email || firstName}`
              : 'Sign in or Register to sync across devices'
          }
          className="relative flex h-11 flex-1 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-900/[0.06] hover:text-slate-950 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-200/85 dark:hover:bg-white/[0.08] dark:hover:text-white"
        >
          {user || avatarUrl ? (
            <UserAvatar
              photoURL={avatarUrl}
              displayName={user?.displayName}
              email={user?.email}
              size="xs"
              showTracing={true}
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-900/15 bg-white/80 text-slate-700 shadow-xs dark:border-white/18 dark:bg-white/[0.12] dark:text-slate-200">
              <UserIcon className="h-4 w-4 stroke-[2]" aria-hidden="true" />
            </span>
          )}
        </button>
      </nav>
    </div>
  );
};
