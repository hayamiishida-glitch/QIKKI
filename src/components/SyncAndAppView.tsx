import React, { useRef, useState } from 'react';
import type { User } from '@firebase/auth';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Download,
  ExternalLink,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  Camera,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  User as UserIcon,
} from 'lucide-react';
import type {
  PortableSyncBundle,
  Reminder,
  SyncAdapterStatus,
} from '../types/reminder';
import { GoogleMark } from './TopBar';
import { useAuth } from '../contexts/AuthContext';
import { UserAvatar } from './UserAvatar';
import { ProfilePictureModal } from './ProfilePictureModal';

interface SyncAndAppViewProps {
  reminders: Reminder[];
  syncStatus: SyncAdapterStatus;
  user: User | null;
  isSigningIn: boolean;
  isWaitingForBrowserAuth?: boolean;
  isCloudSyncing: boolean;
  authError: string | null;
  needsNewTabForAuth: boolean;
  onSignOut?: () => Promise<void>;
  onGoogleSignOut?: () => Promise<void>;
  onCloudSyncNow: () => Promise<{ ok: boolean; message: string }>;
  onExportBundle: () => PortableSyncBundle;
  onImportBundle: (
    bundle: PortableSyncBundle
  ) => Promise<{ added: number; updated: number }>;
  onOpenPreferences?: () => void;
  onOpenAuth?: () => void;
  onClearLocalData?: () => Promise<void>;
  onAccountDeleted?: () => Promise<void>;
  embeddedInPreferences?: boolean;
}

