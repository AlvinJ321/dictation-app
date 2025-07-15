const { app, BrowserWindow, ipcMain, safeStorage, screen, session } = require('electron');
const { GlobalKeyboardListener } = require('node-global-key-listener');
const path = require('path');
const { fork } = require('child_process');
const robot = require('@hurdlegroup/robotjs');
const { systemPreferences, dialog } = require('electron');
const { MainProcessAudio } = require('./src/main/audio');
const player = require('play-sound')(opts = {});
const isProd = process.env.NODE_ENV === 'production' || (app && app.isPackaged);

let mainWindow;
let feedbackWindow;
let isWindowReadyForIPC = false;
let serverProcess;
let audioHandler;
let keyListener;
let rightOptionPressed = false;
let store;
let isRefinementOn = true;
let lastPermissions = { mic: false, accessibility: false };
let permissionMonitorInterval = null;
let restartDialogShown = false;
let permissionsChecked = false;

const messageQueue = [];

function sendOrQueueIPC(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed() && isWindowReadyForIPC) {
    try {
      mainWindow.webContents.send(channel, ...args);
    } catch (error) {
      console.error(`[Main] Error sending IPC message on channel '${channel}' to main window:`, error);
    }
  } else {
    messageQueue.push({ channel, args });
  }

  if (feedbackWindow && !feedbackWindow.isDestroyed() && feedbackWindow.webContents && !feedbackWindow.webContents.isDestroyed()) {
    try {
      feedbackWindow.webContents.send(channel, ...args);
    } catch (error) {
      console.error(`[Main] Error sending IPC message on channel '${channel}' to feedback window:`, error);
    }
  }
}

function processMessageQueue() {
  while(messageQueue.length > 0) {
    const { channel, args } = messageQueue.shift();
    sendOrQueueIPC(channel, ...args);
  }
}

