// electron/main.js
const { app, BrowserWindow, ipcMain, screen, Tray, Menu } = require('electron');
const path = require('path');
const { exec, spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const http = require('http');

// Wallpaper tidak pernah diklik, jadi AudioContext (visualizer) harus boleh jalan tanpa gesture.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Wallpaper tidak pernah diklik, jadi AudioContext (visualizer) harus boleh jalan tanpa gesture.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// TAMBAHKAN 3 BARIS INI UNTUK MEMATIKAN PAUSE OTOMATIS
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
Menu.setApplicationMenu(null);

// ---------- Konfigurasi ----------
// Build terpasang memakai port sendiri supaya tidak bentrok dengan `npm run dev` (port 3000).
// Jangan ganti port setelah dipakai: IndexedDB/localStorage (karakter & API key) terikat ke alamat ini.
const PORT = app.isPackaged ? 38417 : 3000;
const BASE_URL = app.isPackaged ? `http://127.0.0.1:${PORT}` : `http://localhost:${PORT}`;
const START_HIDDEN = process.argv.includes('--autostart');
const PRELOAD = path.join(__dirname, 'preload.js');

const AUTOSTART_DIR = path.join(os.homedir(), '.config', 'autostart');
const AUTOSTART_FILE = path.join(AUTOSTART_DIR, 'ascii-os.desktop');

// Hanya satu instance (autostart + buka manual tidak boleh berebut port & membuat 2 wallpaper).
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let nextServer = null;
let mainWindow = null;
let wallpaperWindow = null;
let wallpaperClosingOnPurpose = false;
let setupLoaded = false;
let tray = null;
let isEnabled = true; // status ON/OFF ala Hidamari
let appIsQuitting = false;
// ---------- SNAPSHOT BACKGROUND (untuk Overview GNOME / tombol Super) ----------
// Overview GNOME hanya menggambar background GNOME asli, bukan jendela Electron.
// Jadi kita ambil screenshot wallpaper live lalu pasang sebagai background GNOME (statis, tanpa lag).
const SNAPSHOT_FIRST_DELAY = 4000;          // tunggu wajah ASCII selesai dimuat
const SNAPSHOT_INTERVAL = 5 * 60 * 1000;    // perbarui tiap 5 menit (biar jam tidak basi). Isi 0 untuk sekali saja.
let snapshotTimer = null;
let snapshotInterval = null;
let lastSnapshotPath = null;

function gset(key, value) {
  require('child_process').execFile('gsettings', ['set', 'org.gnome.desktop.background', key, value], () => {});
}

async function applySnapshotBackground() {
  if (!wallpaperIsOpen()) return;
  try {
    const img = await wallpaperWindow.webContents.capturePage();
    if (!wallpaperIsOpen() || img.isEmpty()) return;

    // Nama file unik tiap snapshot, karena GNOME meng-cache gambar berdasarkan URI.
    const file = path.join(app.getPath('userData'), `wallpaper-snapshot-${Date.now()}.png`);
    await fs.writeFile(file, img.toPNG());
        if (!wallpaperIsOpen()) { fs.unlink(file).catch(() => {}); return; }
    const uri = encodeURI(`file://${file}`);

    gset('picture-options', 'zoom');
    gset('picture-uri', uri);
    gset('picture-uri-dark', uri);


    const old = lastSnapshotPath;
    lastSnapshotPath = file;
    if (old) setTimeout(() => fs.unlink(old).catch(() => {}), 3000);
  } catch (e) {
    console.error('[snapshot] gagal:', e.message);
  }
}

function scheduleSnapshots() {
  clearTimeout(snapshotTimer);
  clearInterval(snapshotInterval);
  snapshotTimer = setTimeout(() => {
    applySnapshotBackground();
    if (SNAPSHOT_INTERVAL > 0) snapshotInterval = setInterval(applySnapshotBackground, SNAPSHOT_INTERVAL);
  }, SNAPSHOT_FIRST_DELAY);
}

function stopSnapshots() {
  clearTimeout(snapshotTimer);
  clearInterval(snapshotInterval);
  snapshotTimer = snapshotInterval = null;
  if (lastSnapshotPath) {
    const f = lastSnapshotPath;
    lastSnapshotPath = null;
    fs.unlink(f).catch(() => {});
  }
}
// ---------- STATE (diingat antar sesi) ----------
const stateFile = () => path.join(app.getPath('userData'), 'state.json');
function loadState() {
  try { return JSON.parse(fsSync.readFileSync(stateFile(), 'utf-8')); } catch (e) { return {}; }
}
function saveState(patch) {
  try {
    fsSync.mkdirSync(app.getPath('userData'), { recursive: true });
    fsSync.writeFileSync(stateFile(), JSON.stringify({ ...loadState(), ...patch }));
  } catch (e) { /* abaikan */ }
}

// ---------- AUTOSTART ----------
function setAutostart(enable) {
  if (enable) {
    fsSync.mkdirSync(AUTOSTART_DIR, { recursive: true });
    // AppImage: process.execPath menunjuk ke /tmp/.mount_xxx yang berubah tiap peluncuran.
    const exe = process.env.APPIMAGE || process.execPath;
    const execCmd = app.isPackaged
      ? `"${exe}" --autostart`
      : `"${process.execPath}" "${app.getAppPath()}" --autostart`;

    // Icon di dalam asar tidak terbaca oleh desktop environment, jadi salin dulu ke userData.
    let iconLine = '';
    try {
      const dest = path.join(app.getPath('userData'), 'icon.png');
      fsSync.mkdirSync(app.getPath('userData'), { recursive: true });
      fsSync.copyFileSync(path.join(__dirname, 'icon.png'), dest);
      iconLine = `Icon=${dest}\n`;
    } catch (e) { /* tanpa icon pun tidak masalah */ }

    const entry = `[Desktop Entry]
Type=Application
Name=Ascii OS
Comment=Ascii OS Desktop Environment
Exec=${execCmd}
${iconLine}Terminal=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
`;
    fsSync.writeFileSync(AUTOSTART_FILE, entry, { mode: 0o755 });
  } else {
    try { fsSync.unlinkSync(AUTOSTART_FILE); } catch (e) {}
  }
}

function startNextServer() {
  if (nextServer) return;
  if (!app.isPackaged) return; // mode dev: `npm run dev` jalan terpisah

  // UBAH BARIS INI:
  const standaloneDir = path.join(app.getAppPath(), '.next', 'standalone');
  
  const serverPath = path.join(standaloneDir, 'server.js');
  if (!fsSync.existsSync(serverPath)) {
    console.error('[server] server.js tidak ditemukan di:', serverPath);
    return;
  }

  nextServer = spawn(process.execPath, [serverPath], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1', // jangan buka server ke jaringan
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
    },
    stdio: 'inherit',
  });
  nextServer.on('error', (err) => console.error('Gagal start server Next.js:', err));
  nextServer.on('exit', () => { nextServer = null; }); // supaya bisa dinyalakan lagi kalau mati
}
function stopNextServer() {
  if (!nextServer) return;
  try { nextServer.kill('SIGTERM'); } catch (e) {}
  nextServer = null;
}

