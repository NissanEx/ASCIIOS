// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Aplikasi & sistem
  launchApp: (command, name) => ipcRenderer.invoke('launch-native-app', { command, name }),
  getSystemApps: () => ipcRenderer.invoke('get-system-apps'),
  systemAction: (action) => ipcRenderer.invoke('system-action', action),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  checkMic: () => ipcRenderer.invoke('check-mic'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  openTerminal: () => ipcRenderer.invoke('open-terminal'), 
    openChat: () => ipcRenderer.invoke('open-chat-window'),  
    onOpenChat: (cb) => ipcRenderer.on('open-chat', () => cb()),// <-- TAMBAH INI

  // Jaringan & Bluetooth
  getWifiList: () => ipcRenderer.invoke('get-wifi-list'),
  connectWifi: (ssid, password) => ipcRenderer.invoke('connect-wifi', { ssid, password }),
  getBtDevices: () => ipcRenderer.invoke('get-bt-devices'),
  toggleBtDevice: (mac, action) => ipcRenderer.invoke('toggle-bt-device', { mac, action }),

  // Env & editor
  readEnv: () => ipcRenderer.invoke('read-env'),
  writeEnv: (content) => ipcRenderer.invoke('write-env', content),
  openNativeEditor: (fileName) => ipcRenderer.invoke('open-native-editor', fileName),

  // Jendela
  getRunningWindows: () => ipcRenderer.invoke('get-running-windows'),
  focusWindow: (id) => ipcRenderer.invoke('focus-window', id),
  arrangeWindow: (id, action) => ipcRenderer.invoke('arrange-window', { id, action }),

  // Wallpaper & status aplikasi
  toggleLiveWallpaper: () => ipcRenderer.invoke('toggle-live-wallpaper'),
  getAppState: () => ipcRenderer.invoke('get-app-state'),
  setAppEnabled: (enabled) => ipcRenderer.invoke('set-app-enabled', enabled),
  setAutostart: (enabled) => ipcRenderer.invoke('set-autostart', enabled),
});