function createFeedbackWindow(initialStatus) {
  if (feedbackWindow) {
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  feedbackWindow = new BrowserWindow({
    width: 300,
    height: 40,
    x: Math.round((width - 300) / 2),
    y: height - 60,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    focusable: false,
    show: false,
    icon: path.join(__dirname, 'resource', 'Voco.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev = !app.isPackaged;
  const feedbackUrl = isDev
    ? 'http://localhost:5173/feedback.html'
    : `file://${path.join(__dirname, 'dist', 'feedback.html')}`;

  feedbackWindow.loadURL(feedbackUrl);

  const onReady = () => {
    if (feedbackWindow && !feedbackWindow.isDestroyed()) {
      feedbackWindow.webContents.send('recording-status', initialStatus);
      setTimeout(() => {
        if (feedbackWindow && !feedbackWindow.isDestroyed()) {
          feedbackWindow.showInactive();
        }
      }, 100);
    }
  };

  ipcMain.once('feedback-window-ready', onReady);

  feedbackWindow.on('closed', () => {
    ipcMain.removeListener('feedback-window-ready', onReady);
    feedbackWindow = null;
  });
}

function destroyFeedbackWindow() {
  if (feedbackWindow) {
    feedbackWindow.close();
  }
}

function createWindow () {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    mainWindow = null;
    isWindowReadyForIPC = false;
  }
  mainWindow = new BrowserWindow({
    title: 'Voco',
    width: 700,
    height: 600,
    resizable: false,
    center: true,
    icon: path.join(__dirname, 'resource', 'Voco.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  const isDev = process.argv.includes('--dev');

  if (isDev) {
    const devUrl = 'http://localhost:5173';
    const loadDevUrl = () => {
      mainWindow.loadURL(devUrl).catch((err) => {
        setTimeout(loadDevUrl, 2000);
      });
    };
    loadDevUrl();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    isWindowReadyForIPC = true;
    processMessageQueue();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    isWindowReadyForIPC = false;
    if (feedbackWindow) {
      feedbackWindow.close();
    }
  });

  const apiBaseUrl = isProd ? 'http://47.117.8.146' : 'http://localhost:3001';

  audioHandler = new MainProcessAudio(
    sendOrQueueIPC,
    store,
    player,
    () => isRefinementOn,
    createFeedbackWindow,
    destroyFeedbackWindow,
    apiBaseUrl
  );
}

const TARGET_KEY_NAME_PRIMARY = 'RIGHT ALT';
const TARGET_KEY_NAME_SECONDARY = 'RIGHT OPTION';
const TARGET_KEY_NAME_TERTIARY = 'ALTGR';

async function checkAndRequestPermissions(promptForAccessibility = true) {
    if (process.platform === 'darwin') {
        let micAccess = systemPreferences.getMediaAccessStatus('microphone');
        if (micAccess === 'not-determined') {
            micAccess = await systemPreferences.askForMediaAccess('microphone') ? 'granted' : 'denied';
        }

        let accessibilityAccess = systemPreferences.isTrustedAccessibilityClient(false);
        if (!accessibilityAccess && promptForAccessibility) {
            accessibilityAccess = systemPreferences.isTrustedAccessibilityClient(true);
        }
        
        return { mic: micAccess === 'granted', accessibility: accessibilityAccess };
    } else if (process.platform === 'win32') {
        const micAccess = systemPreferences.getMediaAccessStatus('microphone');
        return { mic: micAccess !== 'denied', accessibility: true };
    }
    return { mic: true, accessibility: true };
}

async function checkPermissionsOnly() {
    if (process.platform === 'darwin') {
        const micAccess = systemPreferences.getMediaAccessStatus('microphone');
        const accessibilityAccess = systemPreferences.isTrustedAccessibilityClient(false);
        return { mic: micAccess === 'granted', accessibility: accessibilityAccess };
    } else if (process.platform === 'win32') {
        const micAccess = systemPreferences.getMediaAccessStatus('microphone');
        return { mic: micAccess !== 'denied', accessibility: true };
    }
    return { mic: true, accessibility: true };
}

async function showRestartDialog() {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
    else mainWindow.show();

    const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['稍后', '立即重启'],
        defaultId: 1,
        title: '辅助功能权限已授予',
        message: '请重启应用以使新权限生效。',
    });

    if (response === 1) {
        app.relaunch();
        app.exit(0);
    }
}

async function monitorPermissionChanges() {
  if (process.platform !== 'darwin') return;
  
  const currentPermissions = await checkPermissionsOnly();
  if (!lastPermissions.accessibility && currentPermissions.accessibility && !restartDialogShown) {
    restartDialogShown = true;
    await showRestartDialog();
  }
  lastPermissions = currentPermissions;
}

function startPermissionMonitor() {
  if (permissionMonitorInterval) return;
  permissionMonitorInterval = setInterval(monitorPermissionChanges, 2000);
}

function stopPermissionMonitor() {
  if (permissionMonitorInterval) {
    clearInterval(permissionMonitorInterval);
    permissionMonitorInterval = null;
  }
}

app.whenReady().then(async () => {
  const { default: Store } = await import('electron-store');
  store = new Store();

  ipcMain.handle('get-tokens', () => null);
  ipcMain.on('set-tokens', () => {});
  ipcMain.on('clear-tokens', () => {
    store.delete('accessToken');
    store.delete('refreshToken');
  });

  ipcMain.on('set-refinement-state', (event, state) => {
    isRefinementOn = state;
  });

  ipcMain.handle('check-permissions', async () => checkPermissionsOnly());
  ipcMain.handle('restart-app', () => {
    app.relaunch();
    app.exit(0);
  });

  keyListener = new GlobalKeyboardListener();
  keyListener.addListener(async (e, down) => {
    const keyName = e.name;
    if (e.state === "DOWN" && (keyName === TARGET_KEY_NAME_PRIMARY || keyName === TARGET_KEY_NAME_SECONDARY || keyName === TARGET_KEY_NAME_TERTIARY)) {
      if (!rightOptionPressed) {
        rightOptionPressed = true;
        
        if (!permissionsChecked) {
          lastPermissions = await checkAndRequestPermissions(true);
          permissionsChecked = true;
        }

        if (!lastPermissions.mic || !lastPermissions.accessibility) {
          rightOptionPressed = false;
          return;
        }

        if (feedbackWindow) feedbackWindow.showInactive();
        
        // --- SOUND EFFECT ADDED BACK ---
        const startSoundPath = isProd 
          ? path.join(process.resourcesPath, 'sfx', 'start-recording-bubble.mp3')
          : path.join(__dirname, 'sfx', 'start-recording-bubble.mp3');
        player.play(startSoundPath, (err) => {
          if (err) console.error('Error playing start sound:', err);
        });
        // --- END SOUND EFFECT ---
        
        audioHandler.startRecording(session.defaultSession);
      }
    } else if (e.state === "UP" && (keyName === TARGET_KEY_NAME_PRIMARY || keyName === TARGET_KEY_NAME_TERTIARY || keyName === TARGET_KEY_NAME_SECONDARY)) {
      if (rightOptionPressed && audioHandler.isRecording) {
        rightOptionPressed = false;
        
        // --- SOUND EFFECT ADDED BACK ---
        const stopSoundPath = isProd
          ? path.join(process.resourcesPath, 'sfx', 'stop-recording-bubble.mp3')
          : path.join(__dirname, 'sfx', 'stop-recording-bubble.mp3');
        player.play(stopSoundPath, (err) => {
          if (err) console.error('Error playing stop sound:', err);
        });
        // --- END SOUND EFFECT ---

        audioHandler.stopRecordingAndProcess();
      } else {
        rightOptionPressed = false;
      }
    }
  });

  lastPermissions = await checkPermissionsOnly();
  startPermissionMonitor();
  createWindow();

  app.on('browser-window-focus', async () => {
    if (!permissionsChecked) {
      lastPermissions = await checkAndRequestPermissions(true);
      permissionsChecked = true;
    }
  });
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  keyListener.kill();
});