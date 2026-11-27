import { getApps, initializeApp } from '@firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from '@firebase/auth';

declare global {
  interface Window {
    __QIKKI_FIREBASE_CONFIG__?: Record<string, unknown>;
    __QIKKI_AUTH_RUNNING__?: boolean;
    qikkiDesktop?: {
      completeDesktopAuth?: (payload: {
        ok: boolean;
        idToken?: string | null;
        accessToken?: string | null;
        code?: string;
        message?: string;
      }) => Promise<void>;
    };
  }
}

(async () => {
  if (window.__QIKKI_AUTH_RUNNING__) return;
  window.__QIKKI_AUTH_RUNNING__ = true;

  try {
    const cfg = window.__QIKKI_FIREBASE_CONFIG__;
    if (!cfg) {
      throw new Error('Missing Firebase configuration for desktop sign-in.');
    }

    const app = getApps().length > 0 ? getApps()[0] : initializeApp(cfg);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const idToken = credential?.idToken ?? null;
    const accessToken = credential?.accessToken ?? null;

    await signOut(auth).catch(() => {});

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
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : 'auth/popup-closed-by-user';
    const message =
      err instanceof Error ? err.message : 'Google sign-in did not complete.';

    await window.qikkiDesktop?.completeDesktopAuth?.({
      ok: false,
      code,
      message,
    });
  }
})();
