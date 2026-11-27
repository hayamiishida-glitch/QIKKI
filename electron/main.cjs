const { app, BrowserWindow, Menu, Tray, session, nativeImage, Notification, ipcMain, shell, powerMonitor } = require('electron');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

let autoUpdater = null;
let lastUpdateState = { status: 'idle' };
let lastAutoCheckAt = 0;
let pendingMacFallbackUpdate = null;
let downloadedMacDmgPath = null;
let macFallbackInProgress = false;

function emitUpdateStatus(nextState) {
  lastUpdateState = nextState;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('qikki:update-status', nextState);
  }
}

function compareSemverStrings(a, b) {
  const clean = (v) =>
    String(v || '')
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const pa = clean(a);
  const pb = clean(b);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function getPublishRepoConfig() {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const pub = Array.isArray(pkg?.build?.publish)
        ? pkg.build.publish[0]
        : pkg?.build?.publish;
      if (pub?.owner && pub?.repo) {
        return { owner: String(pub.owner), repo: String(pub.repo) };
      }
    }
  } catch {
    // Fall back to default repo
  }
  return { owner: 'hayamiishida-glitch', repo: 'QIKKI' };
}

function httpsGetJson(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': `Qikki/${app.getVersion()}`,
          Accept: 'application/vnd.github+json',
        },
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          res.resume();
          httpsGetJson(res.headers.location, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            const err = new Error(`HTTP ${res.statusCode || 0}`);
            err.statusCode = res.statusCode;
            reject(err);
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('Update check timed out.'));
    });
  });
}

