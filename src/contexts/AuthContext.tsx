import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { onAuthStateChanged, type User } from '@firebase/auth';
import {
  auth,
  AVATAR_INITIALS_SENTINEL,
  deleteCurrentAuthAccount,
  deleteUserCloudData,
  ensureUserProfileDoc,
  getAvatarStorageKey,
  reauthenticateForAccountDeletion,
  registerWithEmailPassword,
  resetPasswordForEmail,
  resolveGoogleRedirectSignIn,
  signInWithEmailPassword,
  signOutGoogle,
  subscribeUserProfileAvatar,
  updateUserAvatar,
} from '../services/firebase';
import { detectDeviceOrigin } from '../services/storage/syncAdapter';
import { isEmbeddedIframe } from '../services/notificationService';

interface AuthContextValue {
  user: User | null;
  avatarUrl: string | null;
  authReady: boolean;
  isSigningIn: boolean;
  isDeletingAccount: boolean;
  authError: string | null;
  needsNewTabForAuth: boolean;
  registerWithEmail: (
    email: string,
    pass: string,
    displayName?: string
  ) => Promise<User | null>;
  signInWithEmail: (email: string, pass: string) => Promise<User | null>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  deleteAccount: (password?: string) => Promise<{ ok: boolean; error?: string }>;
  clearAuthError: () => void;
  authErrorCode: string | null;
  authErrorAction?: { label: string; url: string } | null;
  updateAvatar: (url: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function formatAuthErrorMessage(
  err: unknown,
  inIframe: boolean
): {
  message: string;
  needsNewTab: boolean;
  code: string | null;
  action?: { label: string; url: string };
} {
  if (!err || typeof err !== 'object') {
    return {
      message: 'Could not complete sign-in request.',
      needsNewTab: false,
      code: null,
    };
  }
  const code = (err as { code?: string }).code || '';

  if (code === 'auth/operation-not-allowed') {
    return {
      message:
        'Email/Password sign-in is not enabled in your Firebase console yet. Please enable it in Firebase Console -> Authentication -> Sign-in method -> Email/Password -> Enable -> Save.',
      needsNewTab: false,
      code,
      action: {
        label: 'Open Firebase Sign-in Methods',
        url: 'https://console.firebase.google.com/project/elemental-enigma-kgt36/authentication/providers',
      },
    };
  }

  if (code === 'auth/email-already-in-use') {
    return {
      message:
        'An account with this email address already exists. Please switch to the Sign In tab.',
      needsNewTab: false,
      code,
    };
  }

  if (code === 'auth/invalid-email') {
    return {
      message: 'Please enter a valid email address.',
      needsNewTab: false,
      code,
    };
  }

  if (code === 'auth/weak-password') {
    return {
      message: 'Password must be at least 6 characters long.',
      needsNewTab: false,
      code,
    };
  }

  if (code === 'auth/user-not-found') {
    return {
      message:
        'No account found with this email. Please click "Register" to create your sync account.',
      needsNewTab: false,
      code,
    };
  }

  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return {
      message:
        'Incorrect email or password. Please verify your credentials or use "Forgot Password".',
      needsNewTab: false,
      code,
    };
  }

  if (code === 'auth/too-many-requests') {
    return {
      message:
        'Access temporarily disabled due to multiple failed attempts. Please wait a moment or reset your password.',
      needsNewTab: false,
      code,
    };
  }

  if (
    inIframe &&
    (code === 'auth/popup-closed-by-user' ||
      code === 'auth/popup-blocked' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/unauthorized-domain')
  ) {
    return {
      message:
        'Embedded preview closed or blocked the Google sign-in popup. Open Qikki in a full browser tab or register with Email & Password below.',
      needsNewTab: true,
      code,
    };
  }
  if (code === 'auth/popup-closed-by-user') {
    return {
      message: 'Sign-in window was closed before completing.',
      needsNewTab: false,
      code,
    };
  }
  if (code === 'auth/popup-blocked') {
    return {
      message:
        'Popup was blocked by the browser. Allow popups for Qikki or register with Email & Password below.',
      needsNewTab: inIframe,
      code,
    };
  }
  if (code === 'auth/cancelled-popup-request') {
    return {
      message: 'Sign-in request was cancelled.',
      needsNewTab: false,
      code,
    };
  }
  if (code === 'auth/unauthorized-domain') {
    const host =
      typeof window !== 'undefined' && window.location.hostname
        ? window.location.hostname
        : 'this host';
    return {
      message: `Domain "${host}" is not in Firebase Authorized Domains yet. You can register/sign in with Email & Password below directly (works immediately on all domains), or add "${host}" in Firebase Console.`,
      needsNewTab: false,
      code,
      action: {
        label: 'Open Firebase Authorized Domains',
        url: 'https://console.firebase.google.com/project/elemental-enigma-kgt36/authentication/settings',
      },
    };
  }
  if (code === 'auth/network-request-failed') {
    return {
      message:
        'Network unavailable. You can keep using Qikki offline and sync when online.',
      needsNewTab: false,
      code,
    };
  }
  return {
    message:
      err instanceof Error ? err.message : 'Could not complete authentication.',
    needsNewTab: false,
    code,
  };
}

function readStoredAvatar(uid?: string | null): string | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const raw = localStorage.getItem(getAvatarStorageKey(uid));
    return raw === null ? undefined : raw;
  } catch {
    return undefined;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [localAvatar, setLocalAvatar] = useState<string | undefined>(() =>
    readStoredAvatar(auth.currentUser?.uid)
  );
  const [cloudAvatar, setCloudAvatar] = useState<string | null | undefined>(undefined);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [authErrorAction, setAuthErrorAction] = useState<{
    label: string;
    url: string;
  } | null>(null);
  const [needsNewTabForAuth, setNeedsNewTabForAuth] = useState(false);

  useEffect(() => {
    void resolveGoogleRedirectSignIn();
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLocalAvatar(readStoredAvatar(firebaseUser?.uid));
      setCloudAvatar(undefined);
      setAuthReady(true);
      if (firebaseUser) {
        setAuthError(null);
        setAuthErrorCode(null);
        setAuthErrorAction(null);
        setNeedsNewTabForAuth(false);
        void ensureUserProfileDoc(firebaseUser, detectDeviceOrigin()).catch(
          (err) => {
            console.error('Could not sync user profile document:', err);
          }
        );
      }
    });
    return () => {
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!user || isDeletingAccount) return;
    const unsubProfile = subscribeUserProfileAvatar(user.uid, (photo) => {
      setCloudAvatar(photo);
      if (photo !== null) {
        try {
          if (typeof localStorage !== 'undefined') {
            const key = getAvatarStorageKey(user.uid);
            const valueToStore = photo ? photo : AVATAR_INITIALS_SENTINEL;
            localStorage.setItem(key, valueToStore);
            setLocalAvatar(valueToStore);
          }
        } catch {
          // Ignore storage error
        }
      }
    });
    return () => {
      unsubProfile();
    };
  }, [user, isDeletingAccount]);

  const registerWithEmail = useCallback(
    async (email: string, pass: string, displayName?: string) => {
      setAuthError(null);
      setAuthErrorCode(null);
      setAuthErrorAction(null);
      setNeedsNewTabForAuth(false);
      setIsSigningIn(true);
      try {
        const registeredUser = await registerWithEmailPassword(
          email,
          pass,
          displayName
        );
        return registeredUser;
      } catch (err) {
        const formatted = formatAuthErrorMessage(err, false);
        setAuthError(formatted.message);
        setAuthErrorCode(formatted.code);
        setAuthErrorAction(formatted.action ?? null);
        return null;
      } finally {
        setIsSigningIn(false);
      }
    },
    []
  );

  const signInWithEmail = useCallback(
    async (email: string, pass: string) => {
      setAuthError(null);
      setAuthErrorCode(null);
      setAuthErrorAction(null);
      setNeedsNewTabForAuth(false);
      setIsSigningIn(true);
      try {
        const signedInUser = await signInWithEmailPassword(email, pass);
        return signedInUser;
      } catch (err) {
        const formatted = formatAuthErrorMessage(err, false);
        setAuthError(formatted.message);
        setAuthErrorCode(formatted.code);
        setAuthErrorAction(formatted.action ?? null);
        return null;
      } finally {
        setIsSigningIn(false);
      }
    },
    []
  );

  const sendPasswordReset = useCallback(async (email: string) => {
    setAuthError(null);
    setAuthErrorCode(null);
    setAuthErrorAction(null);
    try {
      await resetPasswordForEmail(email);
      return true;
    } catch (err) {
      const formatted = formatAuthErrorMessage(err, false);
      setAuthError(formatted.message);
      setAuthErrorCode(formatted.code);
      setAuthErrorAction(formatted.action ?? null);
      return false;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setAuthError(null);
    setAuthErrorCode(null);
    setAuthErrorAction(null);
    setNeedsNewTabForAuth(false);
    try {
      await signOutGoogle();
    } catch (err) {
      const formatted = formatAuthErrorMessage(err, false);
      setAuthError(formatted.message);
      setAuthErrorCode(formatted.code);
      setAuthErrorAction(formatted.action ?? null);
    }
  }, []);

  const deleteAccount = useCallback(async (password?: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { ok: false, error: 'No signed-in account found.' };
    }

    try {
      // Reauthenticate BEFORE modifying Firestore so failed password checks never touch user data
      await reauthenticateForAccountDeletion(currentUser, password);
    } catch (err) {
      const code =
        err && typeof err === 'object' ? (err as { code?: string }).code || '' : '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        return {
          ok: false,
          error: 'Incorrect password. Please enter your current password to confirm.',
        };
      }
      if (code === 'auth/requires-password') {
        return {
          ok: false,
          error: 'Please enter your current password to confirm account deletion.',
        };
      }
      if (code === 'auth/popup-closed-by-user') {
        return {
          ok: false,
          error: 'Verification popup was closed before completing.',
        };
      }
      if (code === 'auth/too-many-requests') {
        return {
          ok: false,
          error: 'Too many failed attempts. Please wait a moment and try again.',
        };
      }
      const formatted = formatAuthErrorMessage(err, isEmbeddedIframe());
      return { ok: false, error: formatted.message };
    }

    setIsDeletingAccount(true);
    // Allow React effect cleanup to detach real-time Firestore listeners before deleting docs & user
    await new Promise((resolve) => setTimeout(resolve, 25));

    try {
      await deleteUserCloudData(currentUser.uid);
      await deleteCurrentAuthAccount(currentUser);
      return { ok: true };
    } catch (err) {
      const code =
        err && typeof err === 'object' ? (err as { code?: string }).code || '' : '';
      if (code === 'auth/requires-recent-login') {
        return {
          ok: false,
          error: 'For your security, please sign out and sign back in before deleting your account.',
        };
      }
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Could not delete account right now. Please try again.',
      };
    } finally {
      setIsDeletingAccount(false);
    }
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
    setAuthErrorCode(null);
    setAuthErrorAction(null);
    setNeedsNewTabForAuth(false);
  }, []);

  const updateAvatar = useCallback(async (url: string) => {
    const safeUrl = (url || '').slice(0, 65536);
    const storedVal = safeUrl ? safeUrl : AVATAR_INITIALS_SENTINEL;
    setLocalAvatar(storedVal);
    if (auth.currentUser) {
      setCloudAvatar(safeUrl);
    }
    await updateUserAvatar(safeUrl);
  }, []);

  const avatarUrl: string | null = (() => {
    if (user) {
      if (cloudAvatar !== undefined && cloudAvatar !== null) {
        return cloudAvatar === '' ? null : cloudAvatar;
      }
      if (localAvatar !== undefined) {
        return localAvatar === AVATAR_INITIALS_SENTINEL || localAvatar === ''
          ? null
          : localAvatar;
      }
      return user.photoURL || null;
    }
    if (localAvatar && localAvatar !== AVATAR_INITIALS_SENTINEL) {
      return localAvatar;
    }
    return null;
  })();

  return (
    <AuthContext.Provider
      value={{
        user,
        avatarUrl,
        authReady,
        isSigningIn,
        isDeletingAccount,
        authError,
        authErrorCode,
        authErrorAction,
        needsNewTabForAuth,
        registerWithEmail,
        signInWithEmail,
        sendPasswordReset,
        signOut: handleSignOut,
        deleteAccount,
        clearAuthError,
        updateAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
