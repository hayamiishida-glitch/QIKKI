import React, { useEffect, useRef, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from '@firebase/auth';
import { auth, googleProvider } from '../services/firebase';

export const DesktopAuthBridge: React.FC = () => {
  const startedRef = useRef(false);
  const [status, setStatus] = useState('Opening Google Sign-In...');

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const idToken = credential?.idToken ?? null;
        const accessToken = credential?.accessToken ?? null;

        await signOut(auth).catch(() => {});

        if (!cancelled) {
          setStatus('Completing sign-in...');
          await window.qikkiDesktop?.completeDesktopAuth?.({
            ok: Boolean(idToken || accessToken),
            idToken,
            accessToken,
            code: !idToken && !accessToken ? 'auth/missing-credential' : undefined,
            message:
              !idToken && !accessToken
                ? 'Google did not return an authentication token.'
                : undefined,
          });
        }
      } catch (err) {
        if (!cancelled) {
          const code =
            err && typeof err === 'object' && 'code' in err
              ? String((err as { code?: unknown }).code || '')
              : '';
          const message =
            err instanceof Error ? err.message : 'Google sign-in failed.';
          setStatus(message);
          await window.qikkiDesktop?.completeDesktopAuth?.({
            ok: false,
            code,
            message,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-sm text-slate-200">
      <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-900/80 px-6 py-5 shadow-xl">
        <p className="font-semibold text-white">Qikki — Google Sign-In</p>
        <p className="text-xs text-slate-300">{status}</p>
      </div>
    </div>
  );
};
