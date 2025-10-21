const { app, BrowserWindow, ipcMain, safeStorage, screen, shell } = require('electron');
// const iohook = require('iohook'); // Remove iohook
const { GlobalKeyboardListener } = require('node-global-key-listener');
const path = require('path');
const { fork } = require('child_process'); // Added for forking the server process
const robot = require('@hurdlegroup/robotjs'); // Added RobotJS
const { systemPreferences, dialog } = require('electron'); // Added systemPreferences and dialog
const { MainProcessAudio } = require('./src/main/audio');
const player = require('play-sound')(opts = {});
const isProd = process.env.NODE_ENV === 'production' || (app && app.isPackaged);

let mainWindow; // This will hold the main window reference
let feedbackWindow; // This will hold the feedback window reference
let isWindowReadyForIPC = false; // Flag to indicate if window can receive IPC
let serverProcess; // Variable to hold the server child process
let audioHandler;
let keyListener;
let rightOptionPressed = false; // Moved to top-level scope
let store; // Define store in the top-level scope
let isRefinementOn = true; // Default to ON
let lastPermissions = { mic: false, accessibility: false };
let permissionMonitorInterval = null;
let restartDialogShown = false; // Flag to prevent showing dialog multiple times
let permissionsChecked = false; // Flag to track if permissions have been checked

// --- Message Queue ---
// A queue to hold messages when the renderer is not ready
const messageQueue = [];

function sendOrQueueIPC(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed() && isWindowReadyForIPC) {
    try {
      mainWindow.webContents.send(channel, ...args);
      console.log(`[Main] IPC message sent on channel '${channel}' to main window.`);
    } catch (error) {
      console.error(`[Main] Error sending IPC message on channel '${channel}' to main window:`, error);
    }
  } else {
    console.log(`[Main] Main window not ready. Queuing message for channel '${channel}'.`);
    messageQueue.push({ channel, args });
  }

  // Also send to feedback window if it exists
  if (feedbackWindow && !feedbackWindow.isDestroyed() && feedbackWindow.webContents && !feedbackWindow.webContents.isDestroyed()) {
    try {
      feedbackWindow.webContents.send(channel, ...args);
      console.log(`[Main] IPC message sent on channel '${channel}' to feedback window.`);
    } catch (error) {
      console.error(`[Main] Error sending IPC message on channel '${channel}' to feedback window:`, error);
    }
  }
}

function processMessageQueue() {
  console.log(`[Main] Processing message queue. ${messageQueue.length} messages to send.`);
  while(messageQueue.length > 0) {
    const { channel, args } = messageQueue.shift();
    sendOrQueueIPC(channel, ...args);
  }
}

function startServer() {
  // For development, we can use ts-node to run the .ts file directly.
  // For production, you would first compile server.ts to server.js (e.g., in a dist folder)
  // and then fork the .js file.
  
  // Using fork with 'ts-node' as the command and serverPath as an arg for ts-node
  // This assumes 'ts-node' is globally available or found via npx-like resolution by fork.
  // A more direct approach for local ts-node is often `fork(require.resolve('ts-node/dist/bin'), [serverPath], {...});`
  // but `require.resolve` for binaries can be tricky. So, let's use a simpler `spawn` or a direct fork of compiled js.

  // Let's use fork with node and pass --require ts-node/register
  // This is often more reliable for local ts-node installations.
  console.log('[Main] Starting server...');
  const tsNodeProject = path.join(__dirname, 'tsconfig.server.json'); // Path to server tsconfig

  serverProcess = fork(serverPath, [], {
    execArgv: ['--require', 'ts-node/register'],
    stdio: 'inherit',
    env: { 
      ...process.env, // Inherit parent environment
      TS_NODE_PROJECT: tsNodeProject // Tell ts-node which config to use
    }
  });

  serverProcess.on('error', (err) => {
    console.error('[Main] Server process error:', err);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`[Main] Server process exited with code ${code} and signal ${signal}`);
    serverProcess = null; // Clear the reference
  });
  console.log('[Main] Server process likely started.');
}

