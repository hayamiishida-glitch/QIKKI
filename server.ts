import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import type { Reminder, SoundPresetId } from './src/types/reminder.ts';

interface WorkspacePreferences {
  appTheme?: 'light' | 'dark';
  notificationTheme?: 'match' | 'light' | 'dark';
}

interface WorkspaceRecord {
  reminders: Reminder[];
  preferences?: WorkspacePreferences;
  updatedAt: string;
}

interface StoreFile {
  schemaVersion: 1;
  workspaces: Record<string, WorkspaceRecord>;
}

interface FirebaseAppletConfig {
  apiKey?: string;
}

interface GeminiScheduleDraft {
  title: string;
  notes: string;
  triggerAt: string;
  frequency: 'none' | 'weekly' | 'monthly';
  interval: number;
  weekdays: number[];
  monthlyMode: 'day-of-month' | 'last-day' | 'nth-weekday';
  dayOfMonth: number;
  nthWeek: number;
  weekday: number;
  targetCount: number;
  soundPresetId: SoundPresetId;
}

const VALID_SOUND_PRESETS: SoundPresetId[] = [
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
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'qikki-sync-store.json');
const FIREBASE_CONFIG_PATH = path.resolve(__dirname, 'firebase-applet-config.json');

function loadFirebaseApiKey(): string | null {
  try {
    if (!fs.existsSync(FIREBASE_CONFIG_PATH)) return null;
    const raw = fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as FirebaseAppletConfig;
    return typeof parsed.apiKey === 'string' && parsed.apiKey.trim()
      ? parsed.apiKey.trim()
      : null;
  } catch {
    return null;
  }
}

async function verifyFirebaseBearerToken(
  authHeader: string | undefined
): Promise<{ uid: string; email?: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken || idToken.length > 8192) return null;

  const apiKey = loadFirebaseApiKey();
  if (!apiKey) return null;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      users?: Array<{ localId?: string; email?: string; disabled?: boolean }>;
    };
    const user = data.users?.[0];
    if (!user?.localId || user.disabled) return null;
    return { uid: user.localId, email: user.email };
  } catch {
    return null;
  }
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const num = typeof val === 'number' && Number.isFinite(val) ? Math.round(val) : fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeGeminiSchedules(
  rawSchedules: unknown[],
  fallbackNowMs: number
): GeminiScheduleDraft[] {
  const results: GeminiScheduleDraft[] = [];

  for (let i = 0; i < Math.min(rawSchedules.length, 10); i++) {
    const entry = rawSchedules[i];
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;

    const rawTitle = typeof obj.title === 'string' ? obj.title.trim() : '';
    if (!rawTitle) continue;
    const title = rawTitle.slice(0, 240);
    const notes = typeof obj.notes === 'string' ? obj.notes.trim().slice(0, 2000) : '';

    let parsedDate =
      typeof obj.triggerAt === 'string' ? new Date(obj.triggerAt) : new Date(NaN);
    if (Number.isNaN(parsedDate.getTime())) {
      parsedDate = new Date(fallbackNowMs + (i + 1) * 30 * 60000);
      parsedDate.setSeconds(0, 0);
    }

    const freq =
      obj.frequency === 'weekly' || obj.frequency === 'monthly' ? obj.frequency : 'none';
    const interval = clampInt(obj.interval, 1, 52, 1);

    const rawWeekdays = Array.isArray(obj.weekdays)
      ? obj.weekdays
          .filter((d): d is number => typeof d === 'number' && Number.isFinite(d))
          .map((d) => Math.round(d))
          .filter((d) => d >= 0 && d <= 6)
      : [];
    const weekdays = Array.from(new Set(rawWeekdays)).sort((a, b) => a - b);
    if (freq === 'weekly' && weekdays.length === 0) {
      weekdays.push(parsedDate.getDay());
    }

    const monthlyMode =
      obj.monthlyMode === 'last-day' || obj.monthlyMode === 'nth-weekday'
        ? obj.monthlyMode
        : 'day-of-month';
    const dayOfMonth = clampInt(obj.dayOfMonth, 1, 31, parsedDate.getDate());
    let nthWeek = clampInt(obj.nthWeek, -1, 4, Math.min(4, Math.ceil(parsedDate.getDate() / 7)));
    if (nthWeek === 0) nthWeek = 1;
    const weekday = clampInt(obj.weekday, 0, 6, parsedDate.getDay());
    const targetCount = clampInt(
      obj.targetCount,
      1,
      365,
      freq === 'weekly' ? 8 : freq === 'monthly' ? 12 : 1
    );

    const rawSound = typeof obj.soundPresetId === 'string' ? obj.soundPresetId : '';
    const soundPresetId = VALID_SOUND_PRESETS.includes(rawSound as SoundPresetId)
      ? (rawSound as SoundPresetId)
      : 'crystal-chime';

    results.push({
      title,
      notes,
      triggerAt: parsedDate.toISOString(),
      frequency: freq,
      interval,
      weekdays,
      monthlyMode,
      dayOfMonth,
      nthWeek,
      weekday,
      targetCount,
      soundPresetId,
    });
  }

  return results;
}

