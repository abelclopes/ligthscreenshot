const { app, BrowserWindow, Tray, Menu, globalShortcut, desktopCapturer, screen,
  ipcMain, dialog, clipboard, nativeImage, session, systemPreferences } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { keys, validateShortcut, defaultShortcut } = require('./shortcuts.cjs');
const smoke = process.argv.includes('--smoke-test');
let window, tray, shortcut, shortcutActive = false, capturing = false, settingsOpen = false, quitting = false;
let settingsPath, smokeDirectory;
const page = path.join(__dirname, 'ui', 'index.html');

if (smoke) {
  // Isolate preferences in CI; no user settings are read or changed.
  smokeDirectory = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'ligthscreenshot-smoke-'));
  app.setPath('userData', smokeDirectory);
}
app.setName('ligthscreenshot');
if (process.platform === 'linux') app.setDesktopName('io.github.abelclopes.ligthscreenshot.desktop');
if (!smoke && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { window?.show(); window?.focus(); });
  app.whenReady().then(start).catch(error => { console.error(error); app.exit(1); });
}
app.on('window-all-closed', () => {});
app.on('activate', () => { window?.show(); });
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => { globalShortcut.unregisterAll(); tray?.destroy(); });

function updateMenu() {
  tray?.setToolTip(`ligthscreenshot — ${shortcut}${shortcutActive ? '' : ' (atalho indisponível)'}`);
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: `Nova captura (${shortcut})`, click: capture },
    { label: 'Abrir editor', click: () => window.show() },
    { label: 'Configurações…', click: () => { window.show(); window.webContents.send('open-settings'); } },
    { type: 'separator' }, { label: 'Sair', click: () => app.quit() }
  ]));
}

async function loadSettings() {
  shortcut = defaultShortcut(process.platform);
  try { shortcut = validateShortcut(JSON.parse(await fs.readFile(settingsPath, 'utf8')).shortcut); }
  catch (error) { if (error.code !== 'ENOENT') console.warn('Preferências inválidas; usando atalho padrão.'); }
}

async function setShortcut(value) {
  const next = validateShortcut(value);
  const changed = next !== shortcut;
  const newlyRegistered = changed || !shortcutActive;
  if (!smoke && (changed || !shortcutActive) && !globalShortcut.register(next, capture))
    throw new Error('Atalho indisponível. Escolha outra combinação ou autorize o atalho no seu ambiente de desktop.');
  try {
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(settingsPath + '.tmp', JSON.stringify({ shortcut: next }), 'utf8');
    await fs.rename(settingsPath + '.tmp', settingsPath);
  } catch (error) {
    if (!smoke && newlyRegistered) globalShortcut.unregister(next);
    throw error;
  }
  if (!smoke && changed && shortcutActive) globalShortcut.unregister(shortcut);
  shortcut = next;
  shortcutActive = true;
  updateMenu();
  return { shortcut, shortcutActive };
}

async function capture() {
  if (capturing || settingsOpen || quitting) return;
  capturing = true;
  const wasVisible = window.isVisible();
  window.hide();
  try {
    await new Promise(resolve => setTimeout(resolve, 250));
    const displays = screen.getAllDisplays();
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: {
      width: Math.max(...displays.map(d => Math.ceil(d.size.width * d.scaleFactor))),
      height: Math.max(...displays.map(d => Math.ceil(d.size.height * d.scaleFactor)))
    } });
    const images = sources.filter(s => !s.thumbnail.isEmpty()).map((source, i) => ({
      name: `Tela ${i + 1}`, image: source.thumbnail.toDataURL()
    }));
    if (!images.length) throw new Error('Nenhuma tela foi disponibilizada. Verifique as permissões de captura do sistema.');
    if (quitting) return;
    window.webContents.send('captured', images);
    window.show(); window.focus();
  } catch (error) {
    if (quitting) return;
    if (wasVisible) window.show();
    let message = error.message;
    if (process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('screen') !== 'granted')
      message += '\nAutorize ligthscreenshot em Ajustes do Sistema → Privacidade e Segurança → Gravação de Tela e reinicie o aplicativo.';
    await dialog.showMessageBox({ type: 'info', title: 'Captura não concluída', message });
  } finally { capturing = false; }
}

function pngFromData(value) {
  if (typeof value !== 'string' || value.length > 160 * 1024 * 1024 || !value.startsWith('data:image/png;base64,'))
    throw new Error('Imagem PNG inválida.');
  const image = nativeImage.createFromDataURL(value);
  if (image.isEmpty()) throw new Error('Imagem vazia.');
  return image;
}

function handle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame)
      throw new Error('Origem não permitida.');
    return handler(...args);
  });
}

async function start() {
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  await loadSettings();
  // Local UI only. No remote content, uploads, telemetry or automatic updates.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
    callback({ cancel: !['file:', 'data:', 'devtools:'].some(protocol => details.url.startsWith(protocol)) }));
  window = new BrowserWindow({ width: 1100, height: 780, minWidth: 760, minHeight: 560,
    show: false, title: 'ligthscreenshot', icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== pathToFileURL(page).href) event.preventDefault(); });
  window.on('close', event => { if (!quitting && tray) { event.preventDefault(); window.hide(); } });
  handle('capture', capture);
  handle('preferences', () => ({ shortcut, shortcutActive, keys, platform: process.platform, wayland: Boolean(process.env.WAYLAND_DISPLAY) }));
  handle('settings-open', value => { settingsOpen = Boolean(value); });
  handle('shortcut', setShortcut);
  handle('copy', data => { clipboard.writeImage(pngFromData(data)); return true; });
  handle('save', async data => {
    const image = pngFromData(data);
    const result = await dialog.showSaveDialog(window, { defaultPath: `Captura-${Date.now()}.png`, filters: [{ name: 'PNG', extensions: ['png'] }] });
    if (result.canceled || !result.filePath) return false;
    await fs.writeFile(result.filePath, image.toPNG());
    return true;
  });
  handle('quit', () => app.quit());
  await window.loadFile(page);
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'ligthscreenshot', submenu: [
    { label: 'Nova captura', click: capture }, { label: 'Configurações…', click: () => { window.show(); window.webContents.send('open-settings'); } },
    { type: 'separator' }, { role: 'quit', label: 'Sair' }
  ] }, { role: 'editMenu' }]));
  if (smoke) { await runSmoke(); return; }
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')).resize({ width: process.platform === 'darwin' ? 18 : 24, height: process.platform === 'darwin' ? 18 : 24 });
  try { tray = new Tray(icon); tray.on('double-click', capture); }
  catch (error) { console.warn('Bandeja indisponível:', error.message); }
  shortcutActive = globalShortcut.register(shortcut, capture);
  updateMenu();
  window.webContents.send('shortcut-status', { shortcut, shortcutActive });
  // Linux desktops may hide tray icons; keep a discoverable fallback window.
  if (process.platform === 'linux' || !tray || !shortcutActive) window.show();
}

async function runSmoke() {
  try {
    const result = await window.webContents.executeJavaScript(`window.runSmokeTest()`);
    if (!result.ok) throw new Error(JSON.stringify(result));
    await setShortcut('Control+Shift+S');
    const persisted = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    if (persisted.shortcut !== 'Control+Shift+S') throw new Error('Preferência não persistiu.');
    console.log('SMOKE_OK', JSON.stringify(result), 'preferences persisted');
    quitting = true;
    window.destroy();
    await fs.rm(smokeDirectory, { recursive: true, force: true }).catch(() => {});
    app.exit(0);
  } catch (error) { console.error('SMOKE_FAILED', error); app.exit(1); }
}