function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        res.resume(); // buang body supaya socket tidak menumpuk
        if (res.statusCode === 200) resolve(true);
        else if (Date.now() - start > timeout) reject(new Error('Timeout'));
        else setTimeout(check, 500);
      }).on('error', () => {
        if (Date.now() - start > timeout) reject(new Error('Timeout'));
        else setTimeout(check, 500);
      });
    };
    check();
  });
}

// ---------- JENDELA SETUP ----------
function loadSetup() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  setupLoaded = true;
  mainWindow.loadURL(`${BASE_URL}/?mode=setup`).catch((e) => console.error('[setup] gagal memuat:', e.message));
}

function showSetupWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!setupLoaded) loadSetup();
  mainWindow.show();
  mainWindow.focus();
}

// Tampilkan jendela setup; kalau Ascii OS sedang dimatikan, nyalakan dulu.
function reveal() {
  if (isEnabled) showSetupWindow();
  else setAsciiOSEnabled(true);
}

// ---------- WALLPAPER ----------
function wallpaperIsOpen() {
  return !!wallpaperWindow && !wallpaperWindow.isDestroyed();
}

function pinWallpaperBottom() {
  if (!wallpaperIsOpen()) return;
  const xid = '0x' + wallpaperWindow.getNativeWindowHandle().readUInt32LE(0).toString(16);
  exec(`wmctrl -i -r ${xid} -b add,below,sticky,skip_taskbar,skip_pager`);
  exec(`xdotool windowlower ${xid}`);
}

