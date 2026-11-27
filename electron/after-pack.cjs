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
  if (!fs.existsSync(plistPath)) return;
  for (const key of KEYS_TO_REMOVE) {
    try {
      execFileSync('/usr/libexec/PlistBuddy', ['-c', `Delete :${key}`, plistPath], {
        stdio: 'ignore',
      });
    } catch {
      // Key already absent
    }
  }
}

exports.default = async function afterPack(context) {
  const platform = context.electronPlatformName;
  if (platform !== 'darwin' && platform !== 'mas') return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  if (!fs.existsSync(appPath)) return;

  // Strip usage keys from main bundle Info.plist
  stripMediaPlistKeys(path.join(appPath, 'Contents', 'Info.plist'));

  // Strip usage keys from direct Helper .app bundles (without traversing .framework symlinks)
  const frameworksDir = path.join(appPath, 'Contents', 'Frameworks');
  if (fs.existsSync(frameworksDir)) {
    for (const entry of fs.readdirSync(frameworksDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.endsWith('.app')) {
        stripMediaPlistKeys(path.join(frameworksDir, entry.name, 'Contents', 'Info.plist'));
      }
    }
  }
};