function httpsDownloadFile(url, destPath, onProgress, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': `Qikki/${app.getVersion()}`,
        },
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          res.resume();
          httpsDownloadFile(res.headers.location, destPath, onProgress, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode || 0}`));
          return;
        }
        const totalBytes = parseInt(res.headers['content-length'] || '0', 10) || 0;
        let receivedBytes = 0;
        const tmpPath = `${destPath}.download`;
        const out = fs.createWriteStream(tmpPath);
        res.on('data', (chunk) => {
          receivedBytes += chunk.length;
          if (totalBytes > 0 && typeof onProgress === 'function') {
            onProgress(Math.min(100, (receivedBytes / totalBytes) * 100));
          }
        });
        res.pipe(out);
        out.on('finish', () => {
          out.close(() => {
            try {
              if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
              fs.renameSync(tmpPath, destPath);
              resolve(destPath);
            } catch (e) {
              reject(e);
            }
          });
        });
        out.on('error', (err) => {
          try {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
          } catch {
            // Ignore cleanup failure
          }
          reject(err);
        });
      }
    );
    req.on('error', reject);
  });
}

function showUpdateReadyNotification(version) {
  try {
    if (Notification.isSupported()) {
      const iconPath = getIconPath();
      const verLabel = version ? `v${version} ` : '';
      const notif = new Notification({
        title: `Qikki ${verLabel}ready to install`,
        body:
          process.platform === 'darwin' && downloadedMacDmgPath
            ? 'Installer downloaded. Click Restart & Install in Qikki to open the update.'
            : 'Update downloaded automatically. It will install when you quit, or click to open.',
        icon: iconPath && fs.existsSync(iconPath) ? iconPath : undefined,
      });
      notif.on('click', () => {
        showMainWindowFromBackground();
      });
      notif.show();
    }
  } catch {
    // Ignore notification error
  }
}

async function downloadMacFallbackDmg(updateMeta) {
  if (!updateMeta?.downloadUrl) {
    return { ok: false, message: 'No macOS installer found in this release.' };
  }
  const downloadsDir = app.getPath('downloads');
  const destPath = path.join(downloadsDir, updateMeta.fileName || `Qikki-${updateMeta.version}.dmg`);
  emitUpdateStatus({ status: 'downloading', progress: { percent: 0 } });
  let lastPercent = -1;
  await httpsDownloadFile(updateMeta.downloadUrl, destPath, (pct) => {
    const rounded = Math.floor(pct);
    if (rounded !== lastPercent) {
      lastPercent = rounded;
      emitUpdateStatus({ status: 'downloading', progress: { percent: rounded } });
    }
  });
  downloadedMacDmgPath = destPath;
  emitUpdateStatus({ status: 'downloaded', info: { version: updateMeta.version } });
  showUpdateReadyNotification(updateMeta.version);
  return { ok: true };
}

async function checkMacGitHubFallbackUpdate(autoDownload) {
  if (macFallbackInProgress) return { ok: true };
  macFallbackInProgress = true;
  try {
    emitUpdateStatus({ status: 'checking' });
    const { owner, repo } = getPublishRepoConfig();
    const release = await httpsGetJson(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
    const latestVersion = String(release?.tag_name || '').replace(/^v/i, '').trim();
    const currentVersion = app.getVersion();
    if (!latestVersion || compareSemverStrings(latestVersion, currentVersion) <= 0) {
      emitUpdateStatus({ status: 'not-available', info: { version: currentVersion } });
      return { ok: true, version: currentVersion };
    }
    const assets = Array.isArray(release?.assets) ? release.assets : [];
    const dmgAsset =
      assets.find((a) => typeof a?.name === 'string' && a.name.endsWith('.dmg')) ||
      assets.find((a) => typeof a?.name === 'string' && a.name.endsWith('-mac.zip'));

    if (!dmgAsset?.browser_download_url) {
      emitUpdateStatus({
        status: 'available',
        info: { version: latestVersion },
      });
      return { ok: true, version: latestVersion };
    }

    pendingMacFallbackUpdate = {
      version: latestVersion,
      downloadUrl: dmgAsset.browser_download_url,
      fileName: dmgAsset.name,
    };

    if (autoDownload) {
      await downloadMacFallbackDmg(pendingMacFallbackUpdate);
    } else {
      emitUpdateStatus({ status: 'available', info: { version: latestVersion } });
    }
    return { ok: true, version: latestVersion };
  } catch (err) {
    const msg = formatAutoUpdateError(err);
    emitUpdateStatus({ status: 'error', message: msg });
    return { ok: false, message: msg };
  } finally {
    macFallbackInProgress = false;
  }
}

function formatAutoUpdateError(err) {
  const raw = err?.message || String(err || '');
  if (/404|Cannot find latest|No published versions|HTTP 404/i.test(raw)) {
    return 'No public desktop release found yet (ensure the GitHub repository is public and a release has published).';
  }
  if (/code signature|Could not get code signature/i.test(raw)) {
    return 'Unsigned macOS build cannot auto-replace in-place; downloading installer instead.';
  }
  return raw;
}

try {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    if (!macFallbackInProgress) {
      emitUpdateStatus({ status: 'checking' });
    }
  });
  autoUpdater.on('update-available', (info) => {
    emitUpdateStatus({ status: 'available', info });
  });
  autoUpdater.on('update-not-available', (info) => {
    emitUpdateStatus({ status: 'not-available', info });
  });
  autoUpdater.on('download-progress', (progress) => {
    emitUpdateStatus({ status: 'downloading', progress });
  });
  autoUpdater.on('update-downloaded', (info) => {
    downloadedMacDmgPath = null;
    emitUpdateStatus({ status: 'downloaded', info });
    showUpdateReadyNotification(info?.version);
  });
  autoUpdater.on('error', (err) => {
    const raw = err?.message || String(err || '');
    if (
      process.platform === 'darwin' &&
      /code signature|Could not get code signature|ShipIt|latest-mac\.yml/i.test(raw)
    ) {
      const prefs = readDesktopPrefsFile();
      void checkMacGitHubFallbackUpdate(prefs.autoDownload !== false);
      return;
    }
    emitUpdateStatus({ status: 'error', message: formatAutoUpdateError(err) });
  });
} catch {
  // electron-updater not available in dev shell
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

let mainWindow = null;
let tray = null;
let localServer = null;
let localServerPort = null;
let localServerUrl = null;
let localServerStartPromise = null;
let isQuitting = false;
let forceQuitFromMenuBar = false;
let cachedIconPath = null;
let distAssetCache = null;
let authSessionConfigured = false;
let pendingDesktopAuth = null;
let pendingBrowserAuth = null;

function showMainWindowFromBackground() {
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.show();
    } catch {
      // Ignore dock show error
    }
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    void createWindow();
    return;
  }
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function hideMainWindowToBackground(hideDock = false) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    mainWindow.hide();
  }
  if (hideDock && process.platform === 'darwin' && app.dock) {
    try {
      app.dock.hide();
    } catch {
      // Ignore dock hide error
    }
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindowFromBackground();
  });
}

function getStorePath() {
  return path.join(app.getPath('userData'), 'qikki-sync-store.json');
}

function getDesktopPrefsPath() {
  return path.join(app.getPath('userData'), 'qikki-desktop-prefs.json');
}

function readDesktopPrefsFile() {
  try {
    const prefsPath = getDesktopPrefsPath();
    if (!fs.existsSync(prefsPath)) {
      return { startMinimized: false, minimizeToTray: true, autoDownload: true };
    }
    const parsed = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'));
    return {
      startMinimized: Boolean(parsed?.startMinimized),
      minimizeToTray: parsed?.minimizeToTray !== false,
      autoDownload: parsed?.autoDownload !== false,
    };
  } catch {
    return { startMinimized: false, minimizeToTray: true, autoDownload: true };
  }
}

function writeDesktopPrefsFile(next) {
  try {
    const prefsPath = getDesktopPrefsPath();
    const dir = path.dirname(prefsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(prefsPath, JSON.stringify(next, null, 2), 'utf-8');
  } catch {
    // Ignore storage write error
  }
}

function getDesktopStartupStatus() {
  const saved = readDesktopPrefsFile();
  let launchAtStartup = false;
  try {
    const withHiddenArgs = app.getLoginItemSettings({
      args: ['--hidden'],
    });
    const defaultLogin = app.getLoginItemSettings();
    launchAtStartup = Boolean(
      withHiddenArgs?.openAtLogin || defaultLogin?.openAtLogin
    );
  } catch {
    launchAtStartup = false;
  }
  return {
    launchAtStartup,
    startMinimized: saved.startMinimized,
    minimizeToTray: saved.minimizeToTray,
    isPackaged: Boolean(app.isPackaged),
  };
}

function ensureStore() {
  const storePath = getStorePath();
  try {
    if (!fs.existsSync(storePath)) {
      const empty = { schemaVersion: 1, workspaces: {} };
      fs.writeFileSync(storePath, JSON.stringify(empty, null, 2), 'utf-8');
      return empty;
    }
    const raw = fs.readFileSync(storePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.workspaces !== 'object') {
      return { schemaVersion: 1, workspaces: {} };
    }
    return parsed;
  } catch {
    return { schemaVersion: 1, workspaces: {} };
  }
}

function writeStore(store) {
  const storePath = getStorePath();
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${storePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tmpPath, storePath);
}

function sanitizeWorkspaceId(raw) {
  if (typeof raw !== 'string') return 'default';
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned || 'default';
}

function isReminderExpired(item, nowMs) {
  if (!item || !item.deletedAt) return false;
  const expMs = item.expiresAt
    ? new Date(item.expiresAt).getTime()
    : new Date(item.deletedAt).getTime() + SEVEN_DAYS_MS;
  return !Number.isNaN(expMs) && expMs <= nowMs;
}

function mergeReminders(serverList, clientList, purgedIds, nowMs) {
  const map = new Map();
  for (const item of serverList) {
    if (
      item &&
      typeof item.id === 'string' &&
      !purgedIds.has(item.id) &&
      !isReminderExpired(item, nowMs)
    ) {
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
      (inTime === exTime &&
        (incoming.syncVersion || 0) >= (existing.syncVersion || 0))
    ) {
      map.set(incoming.id, incoming);
    }
  }
  return Array.from(map.values());
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function buildDistCache(distDir) {
  const cache = new Map();
  if (!fs.existsSync(distDir)) return cache;

  const walk = (dir, relBase) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relUrl = relBase ? `${relBase}/${entry.name}` : `/${entry.name}`;
      if (entry.isDirectory()) {
        walk(fullPath, relUrl);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        const isImmutable = relUrl.startsWith('/assets/');
        cache.set(relUrl, {
          body: fs.readFileSync(fullPath),
          mime,
          cacheControl: isImmutable
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        });
      }
    }
  };

  try {
    walk(distDir, '');
  } catch {
    // Ignore cache build issues and fall back if needed
  }
  return cache;
}

function startLocalHttpServer() {
  const distDir = path.join(__dirname, '..', 'dist');
  distAssetCache = buildDistCache(distDir);

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url || '/', 'http://localhost');
      const pathname = reqUrl.pathname;

      if (pathname.startsWith('/api/gemini/')) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error:
              'Gemini AI scheduling requires the hosted Qikki web server. Open Qikki in your browser to use AI scheduling.',
          })
        );
        return;
      }

      if (req.method === 'GET' && pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ ok: true, serverTime: new Date().toISOString() })
        );
        return;
      }

      if (req.method === 'OPTIONS' && pathname === '/auth/callback') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
        });
        res.end();
        return;
      }

      if (req.method === 'POST' && pathname === '/auth/callback') {
        const body = await readAuthCallbackBody(req);
        const wantsJson = String(req.headers.accept || '')
          .toLowerCase()
          .includes('application/json');
        const incomingState = typeof body.state === 'string' ? body.state.trim() : '';
        const active = pendingBrowserAuth;
        let stateMatches = false;
        if (active && !active.settled && incomingState && active.state) {
          const a = Buffer.from(incomingState, 'utf8');
          const b = Buffer.from(active.state, 'utf8');
          stateMatches = a.length === b.length && crypto.timingSafeEqual(a, b);
        }

        if (!stateMatches) {
          if (wantsJson) {
            res.writeHead(400, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(
              JSON.stringify({
                ok: false,
                message: 'Sign-in session expired or cancelled. Return to Qikki and try again.',
              })
            );
            return;
          }
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(
            renderCallbackHtml(
              false,
              'Sign-in session expired or cancelled',
              'Return to the Qikki desktop app and click Sign in with Google again.'
            )
          );
          return;
        }

        const idToken = typeof body.idToken === 'string' ? body.idToken.trim() : '';
        const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';
        const hasCred = Boolean(idToken || accessToken);

        settlePendingBrowserAuth(
          hasCred
            ? { ok: true, idToken: idToken || null, accessToken: accessToken || null }
            : {
                ok: false,
                code: typeof body.errorCode === 'string' && body.errorCode ? body.errorCode : 'auth/missing-credential',
                message:
                  typeof body.errorMessage === 'string' && body.errorMessage
                    ? body.errorMessage
                    : 'Google sign-in did not return credentials.',
              }
        );

        if (mainWindow && !mainWindow.isDestroyed()) {
          if (!mainWindow.isVisible()) mainWindow.show();
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }

        if (wantsJson) {
          res.writeHead(hasCred ? 200 : 400, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(
            JSON.stringify({
              ok: hasCred,
              message: hasCred
                ? 'Signed in to Qikki.'
                : 'Sign-in could not complete.',
            })
          );
          return;
        }

        res.writeHead(hasCred ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          renderCallbackHtml(
            hasCred,
            hasCred ? 'Signed in to Qikki' : 'Sign-in could not complete',
            hasCred
              ? 'Your Google account is now linked. You can close this browser tab and return to Qikki.'
              : 'Please return to Qikki and try signing in again.'
          )
        );
        return;
      }

      if (req.method === 'GET' && pathname.startsWith('/api/sync/')) {
        const wsId = sanitizeWorkspaceId(pathname.slice('/api/sync/'.length));
        const store = ensureStore();
        const ws = store.workspaces[wsId] || {
          reminders: [],
          preferences: {},
          updatedAt: new Date().toISOString(),
        };
        const nowMs = Date.now();
        const kept = ws.reminders.filter((r) => !isReminderExpired(r, nowMs));
        if (kept.length !== ws.reminders.length && store.workspaces[wsId]) {
          store.workspaces[wsId].reminders = kept;
          writeStore(store);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            workspaceId: wsId,
            reminders: kept,
            preferences: ws.preferences || {},
            serverTime: new Date(nowMs).toISOString(),
          })
        );
        return;
      }

      if (req.method === 'POST' && pathname === '/api/sync') {
        const body = await readJsonBody(req);
        const wsId = sanitizeWorkspaceId(body.workspaceId);
        const incomingReminders = Array.isArray(body.reminders)
          ? body.reminders
          : [];
        const purgedIds = new Set(
          Array.isArray(body.purgedIds)
            ? body.purgedIds.filter((id) => typeof id === 'string')
            : []
        );

        const store = ensureStore();
        const current = store.workspaces[wsId] || {
          reminders: [],
          preferences: {},
          updatedAt: new Date().toISOString(),
        };

        const nowMs = Date.now();
        const merged = mergeReminders(
          current.reminders,
          incomingReminders,
          purgedIds,
          nowMs
        );
        const nextPrefs = {
          ...(current.preferences || {}),
          ...(body.preferences || {}),
        };
        const serverTime = new Date(nowMs).toISOString();

        store.workspaces[wsId] = {
          reminders: merged,
          preferences: nextPrefs,
          updatedAt: serverTime,
        };
        writeStore(store);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            workspaceId: wsId,
            reminders: merged,
            preferences: nextPrefs,
            serverTime,
          })
        );
        return;
      }

      // Serve static built Vite app from in-memory dist cache for instant response
      const normalizedPath = path.posix.normalize(pathname === '/' ? '/index.html' : pathname);
      const cached =
        distAssetCache?.get(normalizedPath) ||
        distAssetCache?.get('/index.html');

      if (cached) {
        res.writeHead(200, {
          'Content-Type': cached.mime,
          'Content-Length': cached.body.length,
          'Cache-Control': cached.cacheControl,
          'Permissions-Policy': 'microphone=(), camera=(), display-capture=()',
        });
        res.end(cached.body);
        return;
      }

      const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
      let filePath = path.join(distDir, safePath === '/' ? 'index.html' : safePath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Permissions-Policy': 'microphone=(), camera=(), display-capture=()',
      });
      fs.createReadStream(filePath).pipe(res);
    });

    // Prefer fixed local port 41735 on localhost so Firebase Auth & IndexedDB work reliably;
    // fall back to ephemeral port if occupied.
    server.once('error', () => {
      server.once('error', reject);
      server.listen(0, 'localhost', () => {
        const addr = server.address();
        localServer = server;
        localServerPort = addr.port;
        localServerUrl = `http://localhost:${addr.port}`;
        resolve({ server, port: addr.port });
      });
    });
    server.listen(41735, 'localhost', () => {
      const addr = server.address();
      localServer = server;
      localServerPort = addr.port;
      localServerUrl = `http://localhost:${addr.port}`;
      resolve({ server, port: addr.port });
    });
  });
}