function openWallpaper() {
  if (wallpaperIsOpen()) return;
  exec(`gsettings set org.gnome.desktop.background color-shading-type 'solid'`);
  exec(`gsettings set org.gnome.desktop.background primary-color '#000000'`);

  const { bounds } = screen.getPrimaryDisplay();
  
  wallpaperWindow = new BrowserWindow({
    x: bounds.x, y: bounds.y,
    width: bounds.width, height: bounds.height,
    type: 'desktop', // Tetap pakai ini agar muncul di Activities
    backgroundColor: '#000000',
    frame: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: PRELOAD,
      webSecurity: false,
      backgroundThrottling: false,
    },
  });

  wallpaperWindow.loadURL(`${BASE_URL}/?mode=wallpaper`);
  
  wallpaperWindow.once('ready-to-show', () => {
    wallpaperWindow.showInactive(); 
    wallpaperWindow.setIgnoreMouseEvents(true);
    
    const xid = '0x' + wallpaperWindow.getNativeWindowHandle().readUInt32LE(0).toString(16);

    // Daftarkan sebagai Desktop murni
    exec(`xprop -id ${xid} -f _NET_WM_WINDOW_TYPE 32a -set _NET_WM_WINDOW_TYPE _NET_WM_WINDOW_TYPE_DESKTOP`);
    
    // Dorong ke bawah
    exec(`wmctrl -i -r ${xid} -b add,below,sticky,skip_taskbar,skip_pager`);

    // PERBAIKAN 2: Paksa ukuran mentok ke ujung layar (abaikan Dock) agar gap hilang
    exec(`wmctrl -i -r ${xid} -e 0,${bounds.x},${bounds.y},${bounds.width},${bounds.height}`);

    wallpaperWindow.on('blur', () => {
      exec(`wmctrl -i -r ${xid} -b add,below,sticky,skip_taskbar,skip_pager`);
      exec(`wmctrl -i -r ${xid} -e 0,${bounds.x},${bounds.y},${bounds.width},${bounds.height}`);
    });

    scheduleSnapshots();   // <-- TAMBAH INI
  });
  
  wallpaperWindow.on('closed', () => {
        stopSnapshots(); 
    // Kembalikan wallpaper GNOME ke default saat aplikasi ditutup
    exec(`gsettings reset org.gnome.desktop.background picture-uri`);
    exec(`gsettings reset org.gnome.desktop.background picture-uri-dark`);
        exec(`gsettings reset org.gnome.desktop.background picture-options`);
    exec(`gsettings reset org.gnome.desktop.background primary-color`);
    exec(`gsettings reset org.gnome.desktop.background color-shading-type`);

    wallpaperWindow = null;
    if (!wallpaperClosingOnPurpose && isEnabled && !appIsQuitting) showSetupWindow();
    wallpaperClosingOnPurpose = false;
    refreshTray();
  });

  saveState({ wallpaper: true });
  refreshTray();
}
function closeWallpaper() {
  if (!wallpaperIsOpen()) return;
  wallpaperClosingOnPurpose = true;
  wallpaperWindow.close();
}

function stopWallpaper() {
  closeWallpaper();
  saveState({ wallpaper: false });
  showSetupWindow();
}

// ---------- ENABLE / DISABLE (setara "Hide/Show" di Hidamari) ----------
async function setAsciiOSEnabled(enabled) {
  isEnabled = enabled;

  if (!enabled) {
    closeWallpaper();
    saveState({ wallpaper: false });
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
    stopNextServer();
  } else {
    startNextServer();
    try {
      await waitForServer(BASE_URL, 15000);
      loadSetup();
      showSetupWindow();
    } catch (err) {
      console.error('Gagal menyalakan server Next.js:', err);
    }
  }
  refreshTray();
}

// ---------- TRAY ----------
function quitApp() {
  appIsQuitting = true;
  stopNextServer();
  app.quit();
}
let chatWindow = null;

function openChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.show();
    chatWindow.focus();
    return;
  }
  const { workArea } = screen.getPrimaryDisplay();
  const w = 450, h = 620;
  chatWindow = new BrowserWindow({
    width: w,
    height: h,
    x: workArea.x + workArea.width - w - 24,
    y: workArea.y + 24,
    title: 'Ascii Chat',
    backgroundColor: '#0a0a0a',
    alwaysOnTop: true,          // selalu di depan; ubah ke false kalau mengganggu
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: PRELOAD,
      webSecurity: false,
    },
  });
  chatWindow.loadURL(`${BASE_URL}/?mode=chat`);

  // Tombol X hanya menyembunyikan, supaya riwayat chat tidak hilang.
  chatWindow.on('close', (e) => {
    if (!appIsQuitting && tray) {
      e.preventDefault();
      chatWindow.hide();
    }
  });
  chatWindow.on('closed', () => { chatWindow = null; });
}
function openChatFromTray() {
  reveal();
  // beri waktu halaman setup selesai dimuat sebelum pesan dikirim
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('open-chat');
  }, setupLoaded ? 100 : 1500);
}

function openTerminalFromTray() {
  const child = spawn('gnome-terminal || x-terminal-emulator || xterm', [], {
    detached: true, stdio: 'ignore', shell: true,
  });
  child.unref();
}

function openTerminalFromTray() {
  const child = spawn('gnome-terminal || x-terminal-emulator || xterm', [], {
    detached: true, stdio: 'ignore', shell: true,
  });
  child.unref();
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: isEnabled ? 'Disable Ascii OS' : 'Enable Ascii OS', click: () => setAsciiOSEnabled(!isEnabled) },
    { label: 'Stop Wallpaper', enabled: wallpaperIsOpen(), click: stopWallpaper },
    {
      label: 'Start on Login',
      type: 'checkbox',
      checked: fsSync.existsSync(AUTOSTART_FILE),
      click: (item) => { setAutostart(item.checked); refreshTray(); },
    },
    { type: 'separator' },
    { label: 'Open Chat', click: openChatWindow },
    { label: 'Open Terminal', click: openTerminalFromTray },
    { type: 'separator' },
    { label: 'Show Window', click: reveal },
    { label: 'Quit', click: quitApp },
  ]);
}
function refreshTray() {
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  try {
    tray = new Tray(path.join(__dirname, 'icon.png'));
  } catch (err) {
    console.error('[tray] gagal membuat tray (cek electron/icon.png):', err.message);
    tray = null;
    return;
  }
  tray.setToolTip('Ascii OS');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => {
    if (!isEnabled) return reveal();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else showSetupWindow();
  });
}

// ==========================================
// FUNGSI BANTUAN (ICON & APPS)
// ==========================================
async function getIconBase64(iconName) {
  if (!iconName) return null;

  // 1. Kalau path-nya absolut (misal VS Code biasanya begini)
  if (path.isAbsolute(iconName)) {
    try {
      await fs.access(iconName);
      const ext = path.extname(iconName).toLowerCase();
      const mime = ext === '.svg' ? 'image/svg+xml' : 'image/png';
      const data = await fs.readFile(iconName);
      return `data:${mime};base64,${data.toString('base64')}`;
    } catch (e) { return null; }
  }

  // 2. Kalau cuma nama (misal "code" atau "firefox"), cari di berbagai folder
  const searchDirs = [
    '/usr/share/pixmaps',
    '/usr/local/share/pixmaps',
    path.join(os.homedir(), '.local/share/pixmaps'),
    '/usr/share/icons/hicolor/scalable/apps',
    '/usr/share/icons/hicolor/48x48/apps',
    '/usr/share/icons/hicolor/64x64/apps',
    '/usr/share/icons/hicolor/128x128/apps',
    '/usr/share/icons/hicolor/256x256/apps',
    '/usr/share/icons/Adwaita/48x48/apps',
    '/usr/share/icons/Yaru/48x48/apps',
    '/usr/share/icons/Papirus/48x48/apps',
    '/var/lib/snapd/desktop/icons',
    path.join(os.homedir(), '.local/share/flatpak/exports/share/icons'),
  ];

  for (const dir of searchDirs) {
    for (const ext of ['.png', '.svg']) {
      const p = path.join(dir, `${iconName}${ext}`);
      try {
        await fs.access(p);
        const mime = ext === '.svg' ? 'image/svg+xml' : 'image/png';
        const data = await fs.readFile(p);
        return `data:${mime};base64,${data.toString('base64')}`;
      } catch (e) { /* Lanjut cari */ }
    }
  }
  return null; // Kalau nggak ketemu, frontend bakal nampilin huruf depan
}

