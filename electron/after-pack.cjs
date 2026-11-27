const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KEYS_TO_REMOVE = [
  'NSMicrophoneUsageDescription',
  'NSCameraUsageDescription',
  'NSSpeechRecognitionUsageDescription',
  'NSAudioCaptureUsageDescription',
];

function stripMediaPlistKeys(plistPath) {
  if (!fs.existsSync(plistPath)) return false;
  let modified = false;
  for (const key of KEYS_TO_REMOVE) {
    try {
      execFileSync('/usr/libexec/PlistBuddy', ['-c', `Delete :${key}`, plistPath], {
        stdio: 'ignore',
      });
      modified = true;
    } catch {
      // Key already absent
    }
  }
  return modified;
}

function collectNestedInfoPlists(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.endsWith('.app')) {
        results.push(path.join(fullPath, 'Contents', 'Info.plist'));
      }
      collectNestedInfoPlists(fullPath, results);
    } else if (entry.isFile() && entry.name === 'Info.plist') {
      results.push(fullPath);
    }
  }
  return results;
}

exports.default = async function afterPack(context) {
  const platform = context.electronPlatformName;
  if (platform !== 'darwin' && platform !== 'mas') return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  if (!fs.existsSync(appPath)) return;

  const plistTargets = new Set([
    path.join(appPath, 'Contents', 'Info.plist'),
    ...collectNestedInfoPlists(path.join(appPath, 'Contents', 'Frameworks')),
  ]);

  let changedAny = false;
  for (const plistPath of plistTargets) {
    if (stripMediaPlistKeys(plistPath)) {
      changedAny = true;
    }
  }

  // Keep ad-hoc signature valid on Apple Silicon when Developer ID signing is disabled
  if (changedAny && process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false') {
    try {
      execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
        stdio: 'ignore',
      });
    } catch {
      // Ignore if codesign unavailable
    }
  }
};