function stopServer() {
  if (serverProcess) {
    console.log('[Main] Stopping server process...');
    serverProcess.kill();
    serverProcess = null;
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
    console.log(`[Main] Feedback window is ready. Sending initial status: ${initialStatus}`);
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

  // Check if the --dev flag was passed
  const isDev = process.argv.includes('--dev');

  // Load the index.html of the app.
  if (isDev) {
    const devUrl = 'http://localhost:5173';
    
    // Retry loading the URL until the Vite server is ready
    const loadDevUrl = () => {
      mainWindow.loadURL(devUrl).catch((err) => {
        console.log('Error loading dev URL, retrying in 2 seconds:', err.message);
        setTimeout(loadDevUrl, 2000);
      });
    };
    
    loadDevUrl();
    // mainWindow.webContents.openDevTools(); // Temporarily disabled for cleaner launch
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    isWindowReadyForIPC = true;
    console.log('Window finished loading. Ready for IPC. Waiting for app-ready signal...');
    // The queue will be processed when 'app-ready' is received.
  });

  // Set flags when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
    isWindowReadyForIPC = false;
    console.log('Window closed.');
    // Also close the feedback window if it exists
    if (feedbackWindow) {
      feedbackWindow.close();
    }
  });

  // We no longer create the feedback window here.
  // It will be created on demand by the audio handler.

  // Initialize the audio handler once the window is created and pass the IPC function
  const isProduction = app.isPackaged;
  const apiBaseUrl = isProduction ? 'http://47.117.8.146' : 'http://localhost:3001';

  audioHandler = new MainProcessAudio(
    sendOrQueueIPC,
    store,
    player,
    () => isRefinementOn,
    createFeedbackWindow, // Pass the create function
    destroyFeedbackWindow, // Pass the destroy function
    apiBaseUrl // Pass the API base URL
  );
}

const TARGET_KEY_NAME_PRIMARY = 'RIGHT ALT'; // Corrected: This was the working value from logs
const TARGET_KEY_NAME_SECONDARY = 'RIGHT OPTION'; // Fallback
const TARGET_KEY_NAME_TERTIARY = 'ALTGR'; // Another possibility

console.log(`Attempting to listen for Right Option key (guessed as ${TARGET_KEY_NAME_PRIMARY}, ${TARGET_KEY_NAME_SECONDARY}, or ${TARGET_KEY_NAME_TERTIARY})`);

async function checkAndRequestPermissions(promptForAccessibility = true) {
  if (process.platform === 'darwin') {
    // macOS-specific permission logic
    // Microphone Access
    let micAccess = systemPreferences.getMediaAccessStatus('microphone');
    console.log('[Main] Initial Microphone Access Status:', micAccess);

    if (micAccess === 'not-determined') {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      micAccess = granted ? 'granted' : 'denied';
      console.log('[Main] Microphone Access after asking:', micAccess);
    }

    // Accessibility Access
    let accessibilityAccess = systemPreferences.isTrustedAccessibilityClient(false); // Check without prompting
    console.log('[Main] Initial Accessibility Access Status:', accessibilityAccess);

    if (!accessibilityAccess && promptForAccessibility) {
      console.log('[Main] Accessibility not granted, attempting to trigger system prompt...');
      systemPreferences.isTrustedAccessibilityClient(true); // This prompts the user.
      accessibilityAccess = systemPreferences.isTrustedAccessibilityClient(false);
      console.log('[Main] Accessibility Access after system prompt attempt:', accessibilityAccess);
    }
    
    console.log('[Main] Final Accessibility Access Status:', accessibilityAccess);
    return { mic: micAccess === 'granted', accessibility: accessibilityAccess };

  } else if (process.platform === 'win32') {
    // Windows-specific permission logic
    let micAccess = systemPreferences.getMediaAccessStatus('microphone');
    console.log('[Main] Windows Microphone Access Status:', micAccess);

    if (micAccess === 'denied') {
      dialog.showMessageBox({
        type: 'warning',
        title: 'Microphone Access Denied',
        message: 'Microphone access is required for dictation.',
        detail: 'Please go to Windows Settings > Privacy & security > Microphone and ensure this application has permission to access the microphone.',
        buttons: ['OK']
      });
    }

    // On Windows, robotjs does not require explicit accessibility permissions.
    // The microphone prompt will appear when the app first tries to record.
    // We return true for accessibility to allow the app to proceed.
    // The function will return true for mic unless it's explicitly denied.
    return { mic: micAccess !== 'denied', accessibility: true };
  } else {
    // For other platforms like Linux, assume permissions are granted.
    console.log(`[Main] Running on unsupported platform for permission check: ${process.platform}. Assuming permissions are granted.`);
    return { mic: true, accessibility: true };
  }
}

