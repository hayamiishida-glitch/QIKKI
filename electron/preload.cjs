const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qikkiDesktop', {
  isDesktop: true,
  platform: process.platform,
  storeChannel: process.mas ? 'mas' : process.windowsStore ? 'ms-store' : 'direct',
  notify: (payload) => ipcRenderer.invoke('qikki:notify', payload),
  minimizeWindow: () => ipcRenderer.invoke('qikki:window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('qikki:window-toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('qikki:window-close'),
  isMaximized: () => ipcRenderer.invoke('qikki:window-is-maximized'),
  onMaximizeChange: (callback) => {
    const listener = (_event, maximized) => callback(Boolean(maximized));
    ipcRenderer.on('qikki:maximize-changed', listener);
    return () => ipcRenderer.removeListener('qikki:maximize-changed', listener);
  },
  signInWithGoogle: () => ipcRenderer.invoke('qikki:google-signin'),
  signInWithGooglePopup: () => ipcRenderer.invoke('qikki:google-signin-popup'),
  cancelGoogleSignIn: () => ipcRenderer.invoke('qikki:google-signin-cancel'),
  completeDesktopAuth: (payload) => ipcRenderer.invoke('qikki:desktop-auth-complete', payload),
  onGoogleAuthMode: (callback) => {
    const listener = (_event, mode) => callback(mode === 'browser' ? 'browser' : 'popup');
    ipcRenderer.on('qikki:auth-mode', listener);
    return () => ipcRenderer.removeListener('qikki:auth-mode', listener);
  },
  getDesktopPrefs: () => ipcRenderer.invoke('qikki:get-desktop-prefs'),
  setDesktopPrefs: (patch) => ipcRenderer.invoke('qikki:set-desktop-prefs', patch),
  clearLocalData: () => ipcRenderer.invoke('qikki:clear-local-data'),
  checkForUpdates: () => ipcRenderer.invoke('qikki:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('qikki:download-update'),
  installUpdate: () => ipcRenderer.invoke('qikki:install-update'),
  getAutoUpdatePref: () => ipcRenderer.invoke('qikki:get-auto-update-pref'),
  getUpdateStatus: () => ipcRenderer.invoke('qikki:get-update-status'),
  setAutoUpdatePref: (enabled) => ipcRenderer.invoke('qikki:set-auto-update-pref', enabled),
  onUpdateStatus: (callback) => {
    const listener = (_event, statusObj) => callback(statusObj);
    ipcRenderer.on('qikki:update-status', listener);
    return () => ipcRenderer.removeListener('qikki:update-status', listener);
  },
});
