const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('captureApp', {
  capture: () => ipcRenderer.invoke('capture'),
  preferences: () => ipcRenderer.invoke('preferences'),
  settingsOpen: value => ipcRenderer.invoke('settings-open', value),
  shortcut: value => ipcRenderer.invoke('shortcut', value),
  copy: data => ipcRenderer.invoke('copy', data),
  save: data => ipcRenderer.invoke('save', data),
  quit: () => ipcRenderer.invoke('quit'),
  onCaptured: callback => ipcRenderer.on('captured', (_, images) => callback(images)),
  onSettings: callback => ipcRenderer.on('open-settings', () => callback()),
  onShortcutStatus: callback => ipcRenderer.on('shortcut-status', (_, value) => callback(value))
});