// Function to check permissions without prompting (for monitoring)
async function checkPermissionsOnly() {
  if (process.platform === 'darwin') {
    // macOS-specific permission check without prompting
    const micAccess = systemPreferences.getMediaAccessStatus('microphone');
    const accessibilityAccess = systemPreferences.isTrustedAccessibilityClient(false);
    
    console.log('[Main] Permission check - Mic:', micAccess, 'Accessibility:', accessibilityAccess);
    
    return { 
      mic: micAccess === 'granted', 
      accessibility: accessibilityAccess 
    };
  } else if (process.platform === 'win32') {
    // Windows-specific permission check
    const micAccess = systemPreferences.getMediaAccessStatus('microphone');
    return { 
      mic: micAccess !== 'denied', 
      accessibility: true 
    };
  } else {
    return { mic: true, accessibility: true };
  }
}

// Update showRestartDialog to always show and focus the main window
async function showRestartDialog() {
  // Ensure mainWindow exists and is visible
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }

  // Wait a moment to ensure window is visible
  await new Promise((resolve) => setTimeout(resolve, 300));

  const { dialog } = require('electron');
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['稍后', '立即重启'],
    defaultId: 1,
    cancelId: 0,
    title: '辅助功能权限已授予',
    message: '辅助功能权限已授予，请重启应用以使新权限生效。',
    detail: '点击"立即重启"将立即重启应用，或点击"稍后"稍后手动重启。',
    noLink: true,
    normalizeAccessKeys: true,
  });

  if (result.response === 1) {
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 500);
  }
}

// Function to monitor permission changes and show restart dialog when needed
async function monitorPermissionChanges() {
  if (process.platform !== 'darwin') {
    return; // Only monitor on macOS where accessibility permissions matter
  }
  
  const currentPermissions = await checkPermissionsOnly();
  
  console.log('[Main] Permission monitoring - Previous:', lastPermissions, 'Current:', currentPermissions);
  
  // Check if accessibility permission changed from denied to granted
  const accessibilityWasDenied = !lastPermissions.accessibility;
  const accessibilityNowGranted = currentPermissions.accessibility;
  
  if (accessibilityWasDenied && accessibilityNowGranted && !restartDialogShown) {
    console.log('[Main] Accessibility permission changed from denied to granted. Showing restart dialog...');
    restartDialogShown = true; // Set flag to prevent duplicate dialogs
    await showRestartDialog();
  } else if (accessibilityNowGranted) {
    console.log('[Main] Accessibility permission is granted, no change detected or dialog already shown');
  } else {
    console.log('[Main] Accessibility permission is not granted');
    // Reset flag when accessibility permission is revoked
    restartDialogShown = false;
  }
  
  // Update last permissions state
  lastPermissions = currentPermissions;
}

// Function to start permission monitoring timer
function startPermissionMonitor() {
  if (permissionMonitorInterval) return;
  permissionMonitorInterval = setInterval(async () => {
    await monitorPermissionChanges();
    // If both permissions are granted, stop the timer
    if (lastPermissions.mic && lastPermissions.accessibility) {
      stopPermissionMonitor();
    }
  }, 2000);
}

