const { app, BrowserWindow, ipcMain, safeStorage, screen } = require('electron');
// const iohook = require('iohook'); // Remove iohook
const { GlobalKeyboardListener } = require('node-global-key-listener');
const path = require('path');
const { fork } = require('child_process'); // Added for forking the server process
const robot = require('@hurdlegroup/robotjs'); // Added RobotJS
const { systemPreferences, dialog } = require('electron'); // Added systemPreferences and dialog
const { MainProcessAudio } = require('./src/main/audio');
const player = require('play-sound')(opts = {});

let mainWindow; // This will hold the main window reference
let feedbackWindow; // This will hold the feedback window reference
let isWindowReadyForIPC = false; // Flag to indicate if window can receive IPC
let serverProcess; // Variable to hold the server child process
let audioHandler;
let keyListener;
let rightOptionPressed = false; // Moved to top-level scope
let store; // Define store in the top-level scope

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

function createFeedbackWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  feedbackWindow = new BrowserWindow({
    width: 300, // Slightly wider for the message
    height: 40,  // Slimmer
    x: Math.round((width - 300) / 2),
    y: height - 60, // Positioned closer to the bottom
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    focusable: false,
    show: false, // Start hidden
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev = process.argv.includes('--dev');
  if (isDev) {
    feedbackWindow.loadURL('http://localhost:5173/feedback.html');
  } else {
    feedbackWindow.loadFile(path.join(__dirname, 'dist', 'feedback.html'));
  }

  feedbackWindow.on('closed', () => {
    feedbackWindow = null;
  });
}

function createWindow () {
  mainWindow = new BrowserWindow({
    title: 'Voco',
    width: 800,
    height: 600,
    // show: false, // Re-enable showing the window on start
    resizable: false,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // nodeIntegration: true, // May not be needed for node-global-key-listener in main
      // contextIsolation: false // May not be needed
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
  });

  // Initialize the audio handler once the window is created and pass the IPC function
  audioHandler = new MainProcessAudio(sendOrQueueIPC, store, player);
}

const TARGET_KEY_NAME_PRIMARY = 'RIGHT ALT'; // Corrected: This was the working value from logs
const TARGET_KEY_NAME_SECONDARY = 'RIGHT OPTION'; // Fallback
const TARGET_KEY_NAME_TERTIARY = 'ALTGR'; // Another possibility

console.log(`Attempting to listen for Right Option key (guessed as ${TARGET_KEY_NAME_PRIMARY}, ${TARGET_KEY_NAME_SECONDARY}, or ${TARGET_KEY_NAME_TERTIARY})`);

async function checkAndRequestPermissions() {
  // Microphone Access
  let micAccess = systemPreferences.getMediaAccessStatus('microphone');
  console.log('[Main] Initial Microphone Access Status:', micAccess);

  if (micAccess === 'not-determined') {
    const granted = await systemPreferences.askForMediaAccess('microphone');
    micAccess = granted ? 'granted' : 'denied';
    console.log('[Main] Microphone Access after asking:', micAccess);
  }

  // Removed the custom dialog. If micAccess is not 'granted' here,
  // it means the user denied it at the system prompt or it was already denied.
  // The application will proceed, and dictation will be blocked if mic is not available (logged by key listener).

  // Accessibility Access
  // On macOS, isTrustedAccessibilityClient(true) will prompt the user if access is not granted.
  // However, it's often better to guide the user to settings if it's not already granted.
  let accessibilityAccess = systemPreferences.isTrustedAccessibilityClient(false); // Check without prompting
  console.log('[Main] Initial Accessibility Access Status:', accessibilityAccess);

  if (!accessibilityAccess) {
    // Trigger the system prompt for accessibility access.
    // This will open System Settings if the user needs to grant permission.
    console.log('[Main] Accessibility not granted, attempting to trigger system prompt...');
    systemPreferences.isTrustedAccessibilityClient(true); // This prompts the user.
    // Re-check after the system prompt. The user might have granted it.
    accessibilityAccess = systemPreferences.isTrustedAccessibilityClient(false);
    console.log('[Main] Accessibility Access after system prompt attempt:', accessibilityAccess);

    // If still not granted after the system prompt, we could show a non-intrusive message
    // or rely on the fact that dictation will be blocked (logged in key listener).
    // For now, we'll rely on the key listener to block and log if still not granted.
  }
  
  console.log('[Main] Final Accessibility Access Status:', accessibilityAccess);
  return { mic: micAccess === 'granted', accessibility: accessibilityAccess };
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

  // Start the server process
  // startServer(); // DISABLED TO PREVENT PORT CONFLICT
  
  // --- Global Key Listener Setup ---
  keyListener = new GlobalKeyboardListener();

  keyListener.addListener(async (e, down) => {
    const keyName = e.name;

    // We check for the specific key names on key down.
    if (e.state === "DOWN" && (keyName === TARGET_KEY_NAME_PRIMARY || keyName === TARGET_KEY_NAME_SECONDARY || keyName === TARGET_KEY_NAME_TERTIARY)) {
      if (!rightOptionPressed) {
        rightOptionPressed = true;
        
        // Permission checks
        const micAccess = systemPreferences.getMediaAccessStatus('microphone');
        const accessibilityAccess = systemPreferences.isTrustedAccessibilityClient(false);

        if (micAccess !== 'granted' || !accessibilityAccess) {
          console.warn(`Dictation blocked. Mic: ${micAccess}, Accessibility: ${accessibilityAccess}`);
          rightOptionPressed = false; // Reset state
          return;
        }

        console.log('Permissions OK. Starting recording.');
        if (feedbackWindow) feedbackWindow.showInactive();
        player.play(path.join(__dirname, 'sfx/start-recording-bubble.mp3'), (err) => {
          if (err) console.error('Error playing start sound:', err);
        });
        audioHandler.startRecording();
      }
    } else if (e.state === "UP" && (keyName === TARGET_KEY_NAME_PRIMARY || keyName === TARGET_KEY_NAME_SECONDARY || keyName === TARGET_KEY_NAME_TERTIARY)) {
      if (rightOptionPressed && audioHandler.isRecording) {
        rightOptionPressed = false;
        
        console.log('Recording stopped by user. Processing...');
        if (feedbackWindow) feedbackWindow.hide();
        player.play(path.join(__dirname, 'sfx/stop-recording-bubble.mp3'), (err) => {
          if (err) console.error('Error playing stop sound:', err);
        });
        audioHandler.stopRecordingAndProcess();
      } else {
        // This handles the case where the key is released *after* the timer already stopped the recording.
        rightOptionPressed = false;
      }
    }
  });

  console.log('Global key listener added. Press Right Option key to test.');
  console.log('NOTE: You may need to grant Accessibility permissions to the application (or your terminal if running in dev mode).');

  await checkAndRequestPermissions();
  // Start the server process
  // startServer(); // DISABLED TO PREVENT PORT CONFLICT
  createWindow();
  createFeedbackWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  ipcMain.on('app-ready', () => {
    console.log('[Main] Received app-ready signal from renderer.');
    processMessageQueue();
  });
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