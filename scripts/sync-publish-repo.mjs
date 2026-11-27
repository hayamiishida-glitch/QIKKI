import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const pkgPath = path.join(rootDir, 'package.json');
const versionJsonPath = path.join(rootDir, 'public', 'version.json');

function parseGithubOwnerRepo(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  // Matches "owner/repo"
  const directMatch = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/.exec(trimmed);
  if (directMatch) {
    return { owner: directMatch[1], repo: directMatch[2] };
  }
  // Matches https://github.com/owner/repo(.git) or git@github.com:owner/repo(.git)
  const ghMatch = /github\.com[:/]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/)?$/i.exec(trimmed);
  if (ghMatch) {
    return { owner: ghMatch[1], repo: ghMatch[2] };
  }
  return null;
}

function getCliArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return null;
}

function detectGithubRepo() {
  const cliRepo = getCliArg('--repo');
  if (cliRepo) {
    const parsed = parseGithubOwnerRepo(cliRepo);
    if (parsed) return parsed;
  }

  if (process.env.GITHUB_REPOSITORY) {
    const parsed = parseGithubOwnerRepo(process.env.GITHUB_REPOSITORY);
    if (parsed) return parsed;
  }

  try {
    const remoteUrl = execSync('git config --get remote.origin.url', {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    const parsed = parseGithubOwnerRepo(remoteUrl);
    if (parsed) return parsed;
  } catch {
    // Not a git repository or no origin remote configured
  }

  return null;
}

function main() {
  if (!fs.existsSync(pkgPath)) {
    console.warn('[sync-publish-repo] package.json not found, skipping.');
    return;
  }

  const pkgRaw = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(pkgRaw);
  let pkgChanged = false;

  const explicitVersion = getCliArg('--version');
  if (explicitVersion) {
    const cleanVer = explicitVersion.replace(/^v/i, '').trim();
    if (/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(cleanVer) && pkg.version !== cleanVer) {
      pkg.version = cleanVer;
      pkgChanged = true;
    }
  }

  const detected = detectGithubRepo();
  if (detected) {
    const currentPub = Array.isArray(pkg.build?.publish) ? pkg.build.publish[0] : pkg.build?.publish;
    const nextPublish = [
      {
        provider: 'github',
        owner: detected.owner,
        repo: detected.repo,
        releaseType: 'release',
      },
    ];
    if (
      !currentPub ||
      currentPub.owner !== detected.owner ||
      currentPub.repo !== detected.repo ||
      currentPub.releaseType !== 'release'
    ) {
      pkg.build = pkg.build || {};
      pkg.build.publish = nextPublish;
      pkgChanged = true;
      console.log(`[sync-publish-repo] Configured auto-update GitHub repo: ${detected.owner}/${detected.repo}`);
    }
  } else {
    console.log('[sync-publish-repo] No GitHub remote detected; keeping existing package.json publish config.');
  }

  if (pkgChanged) {
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  }

  // Keep public/version.json aligned with package.json version
  if (fs.existsSync(versionJsonPath) && pkg.version) {
    try {
      const vJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
      if (vJson.version !== pkg.version) {
        vJson.version = pkg.version;
        vJson.releasedAt = new Date().toISOString();
        fs.writeFileSync(versionJsonPath, `${JSON.stringify(vJson, null, 2)}\n`, 'utf8');
        console.log(`[sync-publish-repo] Synced public/version.json to ${pkg.version}`);
      }
    } catch {
      // Ignore malformed version.json
    }
  }
}

main();