export const SyncAndAppView: React.FC<SyncAndAppViewProps> = ({
  reminders,
  syncStatus,
  user,
  isSigningIn,
  isWaitingForBrowserAuth = false,
  isCloudSyncing,
  authError,
  needsNewTabForAuth,
  onSignOut,
  onGoogleSignOut,
  onCloudSyncNow,
  onExportBundle,
  onImportBundle,
  onOpenPreferences,
  onOpenAuth,
  onClearLocalData,
  onAccountDeleted,
  embeddedInPreferences = false,
}) => {
  const {
    registerWithEmail,
    signInWithEmail,
    sendPasswordReset,
    deleteAccount,
    isDeletingAccount,
    authErrorCode,
    authErrorAction,
    clearAuthError,
    avatarUrl,
    updateAvatar,
  } = useAuth();

  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [confirmClearLocal, setConfirmClearLocal] = useState(false);
  const [isClearingLocal, setIsClearingLocal] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [authTab, setAuthTab] = useState<'register' | 'signin' | 'forgot'>('register');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formValidation, setFormValidation] = useState<string | null>(null);
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasPasswordProvider = Boolean(
    user?.providerData.some((p) => p.providerId === 'password')
  );

  const handleConfirmDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    if (hasPasswordProvider && !deletePassword) {
      setDeleteError('Please enter your current password to confirm account deletion.');
      return;
    }

    const res = await deleteAccount(
      hasPasswordProvider ? deletePassword : undefined
    );
    if (!res.ok) {
      setDeleteError(res.error || 'Could not delete your account.');
      return;
    }

    setConfirmDeleteAccount(false);
    setDeletePassword('');
    setDeleteError(null);
    await onAccountDeleted?.();
    setFeedback('Your Qikki account and synced cloud data have been permanently deleted.');
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidation(null);
    setFormSuccessMessage(null);
    clearAuthError();

    const trimmedEmail = formEmail.trim();
    if (!trimmedEmail) {
      setFormValidation('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormValidation('Please enter a valid email address.');
      return;
    }

    if (authTab === 'forgot') {
      const ok = await sendPasswordReset(trimmedEmail);
      if (ok) {
        setFormSuccessMessage(
          `Password reset link sent to ${trimmedEmail}. Please check your inbox.`
        );
      }
      return;
    }

    if (!formPassword) {
      setFormValidation('Please enter a password.');
      return;
    }
    if (formPassword.length < 6) {
      setFormValidation('Password must be at least 6 characters.');
      return;
    }

    if (authTab === 'register') {
      if (formPassword !== formConfirmPassword) {
        setFormValidation('Passwords do not match.');
        return;
      }
      const newUser = await registerWithEmail(
        trimmedEmail,
        formPassword,
        formName.trim()
      );
      if (newUser) {
        setFormEmail('');
        setFormPassword('');
        setFormConfirmPassword('');
        setFormName('');
      }
    } else {
      const loggedIn = await signInWithEmail(trimmedEmail, formPassword);
      if (loggedIn) {
        setFormEmail('');
        setFormPassword('');
      }
    }
  };

  const handleDownloadBackup = () => {
    const bundle = onExportBundle();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qikki-backup-${new Date().toISOString().slice(0, 10)}.qikki.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setFeedback(`Exported ${bundle.reminders.length} reminders to portable bundle.`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as PortableSyncBundle;
      if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.reminders)) {
        setFeedback('Invalid backup file format.');
        return;
      }
      const res = await onImportBundle(parsed);
      setFeedback(
        `Merged bundle: ${res.added} added, ${res.updated} updated using timestamp conflict resolution.`
      );
    } catch {
      setFeedback('Could not parse backup file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSyncNow = async () => {
    setIsManualSyncing(true);
    const result = await onCloudSyncNow();
    setFeedback(result.message);
    setIsManualSyncing(false);
  };

  const initials = (user?.displayName || user?.email || 'Q')
    .trim()
    .slice(0, 1)
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Multi-Device Account & Cloud Sync */}
      <section className="qikki-glass-card rounded-3xl border border-white/80 bg-white/58 p-6 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Cloud className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>Cloud Account &amp; Multi-Device Sync</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-300/80">
              Create an account or sign in to sync reminders, schedules, and all customized settings across your phone, tablet, and PC in real time.
            </p>
          </div>
        </div>

        {/* Not signed in: Inline Registration & Sign-In Form */}
        {!user && (
          <div className="mt-5 rounded-2xl border border-slate-900/[0.08] bg-white/50 p-4 sm:p-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            {/* Tab switch between Register and Sign In */}
            <div
              role="tablist"
              aria-label="Account access mode"
              className="grid max-w-sm grid-cols-2 rounded-xl bg-slate-900/[0.06] p-1 dark:bg-white/[0.08]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'register'}
                onClick={() => {
                  setAuthTab('register');
                  setFormValidation(null);
                  setFormSuccessMessage(null);
                  clearAuthError();
                }}
                className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  authTab === 'register'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.18] dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Create Account (New User)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'signin'}
                onClick={() => {
                  setAuthTab('signin');
                  setFormValidation(null);
                  setFormSuccessMessage(null);
                  clearAuthError();
                }}
                className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  authTab === 'signin'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.18] dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
            </div>

            {/* Error / Action banner */}
            {(authError || formValidation) && (
              <div className="mt-3.5 rounded-xl border border-amber-400/40 bg-amber-50/90 p-3 text-xs text-amber-900 shadow-xs dark:border-amber-400/25 dark:bg-amber-950/50 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="leading-snug">
                      {formValidation || authError}
                    </p>
                    {authErrorAction && (
                      <a
                        href={authErrorAction.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-blue-700 underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                      >
                        <span>{authErrorAction.label}</span>
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                    {needsNewTabForAuth && !authErrorAction && (
                      <a
                        href={typeof window !== 'undefined' ? window.location.href : '/'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="qikki-accent-btn inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        <span>Open Qikki in New Tab</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Success message */}
            {formSuccessMessage && (
              <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-50/90 p-3 text-xs text-emerald-900 shadow-xs dark:border-emerald-400/25 dark:bg-emerald-950/50 dark:text-emerald-200">
                <CheckCircle2
                  className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <span className="leading-snug">{formSuccessMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={(e) => void handleAuthSubmit(e)} className="mt-4 max-w-lg space-y-3">
              {authTab === 'register' && (
                <div className="space-y-1">
                  <label
                    htmlFor="sync-formName"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Display Name (optional)
                  </label>
                  <div className="relative">
                    <UserIcon
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="sync-formName"
                      type="text"
                      autoComplete="name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="h-9 w-full rounded-xl border border-slate-900/12 bg-white/80 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-white/14 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label
                  htmlFor="sync-formEmail"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="sync-formEmail"
                    type="email"
                    autoComplete="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="h-9 w-full rounded-xl border border-slate-900/12 bg-white/80 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-white/14 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              {authTab !== 'forgot' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="sync-formPassword"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Password
                    </label>
                    {authTab === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthTab('forgot');
                          setFormValidation(null);
                          setFormSuccessMessage(null);
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="sync-formPassword"
                      type="password"
                      autoComplete={
                        authTab === 'register' ? 'new-password' : 'current-password'
                      }
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="h-9 w-full rounded-xl border border-slate-900/12 bg-white/80 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-white/14 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              )}

              {authTab === 'register' && (
                <div className="space-y-1">
                  <label
                    htmlFor="sync-formConfirmPassword"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="sync-formConfirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={formConfirmPassword}
                      onChange={(e) => setFormConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="h-9 w-full rounded-xl border border-slate-900/12 bg-white/80 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-white/14 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              )}

              <div className="pt-1 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={isSigningIn}
                  className="qikki-accent-btn inline-flex h-9 items-center justify-center gap-2 rounded-xl px-5 text-xs font-semibold shadow-xs transition-colors active:scale-[0.99] disabled:opacity-50"
                >
                  {authTab === 'register' ? (
                    <>
                      <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isSigningIn ? 'Creating account...' : 'Create Account & Sync'}</span>
                    </>
                  ) : authTab === 'forgot' ? (
                    <span>{isSigningIn ? 'Sending link...' : 'Send Reset Link'}</span>
                  ) : (
                    <>
                      <span>{isSigningIn ? 'Signing in...' : 'Sign In & Sync'}</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </>
                  )}
                </button>

                {authTab === 'forgot' && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('signin');
                      setFormValidation(null);
                      setFormSuccessMessage(null);
                    }}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  >
                    ← Back to Sign In
                  </button>
                )}
              </div>
            </form>

            {/* Bottom privacy badge */}
            <div className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Zero tracking. Your data is stored privately under your own account.</span>
            </div>
          </div>
        )}

        {user ? (
          <div className="mt-5 flex flex-col justify-between gap-4 border-t border-slate-900/[0.08] pt-5 sm:flex-row sm:items-center dark:border-white/[0.09]">
            <div className="flex items-center gap-3 min-w-0">
              <UserAvatar
                photoURL={avatarUrl}
                displayName={user.displayName}
                email={user.email}
                size="md"
                showTracing={true}
                onClick={() => setAvatarModalOpen(true)}
                showEditBadge={true}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {user.displayName || user.email?.split('@')[0] || 'Cloud Account'}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    {isCloudSyncing ? 'Syncing...' : 'Cloud Active'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300/75">
                  <span className="truncate">{user.email}</span>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {user.providerData.some((p) => p.providerId === 'password')
                      ? 'Email Account'
                      : 'Google Account'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAvatarModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/12 bg-white/65 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-white whitespace-nowrap dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.13]"
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Change Picture</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSyncNow()}
                disabled={isManualSyncing || isCloudSyncing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/12 bg-white/65 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-white disabled:opacity-50 whitespace-nowrap dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.13]"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    isManualSyncing || isCloudSyncing ? 'animate-spin' : ''
                  }`}
                  aria-hidden="true"
                />
                <span>Sync Now</span>
              </button>
              <button
                type="button"
                onClick={() => void (onSignOut ? onSignOut() : onGoogleSignOut?.())}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/12 bg-white/65 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700 whitespace-nowrap dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-300 dark:hover:bg-red-500/15 dark:hover:text-red-300"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 border-t border-slate-900/[0.08] pt-5 text-xs sm:grid-cols-3 dark:border-white/[0.09]">
            <div>
              <span className="text-slate-500 dark:text-slate-300/75">Storage Mode</span>
              <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                Offline-First Local (IndexedDB)
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-300/75">Device Origin</span>
              <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {syncStatus.deviceName}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-300/75">Stored Records</span>
              <p className="mt-1 font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {reminders.length} active
              </p>
            </div>
          </div>
        )}

        {user && (
          <div className="mt-5 grid gap-4 border-t border-slate-900/[0.08] pt-5 text-xs sm:grid-cols-3 dark:border-white/[0.09]">
            <div>
              <span className="text-slate-500 dark:text-slate-300/75">Sync Mode</span>
              <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                Cloud Firestore + Offline Cache
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-300/75">Device Origin</span>
              <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {syncStatus.deviceName}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-300/75">Last Cloud Sync</span>
              <p className="mt-1 font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {syncStatus.lastSyncedAt
                  ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Real-time'}
              </p>
            </div>
          </div>
        )}

        {/* Permanent Account Deletion */}
        {user && (
          <div className="mt-5 border-t border-slate-900/[0.08] pt-5 dark:border-white/[0.09]">
            {!confirmDeleteAccount ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Delete Account
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300/75">
                    Permanently remove your Qikki account, synced cloud reminders, and preferences.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteAccount(true);
                    setDeletePassword('');
                    setDeleteError(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/80 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 shrink-0 dark:border-red-500/25 dark:bg-red-500/12 dark:text-red-300 dark:hover:bg-red-500/22"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Delete Account</span>
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => void handleConfirmDeleteAccount(e)}
                className="space-y-3 rounded-2xl border border-red-300/70 bg-red-50/90 p-4 text-xs dark:border-red-500/30 dark:bg-red-950/45"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <p className="font-semibold text-red-900 dark:text-red-100">
                      Permanently delete {user.email || 'your account'}?
                    </p>
                    <p className="leading-relaxed text-red-800/90 dark:text-red-200/85">
                      This will permanently erase your Qikki login, all synced cloud reminders, and local device cache. This action cannot be undone.
                    </p>
                  </div>
                </div>

                {hasPasswordProvider && (
                  <div className="space-y-1">
                    <label
                      htmlFor="delete-account-password"
                      className="block font-medium text-red-900 dark:text-red-200"
                    >
                      Confirm current password
                    </label>
                    <div className="relative max-w-sm">
                      <Lock
                        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-red-500/70"
                        aria-hidden="true"
                      />
                      <input
                        id="delete-account-password"
                        type="password"
                        autoComplete="current-password"
                        required
                        disabled={isDeletingAccount}
                        value={deletePassword}
                        onChange={(e) => {
                          setDeletePassword(e.target.value);
                          setDeleteError(null);
                        }}
                        placeholder="Enter your password"
                        className="h-9 w-full rounded-xl border border-red-300/80 bg-white/90 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none dark:border-red-500/30 dark:bg-slate-900/70 dark:text-white dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                )}

                {deleteError && (
                  <p className="font-medium text-red-700 dark:text-red-300">
                    {deleteError}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="submit"
                    disabled={isDeletingAccount}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {isDeletingAccount
                        ? 'Deleting account...'
                        : 'Permanently Delete Account'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingAccount}
                    onClick={() => {
                      setConfirmDeleteAccount(false);
                      setDeletePassword('');
                      setDeleteError(null);
                    }}
                    className="rounded-lg px-2.5 py-1.5 font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {feedback && (
          <p className="mt-4 text-xs text-blue-700 dark:text-blue-300">
            {feedback}
          </p>
        )}
      </section>

      {/* Portable Export / Import Backup & Preferences Shortcut */}
      <section className="qikki-glass-card rounded-3xl border border-white/80 bg-white/58 p-6 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.22),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.32)] backdrop-blur-[28px] backdrop-saturate-[185%] dark:border-white/[0.18] dark:bg-slate-900/38 dark:shadow-[0_24px_56px_-14px_rgba(0,0,0,0.68),0_2px_10px_-2px_rgba(0,0,0,0.35),inset_0_1.5px_0_rgba(255,255,255,0.26),inset_0_-1px_0_rgba(255,255,255,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Offline Snapshot &amp; Portable Backup
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300/75">
              Export or merge local schedules ({reminders.length} active schedules) using timestamp conflict resolution.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-900/12 bg-white/65 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-white dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.13]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export (.json)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-900/12 bg-white/65 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-white dark:border-white/14 dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.13]"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Import &amp; Merge</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.qikki.json,.cadence.json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {!embeddedInPreferences && onOpenPreferences && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-900/[0.08] pt-4 text-xs dark:border-white/[0.09]">
            <span className="text-slate-500 dark:text-slate-300/75">
              Startup behavior, notification shortcuts, Appearance, and Weather live in Preferences.
            </span>
            <button
              type="button"
              onClick={onOpenPreferences}
              className="inline-flex items-center gap-1.5 font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Open Preferences →</span>
            </button>
          </div>
        )}

        {/* Local Uninstall Cleanup & Cloud Preservation */}
        <div className="mt-5 border-t border-slate-900/[0.08] pt-5 dark:border-white/[0.09]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-xl">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                Local Device Storage &amp; Uninstall Policy
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-300/75">
                Uninstalling Qikki automatically deletes all local device data (offline IndexedDB cache, preferences, and local sign-in session). Your synced reminders and customized settings remain preserved in Cloud Firestore so you can restore them anytime you sign back in.
              </p>
            </div>

            {onClearLocalData && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!confirmClearLocal ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearLocal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/80 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/12 dark:text-red-300 dark:hover:bg-red-500/22"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Clear Local Data (Keep Cloud)</span>
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-300/70 bg-red-50/90 px-3 py-2 text-xs dark:border-red-500/30 dark:bg-red-950/45">
                    <span className="font-medium text-red-800 dark:text-red-200">
                      Clear device cache &amp; sign out? Cloud stays safe.
                    </span>
                    <button
                      type="button"
                      disabled={isClearingLocal}
                      onClick={() => {
                        setIsClearingLocal(true);
                        void onClearLocalData()
                          .then(() => {
                            setConfirmClearLocal(false);
                            setFeedback(
                              'Local device data cleared. Sign back in anytime to restore your Cloud schedules.'
                            );
                          })
                          .finally(() => setIsClearingLocal(false));
                      }}
                      className="rounded-lg bg-red-600 px-2.5 py-1 font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {isClearingLocal ? 'Clearing...' : 'Confirm Clear'}
                    </button>
                    <button
                      type="button"
                      disabled={isClearingLocal}
                      onClick={() => setConfirmClearLocal(false)}
                      className="rounded-lg px-2 py-1 font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <ProfilePictureModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        currentPhotoURL={avatarUrl}
        displayName={user?.displayName}
        email={user?.email}
        onSaveAvatar={async (url) => {
          await updateAvatar(url);
          setFeedback('Profile picture updated successfully.');
        }}
      />
    </div>
  );
};
