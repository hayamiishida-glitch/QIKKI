import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'register';
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
  onSuccess,
}) => {
  const {
    isSigningIn,
    authError,
    authErrorAction,
    registerWithEmail,
    signInWithEmail,
    sendPasswordReset,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>(
    initialMode
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localValidation, setLocalValidation] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(
    null
  );

  const resetState = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setLocalValidation(null);
    setResetSuccessMessage(null);
    clearAuthError();
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSwitchMode = (nextMode: 'signin' | 'register' | 'forgot') => {
    clearAuthError();
    setLocalValidation(null);
    setResetSuccessMessage(null);
    setMode(nextMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalValidation(null);
    setResetSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalValidation('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setLocalValidation('Please enter a valid email address.');
      return;
    }

    if (mode === 'forgot') {
      const ok = await sendPasswordReset(trimmedEmail);
      if (ok) {
        setResetSuccessMessage(
          `Password reset link sent to ${trimmedEmail}. Check your inbox!`
        );
      }
      return;
    }

    if (!password) {
      setLocalValidation('Please enter your password.');
      return;
    }
    if (password.length < 6) {
      setLocalValidation('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setLocalValidation('Passwords do not match.');
        return;
      }
      const user = await registerWithEmail(
        trimmedEmail,
        password,
        displayName.trim()
      );
      if (user) {
        resetState();
        onClose();
        onSuccess?.();
      }
    } else {
      const user = await signInWithEmail(trimmedEmail, password);
      if (user) {
        resetState();
        onClose();
        onSuccess?.();
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
        >
          {/* Glass Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
            }}
            exit={{
              opacity: 0,
              transition: { duration: 0.14, ease: [0.2, 0, 0, 1] },
            }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-[6px]"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
            }}
            exit={{
              opacity: 0,
              scale: 0.97,
              y: 6,
              transition: { duration: 0.14, ease: [0.2, 0, 0, 1] },
            }}
            className="qikki-glass-modal relative w-full max-w-md overflow-hidden rounded-3xl border border-white/80 bg-white/74 p-5 shadow-[0_28px_72px_-14px_rgba(15,23,42,0.34),inset_0_1.5px_0_rgba(255,255,255,0.96),inset_0_-1px_0_rgba(255,255,255,0.3)] backdrop-blur-[28px] backdrop-saturate-[185%] sm:p-7 dark:border-white/[0.18] dark:bg-slate-900/64 dark:text-slate-100 dark:shadow-[0_32px_80px_-14px_rgba(0,0,0,0.78),inset_0_1.5px_0_rgba(255,255,255,0.24),inset_0_-1px_0_rgba(255,255,255,0.06)]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="auth-modal-title"
                  className="font-display text-xl font-bold tracking-tight text-slate-950 dark:text-white"
                >
                  {mode === 'register'
                    ? 'Create Qikki Account'
                    : mode === 'forgot'
                      ? 'Reset Password'
                      : 'Sign In to Qikki'}
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300/85">
                  {mode === 'register'
                    ? 'Register with your email to sync your schedules and alarms online across all your devices.'
                    : mode === 'forgot'
                      ? 'Enter your email to receive a password reset link.'
                      : 'Log in to securely sync your reminders in real-time across web, desktop, and other devices.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close modal"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-900/10 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Mode Switcher (Sign In vs Register) */}
            {mode !== 'forgot' && (
              <div
                role="tablist"
                aria-label="Authentication mode"
                className="mt-4 grid grid-cols-2 rounded-xl bg-slate-900/[0.06] p-1 dark:bg-white/[0.08]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'signin'}
                  onClick={() => handleSwitchMode('signin')}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                    mode === 'signin'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.18] dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => handleSwitchMode('register')}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                    mode === 'register'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.18] dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Register (New User)
                </button>
              </div>
            )}

            {/* Diagnostic / Error message banner */}
            {(authError || localValidation) && (
              <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-50/90 p-3 text-xs text-amber-900 shadow-xs dark:border-amber-400/25 dark:bg-amber-950/50 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="leading-snug">
                      {localValidation || authError}
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
                  </div>
                </div>
              </div>
            )}

            {/* Reset success banner */}
            {resetSuccessMessage && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-50/90 p-3 text-xs text-emerald-900 shadow-xs dark:border-emerald-400/25 dark:bg-emerald-950/50 dark:text-emerald-200">
                <CheckCircle2
                  className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <span className="leading-snug">{resetSuccessMessage}</span>
              </div>
            )}

            {/* Credentials Form */}
            <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
              {mode === 'register' && (
                <div className="space-y-1">
                  <label
                    htmlFor="auth-displayName"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Your Name (optional)
                  </label>
                  <div className="relative">
                    <UserIcon
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-displayName"
                      type="text"
                      autoComplete="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="h-9 w-full rounded-xl border border-slate-900/12 bg-white/80 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-white/14 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label
                  htmlFor="auth-email"
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
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="h-9 w-full rounded-xl border border-slate-900/12 bg-white/80 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-white/14 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="auth-password"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Password
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => handleSwitchMode('forgot')}
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
                      id="auth-password"
                      type="password"
                      autoComplete={
                        mode === 'register' ? 'new-password' : 'current-password'
                      }
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="h-9 w-full rounded-xl border border-slate-900/12 bg-white/80 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-white/14 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <div className="space-y-1">
                  <label
                    htmlFor="auth-confirmPassword"
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
                      id="auth-confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="h-9 w-full rounded-xl border border-slate-900/12 bg-white/80 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-white/14 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSigningIn}
                className="qikki-accent-btn mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold shadow-xs transition-colors active:scale-[0.99] disabled:opacity-50"
              >
                {mode === 'register' ? (
                  <>
                    <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {isSigningIn ? 'Creating account...' : 'Create Account & Start Sync'}
                    </span>
                  </>
                ) : mode === 'forgot' ? (
                  <span>
                    {isSigningIn ? 'Sending link...' : 'Send Password Reset Link'}
                  </span>
                ) : (
                  <>
                    <span>{isSigningIn ? 'Signing in...' : 'Sign In'}</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </>
                )}
              </button>

              {mode === 'forgot' && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('signin')}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              )}
            </form>

            {/* Bottom privacy reassurance */}
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Zero tracking. Your schedules are stored privately under your account.</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