function ensureStore(): StoreFile {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const empty: StoreFile = { schemaVersion: 1, workspaces: {} };
      fs.writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2), 'utf-8');
      return empty;
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as StoreFile;
    if (!parsed || typeof parsed.workspaces !== 'object') {
      return { schemaVersion: 1, workspaces: {} };
    }
    return parsed;
  } catch {
    return { schemaVersion: 1, workspaces: {} };
  }
}

function writeStore(store: StoreFile): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tmpPath, STORE_PATH);
}

function sanitizeWorkspaceId(raw: unknown): string {
  if (typeof raw !== 'string') return 'default';
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned || 'default';
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isReminderExpired(item: Reminder, nowMs: number): boolean {
  if (!item.deletedAt) return false;
  const expMs = item.expiresAt
    ? new Date(item.expiresAt).getTime()
    : new Date(item.deletedAt).getTime() + SEVEN_DAYS_MS;
  return !Number.isNaN(expMs) && expMs <= nowMs;
}

function pruneExpired(list: Reminder[], nowMs: number): { list: Reminder[]; pruned: boolean } {
  const kept = list.filter((item) => !isReminderExpired(item, nowMs));
  return { list: kept, pruned: kept.length !== list.length };
}

function mergeReminders(
  serverList: Reminder[],
  clientList: Reminder[],
  purgedIds: Set<string>,
  nowMs: number
): Reminder[] {
  const map = new Map<string, Reminder>();
  for (const item of serverList) {
    if (item && typeof item.id === 'string' && !purgedIds.has(item.id) && !isReminderExpired(item, nowMs)) {
      map.set(item.id, item);
    }
  }

  for (const incoming of clientList) {
    if (!incoming || typeof incoming.id !== 'string') continue;
    if (purgedIds.has(incoming.id) || isReminderExpired(incoming, nowMs)) {
      map.delete(incoming.id);
      continue;
    }
    const existing = map.get(incoming.id);
    if (!existing) {
      map.set(incoming.id, incoming);
      continue;
    }
    const inTime = new Date(incoming.updatedAt || 0).getTime();
    const exTime = new Date(existing.updatedAt || 0).getTime();
    if (
      inTime > exTime ||
      (inTime === exTime && (incoming.syncVersion || 0) >= (existing.syncVersion || 0))
    ) {
      map.set(incoming.id, incoming);
    }
  }

  return Array.from(map.values());
}

async function startServer(): Promise<void> {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, serverTime: new Date().toISOString() });
  });

  app.get('/api/desktop-auth-ready', (_req, res) => {
    res.json({ ok: true, desktopAuth: true });
  });

  app.post('/api/gemini/schedule', async (req, res) => {
    const verifiedUser = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!verifiedUser) {
      res.status(401).json({
        error: 'Please sign in with your Google account to save AI-generated schedules.',
      });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({
        error: 'Gemini scheduling service is not configured on the server yet.',
      });
      return;
    }

    const body = (req.body || {}) as {
      prompt?: unknown;
      timezone?: unknown;
      localIsoNow?: unknown;
    };
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 1200) : '';
    if (!prompt) {
      res.status(400).json({ error: 'Please enter what you would like Qikki to schedule.' });
      return;
    }

    const timezone =
      typeof body.timezone === 'string' && body.timezone.trim()
        ? body.timezone.trim().slice(0, 80)
        : 'UTC';
    const localIsoNow =
      typeof body.localIsoNow === 'string' && body.localIsoNow.trim()
        ? body.localIsoNow.trim().slice(0, 48)
        : new Date().toISOString();

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          `Current reference date/time: ${localIsoNow} (user IANA timezone: ${timezone}).`,
          `User request: ${prompt}`,
        ].join('\n'),
        config: {
          systemInstruction:
            'You convert a user request into concrete reminder schedules for the Qikki app. ' +
            'Return structured JSON matching the schema. Generate between 1 and 8 concise reminders. ' +
            'Always convert dates/times into valid future UTC ISO-8601 strings (ending in Z) calculated accurately from the user reference date/time and timezone. ' +
            'If no specific time is given, default to 09:00 local time on the appropriate day or 30 minutes from now for immediate tasks. ' +
            'For weekly habits use frequency "weekly" with weekdays array (0=Sun..6=Sat). For monthly tasks use frequency "monthly". Otherwise use "none". ' +
            `Choose the most fitting soundPresetId from: ${VALID_SOUND_PRESETS.join(', ')}.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'A brief one-sentence summary of what was scheduled.',
              },
              schedules: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    triggerAt: {
                      type: Type.STRING,
                      description: 'UTC ISO-8601 timestamp ending in Z',
                    },
                    frequency: {
                      type: Type.STRING,
                      enum: ['none', 'weekly', 'monthly'],
                    },
                    interval: { type: Type.INTEGER },
                    weekdays: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                    },
                    monthlyMode: {
                      type: Type.STRING,
                      enum: ['day-of-month', 'last-day', 'nth-weekday'],
                    },
                    dayOfMonth: { type: Type.INTEGER },
                    nthWeek: { type: Type.INTEGER },
                    weekday: { type: Type.INTEGER },
                    targetCount: { type: Type.INTEGER },
                    soundPresetId: {
                      type: Type.STRING,
                      enum: VALID_SOUND_PRESETS,
                    },
                  },
                  required: [
                    'title',
                    'notes',
                    'triggerAt',
                    'frequency',
                    'interval',
                    'weekdays',
                    'monthlyMode',
                    'dayOfMonth',
                    'nthWeek',
                    'weekday',
                    'targetCount',
                    'soundPresetId',
                  ],
                },
              },
            },
            required: ['reply', 'schedules'],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        res.status(502).json({ error: 'Gemini returned an empty schedule response.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        reply?: unknown;
        schedules?: unknown[];
      };
      const schedules = sanitizeGeminiSchedules(
        Array.isArray(parsed.schedules) ? parsed.schedules : [],
        Date.now()
      );

      if (schedules.length === 0) {
        res.status(422).json({
          error: 'Could not extract a schedule from that request. Try adding a task and time.',
        });
        return;
      }

      const reply =
        typeof parsed.reply === 'string' && parsed.reply.trim()
          ? parsed.reply.trim().slice(0, 320)
          : `Scheduled ${schedules.length} reminder${schedules.length > 1 ? 's' : ''}.`;

      res.json({ ok: true, reply, schedules });
    } catch (err) {
      console.error('Gemini schedule generation error:', err);
      res.status(502).json({
        error: 'Unable to reach Gemini right now. Please try again in a moment.',
      });
    }
  });

  app.get('/api/sync/:workspaceId', (req, res) => {
    const workspaceId = sanitizeWorkspaceId(req.params.workspaceId);
    const store = ensureStore();
    const ws = store.workspaces[workspaceId] || {
      reminders: [],
      preferences: {},
      updatedAt: new Date().toISOString(),
    };
    const { list: activeOrRetained, pruned } = pruneExpired(ws.reminders, Date.now());
    if (pruned && store.workspaces[workspaceId]) {
      store.workspaces[workspaceId].reminders = activeOrRetained;
      writeStore(store);
    }
    res.json({
      workspaceId,
      reminders: activeOrRetained,
      preferences: ws.preferences || {},
      serverTime: new Date().toISOString(),
    });
  });

  app.post('/api/sync', (req, res) => {
    const body = req.body as {
      workspaceId?: string;
      reminders?: Reminder[];
      purgedIds?: string[];
      preferences?: WorkspacePreferences;
    };

    const workspaceId = sanitizeWorkspaceId(body?.workspaceId);
    const incomingReminders = Array.isArray(body?.reminders) ? body.reminders : [];
    const purgedIds = new Set<string>(
      Array.isArray(body?.purgedIds)
        ? body.purgedIds.filter((id): id is string => typeof id === 'string')
        : []
    );

    const store = ensureStore();
    const current = store.workspaces[workspaceId] || {
      reminders: [],
      preferences: {},
      updatedAt: new Date().toISOString(),
    };

    const nowMs = Date.now();
    const merged = mergeReminders(current.reminders, incomingReminders, purgedIds, nowMs);
    const nextPrefs: WorkspacePreferences = {
      ...(current.preferences || {}),
      ...(body?.preferences || {}),
    };

    const serverTime = new Date(nowMs).toISOString();
    store.workspaces[workspaceId] = {
      reminders: merged,
      preferences: nextPrefs,
      updatedAt: serverTime,
    };

    writeStore(store);

    res.json({
      ok: true,
      workspaceId,
      reminders: merged,
      preferences: nextPrefs,
      serverTime,
    });
  });

  const httpServer = http.createServer(app);

  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'microphone=(), camera=(), display-capture=()');
    next();
  });

  app.use(['/sw.js', '/version.json', '/manifest.webmanifest'], (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    next();
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html') || filePath.endsWith('favicon.ico')) {
            res.setHeader('Cache-Control', 'no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Qikki server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