async function getLinuxApps() {
  const directories = [
    '/usr/share/applications',
    '/usr/local/share/applications',
    '/var/lib/snapd/desktop/applications',
    '/var/lib/flatpak/exports/share/applications',
    path.join(os.homedir(), '.local/share/applications'),
    path.join(os.homedir(), '.local/share/flatpak/exports/share/applications'),
  ];

  const seenIds = new Set();
  const appPromises = [];

  directories.forEach((dir) => {
    if (!fsSync.existsSync(dir)) return;
    const files = fsSync.readdirSync(dir);

    files.forEach((file) => {
      if (!file.endsWith('.desktop')) return;
      try {
        const content = fsSync.readFileSync(path.join(dir, file), 'utf-8');
        const nameMatch = content.match(/^Name=(.+)$/m);
        const execMatch = content.match(/^Exec=(.+)$/m);
        const iconMatch = content.match(/^Icon=(.+)$/m);
        const noDisplay = content.match(/^NoDisplay=true$/m);
        const hidden = content.match(/^Hidden=true$/m);

        if (nameMatch && execMatch && !noDisplay && !hidden) {
          const name = nameMatch[1].trim();
          let execCmd = execMatch[1].trim();

          // Bersihkan argumen %f, %U, dll, dan rapikan spasi
          execCmd = execCmd.replace(/%[fFuUdDnNickvm]/g, '').replace(/\s+/g, ' ').trim();
          if (execCmd.startsWith('"') && execCmd.endsWith('"')) execCmd = execCmd.slice(1, -1);

          const iconName = iconMatch ? iconMatch[1].trim() : null;
          const appId = `sys-${file.replace('.desktop', '')}`;

          if (!seenIds.has(appId)) {
            seenIds.add(appId);
            appPromises.push((async () => {
              const iconBase64 = await getIconBase64(iconName);
              return { id: appId, name, command: execCmd, icon: iconBase64 };
            })());
          }
        }
      } catch (e) { /* ignore error */ }
    });
  });
  return Promise.all(appPromises);
}

// ==========================================
// HTML MATRIX LOADING SCREEN
// ==========================================
const loadingHtml = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; padding: 0; background-color: black; overflow: hidden; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: monospace; color: white; }
  canvas { display: block; }
  #loading-text { position: absolute; color: white; font-size: 14px; letter-spacing: 2px; animation: pulse 1.5s infinite; z-index: 10; background: black; padding: 4px 8px; border: 1px solid rgba(255,255,255,0.3); }
  @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
</style>
</head>
<body>
  <canvas id="matrix"></canvas>
  <div id="loading-text">[ INITIALIZING ASCII OS... ]</div>
  <script>
    const canvas = document.getElementById('matrix');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*';
    const fontSize = 16; const columns = canvas.width / fontSize; const drops = [];
    for (let x = 0; x < columns; x++) drops[x] = 1;
    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = fontSize + 'px monospace';
      for (let i = 0; i < drops.length; i++) {
        const text = letters.charAt(Math.floor(Math.random() * letters.length));
        ctx.fillStyle = Math.random() > 0.8 ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }
    setInterval(draw, 33);
    window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
  </script>
