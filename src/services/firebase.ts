import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  setPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from '@firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from '@firebase/firestore';
import { initializeApp } from '@firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';
import type { Reminder, SoundPresetId } from '../types/reminder';
import type {
  NotificationThemePreference,
  ThemeMode,
} from '../hooks/useTheme';
import type {
  ClockFormat,
  SnoozePresetMinutes,
  TemperatureUnit,
} from '../hooks/useAppPreferences';
import {
  isValidAccentColorId,
  type AccentColorId,
} from '../utils/accentColors';
import { clampUiTransparency } from '../utils/uiTransparency';
import { computeDeletionExpiry, isDeletedExpired } from '../utils/recurrence';
import { normalizeHolidayCountryPref } from './holidayService';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
void setPersistence(auth, browserLocalPersistence).catch(() => {});
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export async function signInWithGooglePopup(): Promise<User> {
  await setPersistence(auth, browserLocalPersistence);
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signInWithGoogleCredentialTokens(
  idToken?: string | null,
  accessToken?: string | null
): Promise<User> {
  await setPersistence(auth, browserLocalPersistence);
  try {
    const cred = GoogleAuthProvider.credential(idToken ?? null, accessToken ?? null);
    const result = await signInWithCredential(auth, cred);
    return result.user;
  } catch (err) {
    if (idToken && accessToken) {
      try {
        const accessCred = GoogleAuthProvider.credential(null, accessToken);
        const result = await signInWithCredential(auth, accessCred);
        return result.user;
      } catch {
        const idCred = GoogleAuthProvider.credential(idToken, null);
        const result = await signInWithCredential(auth, idCred);
        return result.user;
      }
    }
    throw err;
  }
}

export async function signInWithGoogleRedirectFlow(): Promise<void> {
  await setPersistence(auth, browserLocalPersistence);
  await signInWithRedirect(auth, googleProvider);
}

export async function resolveGoogleRedirectSignIn(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch (err) {
    console.warn('Redirect sign-in result check:', err);
    return null;
  }
}

export async function registerWithEmailPassword(
  email: string,
  pass: string,
  displayName?: string
): Promise<User> {
  await setPersistence(auth, browserLocalPersistence);
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (displayName && displayName.trim()) {
    try {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    } catch {
      // Continue even if initial profile update fails
    }
  }
  return cred.user;
}

export async function signInWithEmailPassword(
  email: string,
  pass: string
): Promise<User> {
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return cred.user;
}

export async function resetPasswordForEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export const signOutGoogle = signOutUser;

export async function reauthenticateForAccountDeletion(
  user: User,
  password?: string
): Promise<void> {
  const hasPasswordProvider = user.providerData.some(
    (p) => p.providerId === 'password'
  );
  if (hasPasswordProvider) {
    if (!user.email) {
      throw new Error('Account email is unavailable for verification.');
    }
    if (!password) {
      const err = new Error('Please enter your password to confirm deletion.') as Error & {
        code?: string;
      };
      err.code = 'auth/requires-password';
      throw err;
    }
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    return;
  }

  const hasGoogleProvider = user.providerData.some(
    (p) => p.providerId === 'google.com'
  );
  if (hasGoogleProvider) {
    const lastSignInMs = user.metadata.lastSignInTime
      ? new Date(user.metadata.lastSignInTime).getTime()
      : 0;
    if (!lastSignInMs || Date.now() - lastSignInMs > 4 * 60 * 1000) {
      await reauthenticateWithPopup(user, googleProvider);
    }
  }
}

export async function deleteCurrentAuthAccount(user: User): Promise<void> {
  await deleteUser(user);
}

function sanitizeDocId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || `rem-${Date.now()}`;
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const num = typeof val === 'number' && Number.isFinite(val) ? Math.round(val) : fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeOptionalDate(val: unknown): string | null {
  if (typeof val !== 'string' || !val.trim()) return null;
  return val.slice(0, 40);
}

function serializeMutableReminderFields(item: Reminder, fallbackDevice: string) {
  const nowIso = new Date().toISOString();
  const weekdays = Array.isArray(item.recurrence?.weekdays)
    ? item.recurrence.weekdays
        .filter((d) => typeof d === 'number' && d >= 0 && d <= 6)
        .map((d) => Math.round(d))
        .slice(0, 7)
    : [];

  const vibPattern = Array.isArray(item.vibration?.pattern)
    ? item.vibration.pattern
        .filter((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)
        .map((n) => Math.round(n))
        .slice(0, 20)
    : [];

  const volume =
    typeof item.sound?.volume === 'number' && Number.isFinite(item.sound.volume)
      ? Math.min(1, Math.max(0, item.sound.volume))
      : 0.85;

  const deletedAt = sanitizeOptionalDate(item.deletedAt);
  const expiresAt = deletedAt
    ? sanitizeOptionalDate(item.expiresAt) || computeDeletionExpiry(deletedAt)
    : null;

  return {
    title: (item.title || 'Untitled Reminder').trim().slice(0, 240) || 'Untitled Reminder',
    notes: (item.notes || '').slice(0, 2000),
    location: (item.location || '').slice(0, 240),
    triggerAt: (item.triggerAt || nowIso).slice(0, 40),
    timezone: (item.timezone || 'UTC').slice(0, 80) || 'UTC',
    recurrence: {
      frequency:
        item.recurrence?.frequency === 'weekly' || item.recurrence?.frequency === 'monthly'
          ? item.recurrence.frequency
          : ('none' as const),
      interval: clampInt(item.recurrence?.interval, 1, 100, 1),
      weekdays,
      monthlyMode:
        item.recurrence?.monthlyMode === 'last-day' ||
        item.recurrence?.monthlyMode === 'nth-weekday'
          ? item.recurrence.monthlyMode
          : ('day-of-month' as const),
      dayOfMonth: clampInt(item.recurrence?.dayOfMonth, 1, 31, 1),
      nthWeek: clampInt(item.recurrence?.nthWeek, -1, 4, 1),
      weekday: clampInt(item.recurrence?.weekday, 0, 6, 1),
      targetCount:
        item.recurrence?.targetCount === null || item.recurrence?.targetCount === 0
          ? null
          : clampInt(item.recurrence?.targetCount, 1, 365, 1),
    },
    sound: {
      presetId: (item.sound?.presetId || 'crystal-chime').slice(0, 40),
      volume,
      repeatCount: clampInt(item.sound?.repeatCount, 1, 5, 1),
    },
    vibration: {
      presetId: (item.vibration?.presetId || 'pulse').slice(0, 40),
      label: (item.vibration?.label || 'Crisp Pulse').slice(0, 60),
      pattern: vibPattern,
    },
    status:
      item.status === 'snoozed' || item.status === 'completed'
        ? item.status
        : ('active' as const),
    snoozedUntil: sanitizeOptionalDate(item.snoozedUntil),
    lastTriggeredAt: sanitizeOptionalDate(item.lastTriggeredAt),
    completedCount: clampInt(item.completedCount, 0, 1000000, 0),
    updatedAt: (item.updatedAt || nowIso).slice(0, 40),
    syncVersion: clampInt(item.syncVersion, 1, 100000000, 1),
    deviceOrigin: (item.deviceOrigin || fallbackDevice).slice(0, 80),
    deletedAt,
    expiresAt,
  };
}

function docToReminder(raw: Record<string, unknown>, docId: string): Reminder | null {
  if (!raw || typeof raw !== 'object') return null;
  const triggerAt = typeof raw.triggerAt === 'string' ? raw.triggerAt : new Date().toISOString();
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : triggerAt;
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt;

  const rec = (raw.recurrence || {}) as Record<string, unknown>;
  const snd = (raw.sound || {}) as Record<string, unknown>;
  const vib = (raw.vibration || {}) as Record<string, unknown>;

  return {
    id: typeof raw.id === 'string' ? raw.id : docId,
    title: typeof raw.title === 'string' ? raw.title : 'Reminder',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    location: typeof raw.location === 'string' ? raw.location : '',
    triggerAt,
    timezone: typeof raw.timezone === 'string' ? raw.timezone : 'UTC',
    recurrence: {
      frequency:
        rec.frequency === 'weekly' || rec.frequency === 'monthly' ? rec.frequency : 'none',
      interval: typeof rec.interval === 'number' ? rec.interval : 1,
      weekdays: Array.isArray(rec.weekdays)
        ? (rec.weekdays.filter((n) => typeof n === 'number') as number[])
        : [],
      monthlyMode:
        rec.monthlyMode === 'last-day' || rec.monthlyMode === 'nth-weekday'
          ? rec.monthlyMode
          : 'day-of-month',
      dayOfMonth: typeof rec.dayOfMonth === 'number' ? rec.dayOfMonth : 1,
      nthWeek: typeof rec.nthWeek === 'number' ? rec.nthWeek : 1,
      weekday: typeof rec.weekday === 'number' ? rec.weekday : 1,
      targetCount:
        typeof rec.targetCount === 'number' && rec.targetCount > 0 ? rec.targetCount : null,
    },
    sound: {
      presetId: (typeof snd.presetId === 'string'
        ? snd.presetId
        : 'crystal-chime') as Reminder['sound']['presetId'],
      volume: typeof snd.volume === 'number' ? snd.volume : 0.85,
      repeatCount: typeof snd.repeatCount === 'number' ? snd.repeatCount : 1,
    },
    vibration: {
      presetId: (typeof vib.presetId === 'string'
        ? vib.presetId
        : 'pulse') as Reminder['vibration']['presetId'],
      label: typeof vib.label === 'string' ? vib.label : 'Crisp Pulse',
      pattern: Array.isArray(vib.pattern)
        ? (vib.pattern.filter((n) => typeof n === 'number') as number[])
        : [140, 80, 140],
    },
    status:
      raw.status === 'snoozed' || raw.status === 'completed' ? raw.status : 'active',
    snoozedUntil: typeof raw.snoozedUntil === 'string' ? raw.snoozedUntil : null,
    lastTriggeredAt: typeof raw.lastTriggeredAt === 'string' ? raw.lastTriggeredAt : null,
    completedCount: typeof raw.completedCount === 'number' ? raw.completedCount : 0,
    createdAt,
    updatedAt,
    syncVersion: typeof raw.syncVersion === 'number' ? raw.syncVersion : 1,
    deviceOrigin: typeof raw.deviceOrigin === 'string' ? raw.deviceOrigin : 'Cloud',
    deletedAt: typeof raw.deletedAt === 'string' ? raw.deletedAt : null,
    expiresAt: typeof raw.expiresAt === 'string' ? raw.expiresAt : null,
  };
}

export const AVATAR_INITIALS_SENTINEL = '__initials__';

export function getAvatarStorageKey(uid?: string | null): string {
  return uid ? `qikki_custom_avatar_${uid}` : 'qikki_custom_avatar';
}

export async function ensureUserProfileDoc(
  user: User,
  deviceOrigin: string
): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);

  let guestAvatar = '';
  try {
    if (typeof localStorage !== 'undefined') {
      const uidCached = localStorage.getItem(getAvatarStorageKey(user.uid));
      const guestCached = localStorage.getItem(getAvatarStorageKey(null));
      const candidate = uidCached ?? guestCached;
      if (candidate && candidate !== AVATAR_INITIALS_SENTINEL) {
        guestAvatar = candidate.slice(0, 65536);
      } else if (candidate === AVATAR_INITIALS_SENTINEL) {
        guestAvatar = '';
      } else {
        guestAvatar = (user.photoURL || '').slice(0, 65536);
      }
    } else {
      guestAvatar = (user.photoURL || '').slice(0, 65536);
    }
  } catch {
    guestAvatar = (user.photoURL || '').slice(0, 65536);
  }

  const baseFields = {
    email: (user.email || '').slice(0, 254),
    displayName: (user.displayName || 'Qikki User').slice(0, 120),
    lastActiveDevice: (deviceOrigin || 'Web').slice(0, 80),
  };

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        ...baseFields,
        photoURL: guestAvatar,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = existingSnap.data();
      const hasStoredPhotoField = typeof existingData?.photoURL === 'string';
      await updateDoc(ref, {
        ...baseFields,
        ...(hasStoredPhotoField
          ? {}
          : { photoURL: (user.photoURL || '').slice(0, 65536) }),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserProfileAvatar(
  uid: string,
  onAvatar: (photoURL: string | null) => void
): Unsubscribe {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const photo = typeof data?.photoURL === 'string' ? data.photoURL : null;
      onAvatar(photo);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function updateUserAvatar(photoURL: string): Promise<void> {
  const safePhoto = (photoURL || '').slice(0, 65536);
  const currentUser = auth.currentUser;

  try {
    if (typeof localStorage !== 'undefined') {
      const key = getAvatarStorageKey(currentUser?.uid ?? null);
      localStorage.setItem(key, safePhoto ? safePhoto : AVATAR_INITIALS_SENTINEL);
    }
  } catch {
    // Ignore local storage quota/access errors
  }

  if (!currentUser) return;

  // Firebase Auth limits photoURL to ~2048 chars and rejects large data URIs.
  // Only sync short non-data URLs (or clear) to Auth; full image lives in Firestore & localStorage.
  if (safePhoto === '' || (!safePhoto.startsWith('data:') && safePhoto.length <= 1800)) {
    try {
      await updateProfile(currentUser, { photoURL: safePhoto });
    } catch (err) {
      console.warn('Could not update Firebase Auth photoURL:', err);
    }
  }

  const path = `users/${currentUser.uid}`;
  const ref = doc(db, 'users', currentUser.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        photoURL: safePhoto,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid: currentUser.uid,
        email: (currentUser.email || '').slice(0, 254),
        displayName: (currentUser.displayName || 'Qikki User').slice(0, 120),
        photoURL: safePhoto,
        lastActiveDevice: 'Web',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchCloudReminders(uid: string): Promise<Reminder[]> {
  const colPath = `users/${uid}/reminders`;
  try {
    const q = query(
      collection(db, 'users', uid, 'reminders'),
      where('ownerId', '==', uid)
    );
    const snap = await getDocs(q);
    const nowMs = Date.now();
    const list: Reminder[] = [];
    snap.forEach((docSnap) => {
      const rem = docToReminder(docSnap.data() as Record<string, unknown>, docSnap.id);
      if (rem && !isDeletedExpired(rem.deletedAt, rem.expiresAt, nowMs)) {
        list.push(rem);
      }
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colPath);
  }
}

export function subscribeCloudReminders(
  uid: string,
  onReminders: (reminders: Reminder[]) => void
): Unsubscribe {
  const colPath = `users/${uid}/reminders`;
  const q = query(
    collection(db, 'users', uid, 'reminders'),
    where('ownerId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const nowMs = Date.now();
      const list: Reminder[] = [];
      snap.forEach((docSnap) => {
        const rem = docToReminder(docSnap.data() as Record<string, unknown>, docSnap.id);
        if (rem && !isDeletedExpired(rem.deletedAt, rem.expiresAt, nowMs)) {
          list.push(rem);
        }
      });
      onReminders(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, colPath);
    }
  );
}

export async function upsertCloudReminder(
  uid: string,
  reminder: Reminder,
  fallbackDevice: string
): Promise<void> {
  const safeId = sanitizeDocId(reminder.id);
  const path = `users/${uid}/reminders/${safeId}`;
  const ref = doc(db, 'users', uid, 'reminders', safeId);
  const mutable = serializeMutableReminderFields(reminder, fallbackDevice);
  const createdAt = (reminder.createdAt || new Date().toISOString()).slice(0, 40);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: safeId,
        ownerId: uid,
        ...mutable,
        createdAt,
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...mutable,
        serverUpdatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCloudReminder(uid: string, reminderId: string): Promise<void> {
  const safeId = sanitizeDocId(reminderId);
  const path = `users/${uid}/reminders/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'reminders', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncLocalAndCloudReminders(
  uid: string,
  localAll: Reminder[],
  purgedIds: string[],
  fallbackDevice: string,
  options?: { skipUntouchedSeedIds?: Set<string> }
): Promise<Reminder[]> {
  const colPath = `users/${uid}/reminders`;
  const cloudReminders = await fetchCloudReminders(uid);
  const cloudMap = new Map<string, Reminder>();
  cloudReminders.forEach((r) => cloudMap.set(sanitizeDocId(r.id), r));

  const purgedSet = new Set(purgedIds.map(sanitizeDocId));
  const nowMs = Date.now();
  const mergedMap = new Map<string, Reminder>();
  const skipSeeds =
    Boolean(options?.skipUntouchedSeedIds?.size) && cloudReminders.length > 0;

  cloudReminders.forEach((r) => {
    const sid = sanitizeDocId(r.id);
    if (!purgedSet.has(sid) && !isDeletedExpired(r.deletedAt, r.expiresAt, nowMs)) {
      mergedMap.set(sid, { ...r, id: sid });
    }
  });

  const toCreate: Reminder[] = [];
  const toUpdate: Reminder[] = [];
  const toDelete: string[] = [];

  for (const id of purgedSet) {
    if (cloudMap.has(id)) {
      toDelete.push(id);
    }
  }

  for (const local of localAll) {
    const sid = sanitizeDocId(local.id);
    if (skipSeeds && options?.skipUntouchedSeedIds?.has(sid)) {
      continue;
    }
    if (purgedSet.has(sid) || isDeletedExpired(local.deletedAt, local.expiresAt, nowMs)) {
      if (cloudMap.has(sid)) {
        toDelete.push(sid);
      }
      continue;
    }

    const remote = cloudMap.get(sid);
    const normalizedLocal = { ...local, id: sid };
    if (!remote) {
      mergedMap.set(sid, normalizedLocal);
      toCreate.push(normalizedLocal);
    } else {
      const lt = new Date(local.updatedAt).getTime();
      const rt = new Date(remote.updatedAt).getTime();
      const localWins =
        lt > rt || (lt === rt && local.syncVersion > remote.syncVersion);
      if (localWins) {
        mergedMap.set(sid, normalizedLocal);
        toUpdate.push(normalizedLocal);
      }
    }
  }

  // Also clean up any expired cloud tombstones
  for (const remote of cloudReminders) {
    const sid = sanitizeDocId(remote.id);
    if (isDeletedExpired(remote.deletedAt, remote.expiresAt, nowMs)) {
      if (!toDelete.includes(sid)) {
        toDelete.push(sid);
      }
    }
  }

  // Commit in batches of up to 400 operations
  type BatchOp =
    | { kind: 'create'; item: Reminder }
    | { kind: 'update'; item: Reminder }
    | { kind: 'delete'; id: string };

  const ops: BatchOp[] = [
    ...toCreate.map((item) => ({ kind: 'create' as const, item })),
    ...toUpdate.map((item) => ({ kind: 'update' as const, item })),
    ...toDelete.map((id) => ({ kind: 'delete' as const, id })),
  ];

  try {
    for (let i = 0; i < ops.length; i += 400) {
      const slice = ops.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const op of slice) {
        if (op.kind === 'delete') {
          batch.delete(doc(db, 'users', uid, 'reminders', op.id));
        } else if (op.kind === 'create') {
          const ref = doc(db, 'users', uid, 'reminders', op.item.id);
          const mutable = serializeMutableReminderFields(op.item, fallbackDevice);
          batch.set(ref, {
            id: op.item.id,
            ownerId: uid,
            ...mutable,
            createdAt: (op.item.createdAt || new Date().toISOString()).slice(0, 40),
            serverCreatedAt: serverTimestamp(),
            serverUpdatedAt: serverTimestamp(),
          });
        } else {
          const ref = doc(db, 'users', uid, 'reminders', op.item.id);
          const mutable = serializeMutableReminderFields(op.item, fallbackDevice);
          batch.update(ref, {
            ...mutable,
            serverUpdatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, colPath);
  }

  return Array.from(mergedMap.values());
}

export interface CloudWeatherLocation {
  latitude: number;
  longitude: number;
  locationName: string;
  regionLabel: string;
  source: 'gps' | 'ip' | 'manual';
}

export interface CloudUserSettings {
  appTheme: ThemeMode;
  notificationTheme: NotificationThemePreference;
  clockFormat: ClockFormat;
  accentColor: AccentColorId;
  uiTransparency: number;
  defaultSoundPreset: SoundPresetId;
  defaultSoundVolume: number;
  defaultSnoozeMinutes: SnoozePresetMinutes;
  defaultVibrationPresetId: string;
  temperatureUnit: TemperatureUnit;
  showHeaderWeather: boolean;
  weatherLocation: CloudWeatherLocation | null;
  launchAtStartup: boolean;
  startMinimized: boolean;
  minimizeToTray: boolean;
  autoDownloadUpdates: boolean;
  showHolidays: boolean;
  holidayCountryCode: string;
}

export interface CloudAppearancePreferences {
  appTheme: ThemeMode;
  notificationTheme: NotificationThemePreference;
}

export interface CloudUserSettingsSnapshot {
  exists: boolean;
  isCompleteSchema: boolean;
  settings: CloudUserSettings | null;
  legacyAppearance?: CloudAppearancePreferences;
}

const VALID_SOUND_PRESET_IDS: ReadonlySet<SoundPresetId> = new Set<SoundPresetId>([
  'ios-tri-tone',
  'ios-note',
  'ios-chime',
  'ios-bamboo',
  'ios-aurora',
  'ios-pulse',
  'crystal-chime',
  'soft-pulse',
  'beacon-tone',
  'zen-gong',
  'digital-ping',
  'aurora-harp',
  'amber-marimba',
  'dewdrop-bell',
  'horizon-chord',
  'brisk-triad',
  'midnight-sonar',
  'silent',
]);

const REQUIRED_SETTINGS_KEYS = [
  'appTheme',
  'notificationTheme',
  'clockFormat',
  'accentColor',
  'uiTransparency',
  'defaultSoundPreset',
  'defaultSoundVolume',
  'defaultSnoozeMinutes',
  'defaultVibrationPresetId',
  'temperatureUnit',
  'showHeaderWeather',
  'weatherLocation',
  'launchAtStartup',
  'startMinimized',
  'minimizeToTray',
  'autoDownloadUpdates',
  'showHolidays',
  'holidayCountryCode',
] as const;

function sanitizeCloudWeatherLocation(raw: unknown): CloudWeatherLocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const lat = Number(obj.latitude);
  const lon = Number(obj.longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }
  const source =
    obj.source === 'gps' || obj.source === 'ip' || obj.source === 'manual'
      ? obj.source
      : 'manual';
  const locationName =
    typeof obj.locationName === 'string'
      ? obj.locationName.trim().slice(0, 120)
      : '';
  const regionLabel =
    typeof obj.regionLabel === 'string'
      ? obj.regionLabel.trim().slice(0, 160)
      : '';
  return {
    latitude: lat,
    longitude: lon,
    locationName,
    regionLabel,
    source,
  };
}

export function sanitizeCloudUserSettings(
  input: Partial<CloudUserSettings>
): CloudUserSettings {
  const soundPreset: SoundPresetId =
    input.defaultSoundPreset && VALID_SOUND_PRESET_IDS.has(input.defaultSoundPreset)
      ? input.defaultSoundPreset
      : 'ios-tri-tone';
  const rawVolume =
    typeof input.defaultSoundVolume === 'number' &&
    Number.isFinite(input.defaultSoundVolume)
      ? Math.min(1, Math.max(0, input.defaultSoundVolume))
      : 0.85;
  const snooze: SnoozePresetMinutes =
    input.defaultSnoozeMinutes === 5 ||
    input.defaultSnoozeMinutes === 10 ||
    input.defaultSnoozeMinutes === 15 ||
    input.defaultSnoozeMinutes === 30
      ? input.defaultSnoozeMinutes
      : 15;
  const vibRaw =
    typeof input.defaultVibrationPresetId === 'string'
      ? input.defaultVibrationPresetId.trim().slice(0, 40)
      : '';

  return {
    appTheme: input.appTheme === 'light' ? 'light' : 'dark',
    notificationTheme:
      input.notificationTheme === 'light' || input.notificationTheme === 'dark'
        ? input.notificationTheme
        : 'match',
    clockFormat: input.clockFormat === '12h' ? '12h' : '24h',
    accentColor: isValidAccentColorId(input.accentColor)
      ? input.accentColor
      : 'blue',
    uiTransparency: clampUiTransparency(input.uiTransparency),
    defaultSoundPreset: soundPreset,
    defaultSoundVolume: Math.round(rawVolume * 100) / 100,
    defaultSnoozeMinutes: snooze,
    defaultVibrationPresetId: vibRaw || 'double-pulse',
    temperatureUnit: input.temperatureUnit === 'f' ? 'f' : 'c',
    showHeaderWeather: input.showHeaderWeather !== false,
    weatherLocation: sanitizeCloudWeatherLocation(input.weatherLocation),
    launchAtStartup: Boolean(input.launchAtStartup),
    startMinimized: Boolean(input.startMinimized),
    minimizeToTray: input.minimizeToTray !== false,
    autoDownloadUpdates: input.autoDownloadUpdates !== false,
    showHolidays: input.showHolidays !== false,
    holidayCountryCode: normalizeHolidayCountryPref(input.holidayCountryCode),
  };
}

export async function saveCloudUserSettings(
  uid: string,
  settings: CloudUserSettings
): Promise<void> {
  const path = `users/${uid}/preferences/appearance`;
  const ref = doc(db, 'users', uid, 'preferences', 'appearance');
  const sanitized = sanitizeCloudUserSettings(settings);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: uid,
        ...sanitized,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...sanitized,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeCloudUserSettings(
  uid: string,
  onSettings: (snapshot: CloudUserSettingsSnapshot) => void
): Unsubscribe {
  const path = `users/${uid}/preferences/appearance`;
  const ref = doc(db, 'users', uid, 'preferences', 'appearance');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onSettings({
          exists: false,
          isCompleteSchema: false,
          settings: null,
        });
        return;
      }

      const data = snap.data() as Record<string, unknown>;
      const isCompleteSchema = REQUIRED_SETTINGS_KEYS.every((key) => key in data);
      const legacyAppearance: CloudAppearancePreferences = {
        appTheme: data.appTheme === 'light' ? 'light' : 'dark',
        notificationTheme:
          data.notificationTheme === 'light' || data.notificationTheme === 'dark'
            ? data.notificationTheme
            : 'match',
      };

      if (!isCompleteSchema) {
        onSettings({
          exists: true,
          isCompleteSchema: false,
          settings: null,
          legacyAppearance,
        });
        return;
      }

      onSettings({
        exists: true,
        isCompleteSchema: true,
        settings: sanitizeCloudUserSettings(data as Partial<CloudUserSettings>),
        legacyAppearance,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function deleteUserCloudData(uid: string): Promise<void> {
  const remindersColPath = `users/${uid}/reminders`;
  try {
    const remindersQuery = query(
      collection(db, 'users', uid, 'reminders'),
      where('ownerId', '==', uid)
    );
    const remindersSnap = await getDocs(remindersQuery);
    const reminderDocs = remindersSnap.docs;
    for (let i = 0; i < reminderDocs.length; i += 400) {
      const batch = writeBatch(db);
      reminderDocs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, remindersColPath);
  }

  const prefsColPath = `users/${uid}/preferences`;
  try {
    const prefsQuery = query(
      collection(db, 'users', uid, 'preferences'),
      where('ownerId', '==', uid)
    );
    const prefsSnap = await getDocs(prefsQuery);
    if (!prefsSnap.empty) {
      const batch = writeBatch(db);
      prefsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, prefsColPath);
  }

  const userDocPath = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await deleteDoc(userRef);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, userDocPath);
  }
}