function ensureLocalLoopbackServer() {
  if (localServerPort) {
    return Promise.resolve({ server: localServer, port: localServerPort });
  }
  if (!localServerStartPromise) {
    localServerStartPromise = startLocalHttpServer();
  }
  return localServerStartPromise;
}

function readAuthCallbackBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 65536) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        if (contentType.includes('application/json')) {
          resolve(JSON.parse(raw || '{}'));
          return;
        }
        const params = new URLSearchParams(raw);
        resolve(Object.fromEntries(params.entries()));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function renderCallbackHtml(ok, heading, detail) {
  const safeHeading = String(heading).replace(/[<>&"]/g, '');
  const safeDetail = String(detail).replace(/[<>&"]/g, '');
  const accent = ok ? '#22c55e' : '#f59e0b';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Qikki — ${safeHeading}</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070d19;color:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;}
    .card{max-width:420px;width:100%;background:rgba(15,23,42,.86);border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:28px;box-shadow:0 24px 60px rgba(0,0,0,.55);text-align:center;}
    .dot{width:44px;height:44px;border-radius:999px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:${accent}22;color:${accent};font-size:20px;font-weight:700;}
    h1{margin:0 0 8px;font-size:18px;}
    p{margin:0;font-size:13px;line-height:1.55;color:#cbd5e1;}
  </style>
</head>
<body>
  <div class="card">
    <div class="dot">${ok ? '✓' : '!'}</div>
    <h1>${safeHeading}</h1>
    <p>${safeDetail}</p>
  </div>
  ${ok ? '<script>setTimeout(function(){try{window.close();}catch(e){}}, 900);</script>' : ''}
</body>
</html>`;
}

// Start local server immediately in parallel with Electron initialization
if (gotLock && !process.env.QIKKI_DEV_URL) {
  localServerStartPromise = startLocalHttpServer();
}

function getIconPath() {
  if (cachedIconPath !== null) return cachedIconPath;
  const distIcon = path.join(__dirname, '..', 'dist', 'pwa-512x512.png');
  const publicIcon = path.join(__dirname, '..', 'public', 'pwa-512x512.png');
  cachedIconPath = fs.existsSync(distIcon)
    ? distIcon
    : fs.existsSync(publicIcon)
      ? publicIcon
      : '';
  return cachedIconPath;
}

function isStoreManagedBuild() {
  return Boolean(process.windowsStore || process.mas);
}

function setMacDockIcon() {
  if (process.platform !== 'darwin' || !app.dock) return;
  try {
    const iconPath = getIconPath();
    if (iconPath && fs.existsSync(iconPath)) {
      const dockImg = nativeImage.createFromPath(iconPath);
      if (!dockImg.isEmpty()) {
        app.dock.setIcon(dockImg);
      }
    }
  } catch {
    // Ignore dock icon error
  }
}

function setupMacApplicationMenu() {
  if (process.platform !== 'darwin') return;
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: 'About Qikki' },
        { type: 'separator' },
        ...(!isStoreManagedBuild() && autoUpdater
          ? [
              {
                label: 'Check for Updates...',
                click: () => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    if (!mainWindow.isVisible()) mainWindow.show();
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.focus();
                  }
                  void autoUpdater.checkForUpdates().catch(() => {});
                },
              },
              { type: 'separator' },
            ]
          : []),
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: 'Hide Qikki' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        {
          label: 'Quit Qikki',
          accelerator: 'Command+Q',
          click: () => {
            const currentPrefs = readDesktopPrefsFile();
            if (tray && currentPrefs.minimizeToTray) {
              hideMainWindowToBackground(true);
              return;
            }
            forceQuitFromMenuBar = true;
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function refreshTrayMenu() {
  if (!tray) return;
  const prefs = readDesktopPrefsFile();
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Qikki',
      click: () => {
        showMainWindowFromBackground();
      },
    },
    {
      label: 'Minimized in tray on startup',
      type: 'checkbox',
      checked: Boolean(prefs.startMinimized),
      click: (menuItem) => {
        const nextStartMinimized = Boolean(menuItem.checked);
        const existing = readDesktopPrefsFile();
        const current = getDesktopStartupStatus();
        writeDesktopPrefsFile({
          ...existing,
          startMinimized: nextStartMinimized,
          minimizeToTray: current.minimizeToTray,
        });
        try {
          app.setLoginItemSettings({
            openAtLogin: current.launchAtStartup,
            openAsHidden: nextStartMinimized,
            path: process.execPath,
            args: nextStartMinimized ? ['--hidden'] : [],
          });
        } catch {
          // Ignore if unavailable
        }
        refreshTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Qikki',
      click: () => {
        forceQuitFromMenuBar = true;
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
}

function createTray() {
  const iconPath = getIconPath();
  if (!iconPath || !fs.existsSync(iconPath)) return;
  const traySize = process.platform === 'darwin' ? 18 : 16;
  const img = nativeImage.createFromPath(iconPath).resize({ width: traySize, height: traySize });
  tray = new Tray(img);
  tray.setToolTip('Qikki — Running in background');
  refreshTrayMenu();
  if (process.platform !== 'darwin') {
    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        showMainWindowFromBackground();
      }
    });
  }
}

async function createWindow() {
  const devUrl = process.env.QIKKI_DEV_URL;
  let targetUrl = devUrl;

  if (!targetUrl) {
    const started = await ensureLocalLoopbackServer();
    localServer = started.server;
    localServerPort = started.port;
    targetUrl = `http://localhost:${started.port}`;
    localServerUrl = targetUrl;
  }

  const iconPath = getIconPath();
  const desktopPrefs = readDesktopPrefsFile();
  let openedHidden =
    process.argv.includes('--hidden') || process.argv.includes('--minimized');
  try {
    const loginInfo = app.getLoginItemSettings();
    if (loginInfo?.wasOpenedAsHidden) openedHidden = true;
  } catch {
    // Ignore unsupported platform query
  }
  const startHidden = Boolean(
    tray && (desktopPrefs.startMinimized || openedHidden)
  );

  mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 340,
    minHeight: 420,
    show: !startHidden,
    title: 'Qikki',
    icon: iconPath || undefined,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#050811',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform !== 'darwin') {
    mainWindow.setMenuBarVisibility(false);
  }

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('qikki:maximize-changed', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('qikki:maximize-changed', false);
  });

  if (startHidden && process.platform === 'darwin' && app.dock) {
    try {
      app.dock.hide();
    } catch {
      // Ignore dock hide error
    }
  }

  // Optionally minimize to tray/menu bar on close so scheduled reminders keep running
  mainWindow.on('close', (event) => {
    const currentPrefs = readDesktopPrefsFile();
    if (!isQuitting && !forceQuitFromMenuBar && tray && currentPrefs.minimizeToTray) {
      event.preventDefault();
      hideMainWindowToBackground(false);
    } else if (!isQuitting) {
      isQuitting = true;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedAuthPopupUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 690,
          title: 'Qikki — Google Sign-In',
          icon: iconPath || undefined,
          autoHideMenuBar: true,
          backgroundColor: '#ffffff',
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
          },
        },
      };
    }

    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-create-window', (childWin) => {
    childWin.setMenuBarVisibility(false);
    childWin.setAutoHideMenuBar(true);
  });

  void mainWindow.loadURL(targetUrl);
}

