const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

exports.default = async function afterPack(context) {
  const platform = context.electronPlatformName;
  if (platform !== 'darwin' && platform !== 'mas') return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const plistPath = path.join(context.appOutDir, appName, 'Contents', 'Info.plist');
  if (!fs.existsSync(plistPath)) return;

  const keysToRemove = [
    'NSMicrophoneUsageDescription',
    'NSCameraUsageDescription',
    'NSSpeechRecognitionUsageDescription',
  ];

  for (const key of keysToRemove) {
    try {
      execFileSync('/usr/libexec/PlistBuddy', ['-c', `Delete :${key}`, plistPath], {
        stdio: 'ignore',
      });
    } catch {
      // Key already absent
    }
  }
};