</body>
</html>
`;

// ==========================================
// IPC: STATUS APLIKASI, WALLPAPER, AUTOSTART, QUIT
// (semua didaftarkan sekali di level atas, bukan di dalam createWindow)
// ==========================================
ipcMain.handle('get-app-state', () => ({
  enabled: isEnabled,
  autostart: fsSync.existsSync(AUTOSTART_FILE),
  wallpaper: wallpaperIsOpen(),
}));

ipcMain.handle('set-app-enabled', async (event, enabled) => {
  try {
    await setAsciiOSEnabled(!!enabled);
    return { success: true, enabled: isEnabled };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('set-autostart', (event, enabled) => {
  try {
    setAutostart(!!enabled);
    refreshTray();
    return { success: true, autostart: fsSync.existsSync(AUTOSTART_FILE) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('toggle-live-wallpaper', () => {
  if (wallpaperIsOpen()) {
    wallpaperWindow.webContents.reload();
    scheduleSnapshots();
  } else {
    openWallpaper();
  }
  saveState({ wallpaper: true });
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  return { success: true, mode: 'live' };
});

ipcMain.handle('quit-app', () => { quitApp(); });

// ==========================================
// IPC: SISTEM (launcher, jendela, WiFi, Bluetooth, dll)
// ==========================================
ipcMain.handle('launch-native-app', async (event, { command, name }) => {
  return new Promise((resolve) => {
    exec(`wmctrl -a "${name}"`, (err) => {
      if (!err) {
        resolve({ success: true, focused: true });
      } else {
        try {
          const child = spawn(command, [], {
            detached: true, stdio: 'ignore', shell: true,
            env: { ...process.env, XDG_RUNTIME_DIR: `/run/user/${process.getuid()}` },
          });
          child.on('error', () => resolve({ success: false, error: 'Perintah tidak ditemukan.' }));
          child.unref();
          resolve({ success: true, focused: false });
        } catch (error) {
          resolve({ success: false, error: error.message });
        }
      }
    });
  });
});

ipcMain.handle('get-running-windows', async () => {
  return new Promise((resolve) => {
    exec('xprop -root _NET_ACTIVE_WINDOW', (err, activeStdout) => {
      let activeId = null;
      if (!err) {
        const match = activeStdout.match(/0x[0-9a-fA-F]+/);
        if (match) activeId = match[0];
      }
      exec('wmctrl -l', (error, stdout) => {
        if (error) return resolve([]);
        const lines = stdout.trim().split('\n');
        const windows = [];
        lines.forEach((line) => {
          const parts = line.split(/\s+/);
          if (parts.length >= 4) {
            const id = parts[0];
            const title = parts.slice(3).join(' ');
            const isActive = activeId ? (parseInt(id, 16) === parseInt(activeId, 16)) : false;
            if (title && title !== 'Desktop' && !title.includes('TopBar')) {
              windows.push({ id, title, active: isActive });
            }
          }
        });
        resolve(windows);
      });
    });
  });
});

ipcMain.handle('focus-window', async (event, id) => {
  exec(`wmctrl -i -a ${id}`);
});

ipcMain.handle('arrange-window', async (event, { id, action }) => {
  return new Promise((resolve) => {
    const wa = screen.getPrimaryDisplay().workArea;
    const halfW = Math.floor(wa.width / 2);
    const unmax = `wmctrl -i -r ${id} -b remove,maximized_vert,maximized_horz`;
    let cmd = '';
    if (action === 'left') cmd = `${unmax} && wmctrl -i -r ${id} -e 0,${wa.x},${wa.y},${halfW},${wa.height}`;
    else if (action === 'right') cmd = `${unmax} && wmctrl -i -r ${id} -e 0,${wa.x + halfW},${wa.y},${halfW},${wa.height}`;
    else if (action === 'maximize') cmd = `wmctrl -i -r ${id} -b add,maximized_vert,maximized_horz`;
    else if (action === 'restore') cmd = `wmctrl -i -r ${id} -b remove,maximized_vert,maximized_horz`;
    if (!cmd) return resolve({ success: false, error: 'Unknown action' });
    exec(cmd, (error) => {
      if (error) resolve({ success: false, error: error.message });
      else { exec(`wmctrl -i -a ${id}`); resolve({ success: true }); }
    });
  });
});

ipcMain.handle('get-system-apps', async () => { return await getLinuxApps(); });

ipcMain.handle('read-env', async () => {
  try {
    const envPath = app.isPackaged ? path.join(app.getPath('userData'), '.env.local') : path.join(process.cwd(), '.env.local');
    return await fs.readFile(envPath, 'utf-8');
  } catch (err) { return ''; }
});

ipcMain.handle('write-env', async (event, content) => {
  try {
    const envPath = app.isPackaged ? path.join(app.getPath('userData'), '.env.local') : path.join(process.cwd(), '.env.local');
    await fs.writeFile(envPath, content, 'utf-8');
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('system-action', async (event, action) => {
  return new Promise((resolve) => {
    let cmd = '';
    if (action === 'volume-up') cmd = 'pactl set-sink-volume @DEFAULT_SINK@ +5%';
    else if (action === 'volume-down') cmd = 'pactl set-sink-volume @DEFAULT_SINK@ -5%';
    else if (action === 'volume-mute') cmd = 'pactl set-sink-mute @DEFAULT_SINK@ toggle';
    else if (action === 'power-shutdown') cmd = 'systemctl poweroff';
    else if (action === 'power-restart') cmd = 'systemctl reboot';
    else if (action === 'power-sleep') cmd = 'systemctl suspend';
    else if (action === 'logout') cmd = `pkill -KILL -u ${os.userInfo().username}`;
    else if (action === 'wifi-on') cmd = 'nmcli radio wifi on';
    else if (action === 'wifi-off') cmd = 'nmcli radio wifi off';
    else if (action === 'bt-on') cmd = 'rfkill unblock bluetooth && bluetoothctl power on';
    else if (action === 'bt-off') cmd = 'rfkill block bluetooth';
    if (!cmd) return resolve({ success: false, error: 'Unknown action' });
    exec(cmd, (error) => {
      if (error) resolve({ success: false, error: error.message });
      else resolve({ success: true });
    });
  });
});

ipcMain.handle('get-wifi-list', async () => {
  return new Promise((resolve) => {
    exec('nmcli -t -f ACTIVE,SSID,SECURITY,SIGNAL dev wifi list', (error, stdout) => {
      if (error) return resolve({ list: [], currentSsid: null });
      const lines = stdout.trim().split('\n');
      const networks = new Map();
      let currentSsid = null;
      lines.forEach((line) => {
        const parts = line.split(':');
        const active = parts[0], ssid = parts[1], security = parts[2], signal = parts[3];
        if (ssid && ssid.trim() !== '') {
          networks.set(ssid, { ssid, security: security || 'Open', signal: parseInt(signal) || 0 });
          if (active === 'yes') currentSsid = ssid;
        }
      });
      resolve({ list: Array.from(networks.values()).sort((a, b) => b.signal - a.signal), currentSsid });
    });
  });
});

ipcMain.handle('connect-wifi', async (event, { ssid, password }) => {
  return new Promise((resolve) => {
    let cmd = `nmcli dev wifi connect "${ssid}"`;
    if (password && password.trim() !== '') cmd += ` password "${password}"`;
    exec(cmd, (error) => {
      if (error) resolve({ success: false, error: error.message });
      else resolve({ success: true });
    });
  });
});

ipcMain.handle('get-bt-devices', async () => {
  return new Promise((resolve) => {
    exec('bluetoothctl devices Paired', (error, stdout) => {
      if (error) return resolve([]);
      const lines = stdout.trim().split('\n');
      if (!lines[0]) return resolve([]);
      const devices = [];
      let pending = lines.length;
      lines.forEach((line) => {
        const parts = line.split(' ');
        const mac = parts[1], name = parts.slice(2).join(' ');
        exec(`bluetoothctl info ${mac}`, (err, infoOut) => {
          const isConnected = infoOut && infoOut.includes('Connected: yes');
          devices.push({ mac, name, connected: isConnected });
          pending--;
          if (pending === 0) resolve(devices);
        });
      });
    });
  });
});

ipcMain.handle('toggle-bt-device', async (event, { mac, action }) => {
  return new Promise((resolve) => {
    exec(`bluetoothctl ${action} ${mac}`, (error) => {
      if (error) resolve({ success: false, error: error.message });
      else resolve({ success: true });
    });
  });
});

ipcMain.handle('open-native-editor', async (event, fileName) => {
  try {
    const basePath = app.isPackaged ? app.getPath('userData') : process.cwd();
    const filePath = path.join(basePath, fileName);
    if (!fsSync.existsSync(filePath)) fsSync.writeFileSync(filePath, '', 'utf-8');
    exec(`xdg-open "${filePath}" || gedit "${filePath}" || kate "${filePath}" || mousepad "${filePath}"`);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('open-url', async (event, url) => {
  return new Promise((resolve) => {
    exec(`xdg-open "${url}"`, (error) => {
      if (error) resolve({ success: false, error: error.message });
      else resolve({ success: true });
    });
  });
});
ipcMain.handle('open-terminal', () => {
  try {
    const child = spawn('gnome-terminal || x-terminal-emulator || xterm', [], {
      detached: true, stdio: 'ignore', shell: true,
    });
    child.unref();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle('open-chat-window', () => {
  openChatWindow();
  return { success: true };
});
ipcMain.handle('check-mic', async () => {
  return new Promise((resolve) => {
    exec('arecord -l', (error, stdout) => {
      if (error || !stdout.trim() || stdout.includes('no soundcards')) resolve({ available: false });
      else resolve({ available: true });
    });
  });
});

// ==========================================
// JENDELA UTAMA (setup)
// ==========================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#000000',
    frame: true,
    show: false,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: PRELOAD,
      webSecurity: false,
    },
  });

  // IZIN MIKROFON / AUDIO (berlaku untuk semua jendela: session default dipakai bersama)
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    return permission === 'media' || permission === 'audioCapture';
  });

  mainWindow.webContents.on('console-message', (...args) => {
    const e = args[0];
    const isNew = e && typeof e.message === 'string';
    const message = isNew ? e.message : args[2];
    const level = String(isNew ? e.level : args[1]);
    const tag = /error|3/.test(level) ? 'ERR' : /warn|2/.test(level) ? 'WARN' : 'LOG';
    console.log(`[renderer:${tag}]`, message);
  });

  // Tombol X menyembunyikan jendela ke tray (bukan menghancurkannya).
  // Tanpa tray yang berfungsi, X benar-benar menutup aplikasi.
  mainWindow.on('close', (e) => {
    if (!appIsQuitting && tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Layar loading Matrix dulu
  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(loadingHtml));

  mainWindow.once('ready-to-show', () => {
    if (START_HIDDEN) return; // dijalankan otomatis saat login: tetap di tray
    mainWindow.show();
    mainWindow.maximize();
  });
}

// ==========================================
// APP LIFECYCLE
// ==========================================
app.on('second-instance', () => { reveal(); });

app.whenReady().then(async () => {
  if (!gotLock) return;

  createWindow();
  createTray();

  // Resolusi/monitor berubah: wallpaper ikut menyesuaikan ukuran layar.
  screen.on('display-metrics-changed', () => {
    if (wallpaperIsOpen()) wallpaperWindow.setBounds(screen.getPrimaryDisplay().bounds);
  });

  startNextServer();
  try {
    await waitForServer(BASE_URL);

    if (START_HIDDEN && loadState().wallpaper) {
      // Login otomatis: langsung tampilkan wallpaper, jendela setup tidak dimuat sama sekali.
      openWallpaper();
    } else {
      loadSetup();
      if (START_HIDDEN) showSetupWindow();
    }
  } catch (err) {
    console.error('Server Next.js gagal menyala:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      const errorHtml = `
        <body style="background:black;color:red;font-family:monospace;padding:40px;">
          <h1>[ FATAL ERROR ]</h1>
          <p>Next.js Server gagal menyala.</p>
          <p>Silakan cek terminal untuk melihat pesan error lengkapnya.</p>
          <pre>${String(err.message).replace(/</g, '&lt;')}</pre>
        </body>`;
      mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errorHtml));
      mainWindow.show();
    }
  }
});

app.on('before-quit', () => {
  appIsQuitting = true;
  if (wallpaperIsOpen()) {
    for (const k of ['picture-uri', 'picture-uri-dark', 'picture-options', 'primary-color', 'color-shading-type']) {
      try { execSync(`gsettings reset org.gnome.desktop.background ${k}`); } catch (e) {}
    }
  }
  stopNextServer();
});
app.on('window-all-closed', () => {
  // Tetap hidup di tray kecuali memang diminta keluar.
  if (!appIsQuitting && tray) return;
  app.quit();
});