const DEFAULT_FIREBASE_CONFIG = {
  projectId: 'elemental-enigma-kgt36',
  appId: '1:917840034363:web:be620eef5b1750925dba1e',
  apiKey: ['AIzaSyB7spH8CI7_', '17prPY9V7a_QvynhyJnxrM4'].join(''),
  authDomain: 'elemental-enigma-kgt36.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-cadenceminimalis-9a1c0df6-4055-401e-8981-8f1774434d5c',
  storageBucket: 'elemental-enigma-kgt36.firebasestorage.app',
  messagingSenderId: '917840034363',
};

function getFirebaseAppletConfig() {
  try {
    const cfgPath = path.join(__dirname, '..', 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (parsed && typeof parsed === 'object' && parsed.apiKey) {
        return parsed;
      }
    }
  } catch {
    // Fall back to embedded defaults
  }
  return DEFAULT_FIREBASE_CONFIG;
}

function getFirebaseAuthDomain() {
  const cfg = getFirebaseAppletConfig();
  if (typeof cfg.authDomain === 'string' && cfg.authDomain.trim()) {
    return cfg.authDomain.trim();
  }
  return 'elemental-enigma-kgt36.firebaseapp.com';
}

function isAllowedAuthPopupUrl(url) {
  const isAboutBlank = !url || url === 'about:blank' || url.startsWith('about:blank#');
  if (isAboutBlank) return true;
  try {
    const parsed = new URL(url);
    const h = parsed.hostname.toLowerCase();
    return (
      h === 'accounts.google.com' ||
      h === 'consent.google.com' ||
      h === 'accounts.youtube.com' ||
      h.endsWith('.google.com') ||
      h.endsWith('.googleusercontent.com') ||
      h.endsWith('.gstatic.com') ||
      h.endsWith('.firebaseapp.com') ||
      h.endsWith('.web.app') ||
      h === 'localhost' ||
      h === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

function sanitizeChromeUserAgent(rawUa) {
  return String(rawUa || '')
    .replace(/\s*Electron\/[^\s]+/gi, '')
    .replace(/\s*Qikki\/[^\s]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function ensureAuthSessionConfigured() {
  const authSes = session.fromPartition('persist:qikki-google-auth');
  if (authSessionConfigured) return authSes;
  authSessionConfigured = true;

  const cleanUa = sanitizeChromeUserAgent(authSes.getUserAgent());
  if (cleanUa) {
    authSes.setUserAgent(cleanUa);
  }

  authSes.setPermissionCheckHandler(
    (_webContents, permission) =>
      permission === 'notifications' || permission === 'storage-access'
  );
  authSes.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === 'notifications' || permission === 'storage-access');
    }
  );
  authSes.setDevicePermissionHandler?.(() => false);

  return authSes;
}

function settlePendingDesktopAuth(result) {
  const active = pendingDesktopAuth;
  if (!active || active.settled) return;
  active.settled = true;
  pendingDesktopAuth = null;
  active.resolve(result);
  const win = active.win;
  if (win && !win.isDestroyed()) {
    setImmediate(() => {
      if (!win.isDestroyed()) {
        win.destroy();
      }
    });
  }
}

function settlePendingBrowserAuth(result) {
  const active = pendingBrowserAuth;
  if (!active || active.settled) return;
  active.settled = true;
  pendingBrowserAuth = null;
  if (active.timer) {
    clearTimeout(active.timer);
  }
  active.resolve(result);
}

async function resolveBrowserAuthBaseUrl() {
  const envUrl = process.env.QIKKI_AUTH_WEB_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');

  const devUrl = process.env.QIKKI_DEV_URL?.trim();
  if (devUrl) return devUrl.replace(/\/+$/, '');

  const started = await ensureLocalLoopbackServer();
  return `http://localhost:${started.port}`;
}

async function runDesktopPopupSignIn() {
  if (pendingBrowserAuth) {
    settlePendingBrowserAuth({
      ok: false,
      code: 'auth/cancelled-popup-request',
      message: 'Switched to built-in sign-in popup.',
    });
  }
  if (pendingDesktopAuth) {
    settlePendingDesktopAuth({
      ok: false,
      code: 'auth/cancelled-popup-request',
      message: 'Previous Google sign-in request was cancelled.',
    });
  }

  const firebaseConfig = getFirebaseAppletConfig();
  const authDomain = getFirebaseAuthDomain();
  const runnerPath = path.join(__dirname, 'desktop-auth-runner.js');
  const devUrl = process.env.QIKKI_DEV_URL?.trim();
  let bridgeBaseUrl = devUrl ? devUrl.replace(/\/+$/, '') : '';
  if (!bridgeBaseUrl) {
    try {
      const started = await ensureLocalLoopbackServer();
      bridgeBaseUrl = `http://localhost:${started.port}`;
    } catch {
      bridgeBaseUrl = '';
    }
  }

  const useLocalBridge = Boolean(bridgeBaseUrl);
  const runnerScript =
    !useLocalBridge && fs.existsSync(runnerPath)
      ? fs.readFileSync(runnerPath, 'utf-8')
      : '';

  if (!useLocalBridge && !runnerScript) {
    return {
      ok: false,
      code: 'auth/internal-error',
      message: 'Desktop sign-in runner bundle is missing.',
    };
  }

  ensureAuthSessionConfigured();
  const iconPath = getIconPath();

  return new Promise((resolve) => {
    const authHostWin = new BrowserWindow({
      width: 460,
      height: 640,
      show: false,
      skipTaskbar: true,
      parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        partition: 'persist:qikki-google-auth',
      },
    });

    pendingDesktopAuth = {
      win: authHostWin,
      resolve,
      settled: false,
    };

    authHostWin.webContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedAuthPopupUrl(url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 500,
            height: 680,
            show: true,
            parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
            title: 'Qikki — Google Sign-In',
            icon: iconPath || undefined,
            autoHideMenuBar: true,
            backgroundColor: '#ffffff',
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
              partition: 'persist:qikki-google-auth',
            },
          },
        };
      }
      return { action: 'deny' };
    });

    authHostWin.webContents.on('did-create-window', (childWin) => {
      childWin.setMenuBarVisibility(false);
      childWin.setAutoHideMenuBar(true);
      childWin.center();
      childWin.focus();
      childWin.on('closed', () => {
        setTimeout(() => {
          if (pendingDesktopAuth && pendingDesktopAuth.win === authHostWin && !pendingDesktopAuth.settled) {
            settlePendingDesktopAuth({
              ok: false,
              code: 'auth/popup-closed-by-user',
              message: 'Google sign-in window was closed before completing.',
            });
          }
        }, 2500);
      });
    });

    if (!useLocalBridge) {
      let scriptInjected = false;
      authHostWin.webContents.on('did-finish-load', () => {
        if (scriptInjected) return;
        scriptInjected = true;
        const bootstrap = `window.__QIKKI_FIREBASE_CONFIG__ = ${JSON.stringify(firebaseConfig)};\n${runnerScript}`;
        void authHostWin.webContents.executeJavaScript(bootstrap, true).catch((err) => {
          settlePendingDesktopAuth({
            ok: false,
            code: 'auth/internal-error',
            message: err?.message || 'Could not start Google sign-in flow.',
          });
        });
      });
    }

    authHostWin.on('closed', () => {
      settlePendingDesktopAuth({
        ok: false,
        code: 'auth/popup-closed-by-user',
        message: 'Google sign-in window was closed before completing.',
      });
    });

    authHostWin.webContents.on('did-fail-load', (_e, _errCode, errDesc) => {
      settlePendingDesktopAuth({
        ok: false,
        code: 'auth/network-request-failed',
        message: errDesc || 'Could not reach Google Sign-In.',
      });
    });

    if (useLocalBridge) {
      void authHostWin.loadURL(`${bridgeBaseUrl}/?qikkiDesktopAuth=1`);
    } else {
      void authHostWin.loadURL(`https://${authDomain}/__/auth/iframe`);
    }
  });
}

