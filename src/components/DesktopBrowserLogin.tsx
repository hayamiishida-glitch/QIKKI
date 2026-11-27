import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from '@firebase/auth';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../services/firebase';
import { GoogleMark } from './TopBar';

const DESKTOP_LOGIN_STORAGE_KEY = 'qikkiDesktopLoginSession';

export const DesktopBrowserLogin: React.FC = () => {
  const { port, state, isValid } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    let rawPort = Number(params.get('port'));
    let rawState = (params.get('state') || '').trim();

    if ((!rawPort || !rawState) && typeof sessionStorage !== 'undefined') {
      try {
        const stored = JSON.parse(
          sessionStorage.getItem(DESKTOP_LOGIN_STORAGE_KEY) || 'null'
        ) as { port?: number; state?: string } | null;
        if (stored && typeof stored.port === 'number' && typeof stored.state === 'string') {
          rawPort = stored.port;
          rawState = stored.state;
        }
      } catch {
        // Ignore storage read failure
      }
    }

    const validPort =
      Number.isInteger(rawPort) && rawPort >= 1024 && rawPort <= 65535;
    const validState = /^[a-f0-9]{16,128}$/i.test(rawState);

    if (validPort && validState && typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(
          DESKTOP_LOGIN_STORAGE_KEY,
          JSON.stringify({ port: rawPort, state: rawState })
        );
      } catch {
        // Ignore storage write failure
      }
    }

    return {
      port: validPort ? rawPort : 0,
      state: rawState,
      isValid: validPort && validState,
    };
  }, []);

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [completed, setCompleted] = useState(false);
  const redirectCheckedRef = useRef(false);

  const submitFormFallback = useCallback(
    (payload: {
      state: string;
      idToken?: string;
      accessToken?: string;
      errorCode?: string;
      errorMessage?: string;
    }) => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `http://localhost:${port}/auth/callback`;

      const appendField = (name: string, value: string) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      };

      appendField('state', payload.state);
      if (payload.idToken) appendField('idToken', payload.idToken);
      if (payload.accessToken) appendField('accessToken', payload.accessToken);
      if (payload.errorCode) appendField('errorCode', payload.errorCode);
      if (payload.errorMessage) appendField('errorMessage', payload.errorMessage);

      document.body.appendChild(form);
      form.submit();
    },
    [port]
  );

  const postToDesktop = useCallback(
    async (payload: {
      state: string;
      idToken?: string;
      accessToken?: string;
      errorCode?: string;
      errorMessage?: string;
    }) => {
      try {
        const resp = await fetch(`http://localhost:${port}/auth/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const data = (await resp.json().catch(() => null)) as {
          ok?: boolean;
          message?: string;
        } | null;

        if (resp.ok && data?.ok) {
          try {
            sessionStorage.removeItem(DESKTOP_LOGIN_STORAGE_KEY);
          } catch {
            // Ignore cleanup failure
          }
          setCompleted(true);
          setIsBusy(false);
          setTimeout(() => {
            try {
              window.close();
            } catch {
              // Browser tab close can be ignored if script-restricted
            }
          }, 900);
          return;
        }

        setDone(false);
        setIsBusy(false);
        setError(
          data?.message ||
            'Could not complete sign-in with Qikki Desktop. Return to the app and click Sign in with Google again.'
        );
      } catch {
        // Fallback to classic form POST if fetch is blocked
        submitFormFallback(payload);
      }
    },
    [port, submitFormFallback]
  );

  useEffect(() => {
    if (!isValid || redirectCheckedRef.current) return;
    redirectCheckedRef.current = true;

    void (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!result) return;
        setIsBusy(true);
        const cred = GoogleAuthProvider.credentialFromResult(result);
        const idToken = cred?.idToken || '';
        const accessToken = cred?.accessToken || '';
        await signOut(auth).catch(() => {});

        if (!idToken && !accessToken) {
          setError('Google did not return an authentication credential.');
          setIsBusy(false);
          return;
        }

        setDone(true);
        await postToDesktop({ state, idToken, accessToken });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Google sign-in could not complete.';
        setError(message);
        setIsBusy(false);
      }
    })();
  }, [isValid, postToDesktop, state]);

  const handleContinueWithGoogle = async () => {
    if (!isValid || isBusy) return;
    setError(null);
    setIsBusy(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const cred = GoogleAuthProvider.credentialFromResult(result);
      const idToken = cred?.idToken || '';
      const accessToken = cred?.accessToken || '';

      await signOut(auth).catch(() => {});

      if (!idToken && !accessToken) {
        setError('Google did not return an authentication credential.');
        setIsBusy(false);
        return;
      }

      setDone(true);
      await postToDesktop({ state, idToken, accessToken });
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      if (code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          setError(
            redirectErr instanceof Error
              ? redirectErr.message
              : 'Popup was blocked and redirect sign-in failed.'
          );
          setIsBusy(false);
          return;
        }
      }
      const message =
        err instanceof Error ? err.message : 'Google sign-in was cancelled.';
      setError(
        code === 'auth/popup-closed-by-user'
          ? 'Sign-in popup was closed. Click Continue with Google to try again.'
          : message
      );
      setIsBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/85 p-7 shadow-2xl backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-white">
              Sign in to Qikki Desktop
            </h1>
            <p className="text-xs text-slate-300/80">
              Authenticate in your browser and return directly to the app.
            </p>
          </div>
        </div>

        {!isValid ? (
          <div className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-950/40 p-4 text-xs text-amber-200">
            Invalid or expired desktop login link. Return to the Qikki desktop app and click Sign in with Google again.
          </div>
        ) : completed ? (
          <div className="mt-6 flex items-center gap-2.5 rounded-2xl border border-emerald-400/25 bg-emerald-950/40 p-4 text-xs text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Signed in to Qikki! You can close this browser tab and return to the Qikki app.
            </span>
          </div>
        ) : done ? (
          <div className="mt-6 flex items-center gap-2.5 rounded-2xl border border-emerald-400/25 bg-emerald-950/40 p-4 text-xs text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Sending credentials back to Qikki desktop...</span>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={() => void handleContinueWithGoogle()}
              disabled={isBusy}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100 disabled:opacity-60"
            >
              <GoogleMark className="h-4 w-4" />
              <span>{isBusy ? 'Waiting for Google...' : 'Continue with Google'}</span>
            </button>

            {error && (
              <p className="rounded-xl border border-amber-400/25 bg-amber-950/35 px-3.5 py-2.5 text-xs text-amber-200">
                {error}
              </p>
            )}

            <p className="text-center text-[11px] text-slate-400">
              Your credentials are sent only to your local Qikki desktop instance on port {port}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