// Function to stop permission monitoring timer
function stopPermissionMonitor() {
  if (permissionMonitorInterval) {
    clearInterval(permissionMonitorInterval);
    permissionMonitorInterval = null;
    console.log('[Main] Permission monitoring stopped.');
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // --- Electron Store and IPC Handlers for Auth ---
  const { default: Store } = await import('electron-store');
  store = new Store(); // Initialize the top-level store

  ipcMain.handle('get-tokens', () => {
    try {
      const encryptedAccessToken = store.get('accessToken');
      const encryptedRefreshToken = store.get('refreshToken');

      const accessToken =
        encryptedAccessToken && safeStorage.isEncryptionAvailable()
          ? safeStorage.decryptString(Buffer.from(encryptedAccessToken, 'latin1'))
          : undefined;
      const refreshToken =
        encryptedRefreshToken && safeStorage.isEncryptionAvailable()
          ? safeStorage.decryptString(Buffer.from(encryptedRefreshToken, 'latin1'))
          : undefined;

      return { accessToken, refreshToken };
    } catch (error) {
      console.error('Failed to decrypt tokens:', error);
      // It's safer to clear corrupted tokens
      store.delete('accessToken');
      store.delete('refreshToken');
      return { accessToken: undefined, refreshToken: undefined };
    }
  });

  ipcMain.on('set-tokens', (event, tokens) => {
    if (safeStorage.isEncryptionAvailable()) {
      // We store the encrypted buffer as a latin1 string to avoid encoding issues.
      const encryptedAccessToken = safeStorage.encryptString(tokens.accessToken).toString('latin1');
      const encryptedRefreshToken = safeStorage.encryptString(tokens.refreshToken).toString('latin1');
      store.set('accessToken', encryptedAccessToken);
      store.set('refreshToken', encryptedRefreshToken);
    } else {
        // Fallback for systems where encryption is not available
        console.warn("safeStorage is not available. Storing tokens unencrypted.");
        store.set('accessToken', tokens.accessToken);
        store.set('refreshToken', tokens.refreshToken);
    }
  });

  ipcMain.on('clear-tokens', () => {
    try {
      store.delete('accessToken');
      store.delete('refreshToken');
      console.log('[Main] Tokens cleared on logout.');
    } catch (error) {
      console.error('Failed to clear tokens in main process:', error);
    }
  });

  ipcMain.on('set-refinement-state', (event, state) => {
    isRefinementOn = state;
    console.log(`[Main] AI Refinement state set to: ${isRefinementOn}`);
  });

  // Permission-related IPC handlers
  ipcMain.handle('check-permissions', async () => {
    return await checkPermissionsOnly();
  });

  ipcMain.handle('restart-app', () => {
    console.log('[Main] Restart requested by renderer. Restarting app...');
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 500);
  });

  // --- Global Key Listener Setup ---
  keyListener = new GlobalKeyboardListener();

  keyListener.addListener(async (e, down) => {
    const keyName = e.name;
    console.log(`[DEBUG] Key event: ${e.state} - ${keyName}`);

    if (e.state === "DOWN" && (keyName === TARGET_KEY_NAME_PRIMARY || keyName === TARGET_KEY_NAME_SECONDARY || keyName === TARGET_KEY_NAME_TERTIARY)) {
      if (!rightOptionPressed) {
        rightOptionPressed = true;
        console.log("[DEBUG] Right Option key DOWN detected, permissions check next.");

        // Check permissions when user first tries to use the app
        if (!permissionsChecked) {
          console.log('[Main] First time using app, checking permissions...');
          lastPermissions = await checkAndRequestPermissions(true);
          permissionsChecked = true;
        }

        // Permission checks
        const micAccess = systemPreferences.getMediaAccessStatus('microphone');
        const accessibilityAccess = systemPreferences.isTrustedAccessibilityClient(false);

        console.log(`[DEBUG] micAccess: ${micAccess}, accessibilityAccess: ${accessibilityAccess}`);

        if (micAccess !== 'granted' || !accessibilityAccess) {
          console.warn(`[DEBUG] Dictation blocked. Mic: ${micAccess}, Accessibility: ${accessibilityAccess}`);
          rightOptionPressed = false; // Reset state
          return;
        }

        console.log('[DEBUG] Permissions OK. Starting recording.');
        if (feedbackWindow) feedbackWindow.showInactive();
        const startSoundPath = isProd 
          ? path.join(process.resourcesPath, 'sfx', 'start-recording-bubble.mp3')
          : path.join(__dirname, 'sfx', 'start-recording-bubble.mp3');
        player.play(startSoundPath, (err) => {
          if (err) console.error('Error playing start sound:', err);
        });
        audioHandler.startRecording();
      }
    } else if (e.state === "UP" && (keyName === TARGET_KEY_NAME_PRIMARY || keyName === TARGET_KEY_NAME_SECONDARY || keyName === TARGET_KEY_NAME_TERTIARY)) {
      if (rightOptionPressed && audioHandler.isRecording) {
        rightOptionPressed = false;
        console.log('[DEBUG] Right Option key UP detected, stopping recording.');
        const stopSoundPath = isProd
          ? path.join(process.resourcesPath, 'sfx', 'stop-recording-bubble.mp3')
          : path.join(__dirname, 'sfx', 'stop-recording-bubble.mp3');
        player.play(stopSoundPath, (err) => {
          if (err) console.error('Error playing stop sound:', err);
        });
        audioHandler.stopRecordingAndProcess();
      } else {
        rightOptionPressed = false;
      }
    }
  });

  console.log('Global key listener added. Press Right Option key to test.');
  console.log('NOTE: You may need to grant Accessibility permissions to the application (or your terminal if running in dev mode).');

  // On app launch, only check permissions without prompting
  lastPermissions = await checkPermissionsOnly();
  console.log('[Main] Initial permissions state (no prompting):', lastPermissions);

  // Reset dialog flag on app start
  restartDialogShown = false;

  // Start permission monitoring
  startPermissionMonitor();

  // Create windows immediately
  createWindow();

  ipcMain.on('app-ready', () => {
    console.log('[Main] Received app-ready signal from renderer.');
    isWindowReadyForIPC = true;
    processMessageQueue(); // Process any queued messages
  });

  ipcMain.on('login-success', (event, { accessToken, refreshToken }) => {
    // ... existing code ...
  });

  ipcMain.on('open-external', (event, url) => {
    if (typeof url === 'string' && (url.startsWith('http:') || url.startsWith('https:'))) {
      shell.openExternal(url).catch(err => console.error('Failed to open external URL:', err));
    }
  });

  // Set the Dock icon on macOS
  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, 'resource', 'Voco.icns'));
  }

  // Only prompt for permissions on first focus/activation or first key press
  // browser-window-focus
  app.on('browser-window-focus', async () => {
    if (!permissionsChecked) {
      console.log('[Main] First window focus, prompting for permissions...');
      lastPermissions = await checkAndRequestPermissions(true);
      permissionsChecked = true;
    } else {
      await monitorPermissionChanges();
    }
  });
});

// This should be at the top level, not inside whenReady
app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  // On macOS, it's common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  // We might not want to stop the server here on macOS unless the app is quitting.
  if (process.platform !== 'darwin') {
    // stopServer(); // Server will be stopped in 'will-quit'
    app.quit();
  }
});

app.on('will-quit', () => {
  // Unregister all listeners.
  // iohook.removeAllListeners(); // iohook is removed
  // iohook.stop();
  keyListener.kill();
  // stopServer(); // DISABLED TO PREVENT PORT CONFLICT
  console.log('App quitting, key listener stopped.');
});

// All IPC listeners are now handled within their respective modules or are no longer needed.