app.setName('Qikki');
if (process.platform === 'win32') {
  app.setAppUserModelId('Qikki');
}
app.commandLine.appendSwitch('enable-smooth-scrolling');
app.commandLine.appendSwitch('disable-audio-input');
app.commandLine.appendSwitch('disable-speech-api');

app.whenReady().then(async () => {
  setMacDockIcon();
  setupMacApplicationMenu();

  const initialDesktopPrefs = readDesktopPrefsFile();
  if (autoUpdater) {
    autoUpdater.autoDownload = Boolean(initialDesktopPrefs.autoDownload);
  }

  const defaultUa = sanitizeChromeUserAgent(session.defaultSession.getUserAgent());
  if (defaultUa) {
    session.defaultSession.setUserAgent(defaultUa);
  }
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) =>
      permission === 'notifications' ||
      permission === 'storage-access' ||
      permission === 'geolocation'
  );
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(
        permission === 'notifications' ||
          permission === 'storage-access' ||
          permission === 'geolocation'
      );
    }
  );
  session.defaultSession.setDevicePermissionHandler?.(() => false);
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...(details.responseHeaders || {}) };
    if (!headers['Permissions-Policy'] && !headers['permissions-policy']) {
      headers['Permissions-Policy'] = ['microphone=(), camera=(), display-capture=()'];
    }
    callback({ responseHeaders: headers });
  });

  ipcMain.handle('qikki:get-desktop-prefs', () => {
    return getDesktopStartupStatus();
  });

  ipcMain.handle('qikki:set-desktop-prefs', (_event, patch) => {
    const current = getDesktopStartupStatus();
    const nextStartMinimized =
      typeof patch?.startMinimized === 'boolean'
        ? patch.startMinimized
        : current.startMinimized;
    const nextMinimizeToTray =
      typeof patch?.minimizeToTray === 'boolean'
        ? patch.minimizeToTray
        : current.minimizeToTray;
    const nextLaunchAtStartup =
      typeof patch?.launchAtStartup === 'boolean'
        ? patch.launchAtStartup
        : current.launchAtStartup;

    const existing = readDesktopPrefsFile();
    writeDesktopPrefsFile({
      ...existing,
      startMinimized: nextStartMinimized,
      minimizeToTray: nextMinimizeToTray,
    });
    refreshTrayMenu();

    try {
      app.setLoginItemSettings({
        openAtLogin: nextLaunchAtStartup,
        openAsHidden: nextStartMinimized,
        path: process.execPath,
        args: nextStartMinimized ? ['--hidden'] : [],
      });
    } catch {
      // Ignore if platform login items unavailable in dev shell
    }

    return getDesktopStartupStatus();
  });

  ipcMain.handle('qikki:get-auto-update-pref', () => {
    const saved = readDesktopPrefsFile();
    return saved.autoDownload !== false;
  });

  ipcMain.handle('qikki:get-update-status', () => {
    return lastUpdateState;
  });

  ipcMain.handle('qikki:set-auto-update-pref', (_event, enabled) => {
    const saved = readDesktopPrefsFile();
    saved.autoDownload = Boolean(enabled);
    writeDesktopPrefsFile(saved);
    if (autoUpdater) {
      autoUpdater.autoDownload = saved.autoDownload;
    }
    return saved.autoDownload;
  });

  ipcMain.handle('qikki:check-for-updates', async () => {
    if (isStoreManagedBuild()) {
      return {
        ok: false,
        message: 'Updates for this version are managed automatically by the App Store / Microsoft Store.',
      };
    }
    if (!app.isPackaged) {
      return {
        ok: false,
        message: 'Automatic desktop updates run automatically on packaged builds.',
      };
    }
    lastAutoCheckAt = Date.now();
    if (!autoUpdater) {
      if (process.platform === 'darwin') {
        const prefs = readDesktopPrefsFile();
        return checkMacGitHubFallbackUpdate(prefs.autoDownload !== false);
      }
      return {
        ok: false,
        message: 'Desktop updater module is unavailable in this build.',
      };
    }
    try {
      const res = await autoUpdater.checkForUpdates();
      return { ok: true, version: res?.updateInfo?.version };
    } catch (err) {
      if (process.platform === 'darwin') {
        const prefs = readDesktopPrefsFile();
        return checkMacGitHubFallbackUpdate(prefs.autoDownload !== false);
      }
      return { ok: false, message: formatAutoUpdateError(err) };
    }
  });

  ipcMain.handle('qikki:download-update', async () => {
    if (isStoreManagedBuild()) return { ok: false };
    if (process.platform === 'darwin' && pendingMacFallbackUpdate) {
      try {
        return await downloadMacFallbackDmg(pendingMacFallbackUpdate);
      } catch (err) {
        return { ok: false, message: formatAutoUpdateError(err) };
      }
    }
    if (!autoUpdater) return { ok: false };
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      if (process.platform === 'darwin' && pendingMacFallbackUpdate) {
        return downloadMacFallbackDmg(pendingMacFallbackUpdate);
      }
      return { ok: false, message: formatAutoUpdateError(err) };
    }
  });

  ipcMain.handle('qikki:install-update', async () => {
    if (isStoreManagedBuild()) return { ok: false };
    if (process.platform === 'darwin' && downloadedMacDmgPath && fs.existsSync(downloadedMacDmgPath)) {
      await shell.openPath(downloadedMacDmgPath);
      forceQuitFromMenuBar = true;
      isQuitting = true;
      setTimeout(() => app.quit(), 400);
      return { ok: true };
    }
    if (!autoUpdater) return { ok: false };
    forceQuitFromMenuBar = true;
    isQuitting = true;
    autoUpdater.quitAndInstall();
    return { ok: true };
  });

  ipcMain.handle('qikki:clear-local-data', async () => {
    try {
      const storePath = getStorePath();
      if (fs.existsSync(storePath)) {
        fs.unlinkSync(storePath);
      }
      const prefsPath = getDesktopPrefsPath();
      if (fs.existsSync(prefsPath)) {
        fs.unlinkSync(prefsPath);
      }
      try {
        app.setLoginItemSettings({
          openAtLogin: false,
          openAsHidden: false,
          path: process.execPath,
          args: [],
        });
      } catch {
        // Ignore if unavailable
      }
      await session.defaultSession.clearStorageData({
        storages: ['localstorage', 'indexdb', 'cookies', 'serviceworkers', 'cachestorage'],
      });
      const authSes = session.fromPartition('persist:qikki-google-auth');
      await authSes.clearStorageData();
      refreshTrayMenu();
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle('qikki:notify', (_event, payload) => {
    const title = (payload && typeof payload.title === 'string' && payload.title) || 'Qikki Reminder';
    const body = (payload && typeof payload.body === 'string' && payload.body) || 'Scheduled reminder is due now.';
    const iconPath = getIconPath();
    const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR);

    try {
      if (!isPortable && Notification.isSupported()) {
        const notif = new Notification({
          title,
          body,
          icon: fs.existsSync(iconPath) ? iconPath : undefined,
          silent: Boolean(payload && payload.silent),
        });
        notif.on('click', () => {
          showMainWindowFromBackground();
        });
        notif.show();
        return { ok: true, channel: 'electron-toast' };
      }
    } catch {
      // Fall through to tray balloon fallback
    }

    if (tray && process.platform === 'win32') {
      try {
        const hasIcon = Boolean(iconPath && fs.existsSync(iconPath));
        tray.displayBalloon({
          iconType: hasIcon ? 'custom' : 'info',
          icon: hasIcon ? nativeImage.createFromPath(iconPath) : undefined,
          title,
          content: body,
        });
        return { ok: true, channel: 'tray-balloon' };
      } catch {
        // Ignore
      }
    }

    if (Notification.isSupported()) {
      try {
        const notif = new Notification({
          title,
          body,
          icon: fs.existsSync(iconPath) ? iconPath : undefined,
          silent: Boolean(payload && payload.silent),
        });
        notif.show();
        return { ok: true, channel: 'electron-toast' };
      } catch {
        return { ok: false };
      }
    }

    return { ok: false };
  });

  ipcMain.handle('qikki:window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('qikki:window-toggle-maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }
    mainWindow.maximize();
    return true;
  });

  ipcMain.handle('qikki:window-close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('qikki:window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  ipcMain.handle('qikki:desktop-auth-complete', (_event, payload) => {
    settlePendingDesktopAuth(
      payload && typeof payload === 'object'
        ? payload
        : { ok: false, code: 'auth/popup-closed-by-user', message: 'Google sign-in cancelled.' }
    );
  });

  ipcMain.handle('qikki:google-signin-cancel', () => {
    settlePendingBrowserAuth({
      ok: false,
      code: 'auth/cancelled-popup-request',
      message: 'Google sign-in was cancelled.',
    });
    if (pendingDesktopAuth) {
      settlePendingDesktopAuth({
        ok: false,
        code: 'auth/cancelled-popup-request',
        message: 'Google sign-in was cancelled.',
      });
    }
  });

  ipcMain.handle('qikki:google-signin', async () => {
    if (pendingBrowserAuth) {
      settlePendingBrowserAuth({
        ok: false,
        code: 'auth/cancelled-popup-request',
        message: 'Previous Google sign-in attempt was replaced.',
      });
    }
    if (pendingDesktopAuth) {
      settlePendingDesktopAuth({
        ok: false,
        code: 'auth/cancelled-popup-request',
        message: 'Previous Google sign-in attempt was replaced.',
      });
    }

    const { port } = await ensureLocalLoopbackServer();
    const baseUrl = await resolveBrowserAuthBaseUrl();
    const state = crypto.randomBytes(24).toString('hex');
    const loginUrl = `${baseUrl}/?desktopLogin=1&port=${port}&state=${state}`;
    mainWindow?.webContents.send('qikki:auth-mode', 'browser');

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        settlePendingBrowserAuth({
          ok: false,
          code: 'auth/popup-closed-by-user',
          message: 'Timed out waiting for browser sign-in. You can retry or use the built-in sign-in popup.',
        });
      }, 5 * 60 * 1000);

      pendingBrowserAuth = {
        state,
        port,
        resolve,
        settled: false,
        timer,
      };

      void shell.openExternal(loginUrl).catch((err) => {
        settlePendingBrowserAuth({
          ok: false,
          code: 'auth/network-request-failed',
          message: err?.message || 'Could not open your default web browser.',
        });
      });
    });
  });

  ipcMain.handle('qikki:google-signin-popup', async () => {
    mainWindow?.webContents.send('qikki:auth-mode', 'popup');
    return runDesktopPopupSignIn();
  });

  createTray();
  await createWindow();

  if (app.isPackaged && !isStoreManagedBuild()) {
    const runBackgroundUpdateCheck = () => {
      if (lastUpdateState.status === 'downloaded' || lastUpdateState.status === 'downloading') {
        return;
      }
      lastAutoCheckAt = Date.now();
      if (autoUpdater) {
        void autoUpdater.checkForUpdates().catch(() => {
          if (process.platform === 'darwin') {
            const prefs = readDesktopPrefsFile();
            void checkMacGitHubFallbackUpdate(prefs.autoDownload !== false);
          }
        });
      } else if (process.platform === 'darwin') {
        const prefs = readDesktopPrefsFile();
        void checkMacGitHubFallbackUpdate(prefs.autoDownload !== false);
      }
    };

    setTimeout(runBackgroundUpdateCheck, 8000);
    setInterval(runBackgroundUpdateCheck, 4 * 60 * 60 * 1000);
    powerMonitor.on('resume', () => {
      if (Date.now() - lastAutoCheckAt > 30 * 60 * 1000) {
        setTimeout(runBackgroundUpdateCheck, 15000);
      }
    });
  }

  powerMonitor.on('shutdown', () => {
    forceQuitFromMenuBar = true;
    isQuitting = true;
  });

  app.on('activate', () => {
    showMainWindowFromBackground();
  });
});

app.on('before-quit', (event) => {
  const currentPrefs = readDesktopPrefsFile();
  if (
    process.platform === 'darwin' &&
    !forceQuitFromMenuBar &&
    tray &&
    currentPrefs.minimizeToTray
  ) {
    event.preventDefault();
    hideMainWindowToBackground(true);
    return;
  }
  isQuitting = true;
  if (localServer) {
    localServer.close();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});
