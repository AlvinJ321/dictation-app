const { app, BrowserWindow, ipcMain } = require('electron');
// const iohook = require('iohook'); // Remove iohook
const { GlobalKeyboardListener } = require('node-global-key-listener');
const path = require('path');
const { fork } = require('child_process'); // Added for forking the server process
const robot = require('@hurdlegroup/robotjs'); // Added RobotJS
const { systemPreferences, dialog } = require('electron'); // Added systemPreferences and dialog

let mainWindow; // This will hold the main window reference
let isWindowReadyForIPC = false; // Flag to indicate if window can receive IPC
let serverProcess; // Variable to hold the server child process

// --- Message Queue ---
// A queue to hold messages when the renderer is not ready
const messageQueue = [];

function sendOrQueueIPC(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed() && isWindowReadyForIPC) {
    try {
      mainWindow.webContents.send(channel, ...args);
      console.log(`[Main] IPC message sent on channel '${channel}'`);
    } catch (error) {
      console.error(`[Main] Error sending IPC message on channel '${channel}':`, error);
      console.log(`[Main] Queuing message for channel '${channel}' due to error.`);
      messageQueue.push({ channel, args });
    }
  } else {
    console.log(`[Main] Window not ready. Queuing message for channel '${channel}'.`);
    messageQueue.push({ channel, args });
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
  const serverPath = path.join(__dirname, 'server', 'server.ts');
  
  // We need to find the path to ts-node executable
  // A common way is to use require.resolve('ts-node/dist/bin.js') but that might not always be robust
  // or rely on it being in PATH for npx.
  // For simplicity in development, let's try to use `npx ts-node` which assumes npx is available.
  // A more robust solution for packaging would be to compile the server and run the JS file.
  
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

function createWindow () {
  mainWindow = new BrowserWindow({
    title: 'Voco',
    width: 800,
    height: 600,
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
    // mainWindow.webContents.openDevTools();
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
}

// --- node-global-key-listener Setup ---
const keyListener = new GlobalKeyboardListener();

// Variable to track if the target key is pressed
let rightOptionPressed = false;

// Key names can vary; common ones for Option keys are 'RIGHT ALT', 'ALTGR', 'RIGHT OPTION'
// We'll log all key events initially to discover the correct name if needed.
const TARGET_KEY_NAME_PRIMARY = 'RIGHT ALT'; // Primary guess for Right Option
const TARGET_KEY_NAME_SECONDARY = 'RIGHT OPTION'; // Secondary guess
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

keyListener.addListener(async (e, down) => { // Made async to await permission checks
  // Log all key events to help identify the correct key name and structure
  // console.log(\`Key event: name=${e.name}, state=${e.state}, rawKey=${JSON.stringify(e.rawKey)}, down=${JSON.stringify(down)}\`);

  const isTargetKey = e.name === TARGET_KEY_NAME_PRIMARY || e.name === TARGET_KEY_NAME_SECONDARY || e.name === TARGET_KEY_NAME_TERTIARY;

  if (isTargetKey) {
    if (e.state === "DOWN") {
      if (!rightOptionPressed) {
        rightOptionPressed = true;
        console.log('Right Option key pressed (Name: ' + e.name + ')');

        let micPermissionGranted = false;
        let accessibilityPermissionGranted = false;

        // 1. Check and prompt for Microphone Access
        let micStatus = systemPreferences.getMediaAccessStatus('microphone');
        if (micStatus === 'granted') {
          micPermissionGranted = true;
        } else if (micStatus === 'not-determined') {
          console.log('[Main] Microphone access not determined on key press. Prompting...');
          const grantedAfterPrompt = await systemPreferences.askForMediaAccess('microphone');
          micPermissionGranted = grantedAfterPrompt;
          console.log('[Main] Microphone access after key press prompt:', grantedAfterPrompt ? 'granted' : 'denied');
        } else { // 'denied', 'restricted', etc.
          console.log('[Main] Microphone access was previously ' + micStatus + ' on key press. Informing user to go to settings.');
          if (mainWindow) {
            const { response } = await dialog.showMessageBox(mainWindow, {
              type: 'warning',
              title: 'Microphone Access Required',
              message: `Microphone access is currently ${micStatus}. Please grant access in System Settings > Privacy & Security > Microphone.`,
              buttons: ['Open System Settings', 'Cancel'],
              defaultId: 0,
              cancelId: 1
            });
            if (response === 0) {
              require('electron').shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
            }
          }
          micPermissionGranted = false; // Remains false as user needs to act manually
        }

        // 2. Check and prompt for Accessibility Access
        let accStatus = systemPreferences.isTrustedAccessibilityClient(false);
        if (accStatus) {
          accessibilityPermissionGranted = true;
        } else {
          console.log('[Main] Accessibility access not granted on key press. Attempting to prompt...');
          systemPreferences.isTrustedAccessibilityClient(true); // This call prompts or opens settings
          // Re-check after the call. This might not reflect immediate changes if settings opened.
          accessibilityPermissionGranted = systemPreferences.isTrustedAccessibilityClient(false);
          console.log('[Main] Accessibility access after key press prompt attempt:', accessibilityPermissionGranted);
          
          if (!accessibilityPermissionGranted && mainWindow) {
            console.log('[Main] Accessibility access still not granted after key press prompt. Informing user.');
            const { response } = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Accessibility Access Required',
                message: 'This application needs Accessibility access. Please enable it in System Settings > Privacy & Security > Accessibility.',
                buttons: ['Open System Settings', 'Cancel'],
                defaultId: 0,
                cancelId: 1
            });
            if (response === 0) {
                require('electron').shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
            }
          }
        }

        // 3. Final check before proceeding
        if (!micPermissionGranted || !accessibilityPermissionGranted) {
          console.warn('[Main] Dictation blocked. Final Permissions - Microphone: ' + micPermissionGranted + ' (' + micStatus + '), Accessibility: ' + accessibilityPermissionGranted);
          rightOptionPressed = false; // Reset to allow re-evaluation on next press
          return; // Stop further action
        }

        // If all permissions are granted, proceed with sending start-recording
        sendOrQueueIPC('start-recording');
      }
    } else if (e.state === "UP") {
      if (rightOptionPressed) {
        rightOptionPressed = false;
        console.log('Right Option key released (Name: ' + e.name + ')');
        sendOrQueueIPC('stop-recording');
      }
    }
  }
});

console.log('Global key listener added. Press Right Option key to test.');
console.log('NOTE: You may need to grant Accessibility permissions to the application (or your terminal if running in dev mode).');


// --- Electron App Lifecycle ---
app.whenReady().then(async () => { // Made async to await permission checks
  // It's good practice to check/request permissions after the app is ready
  // and ideally before the window that might need them is fully visible or interactive.
  // However, creating the window first allows dialogs to be parented to it.
  createWindow(); 
  await checkAndRequestPermissions(); // Check permissions after window is created
  startServer(); // Start the server when the app is ready

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      // If server isn't running and we are re-creating window, might want to start server too
      if (!serverProcess) startServer(); 
      createWindow();
    }
  });
});

app.on('window-all-closed', function () {
  // On macOS, it's common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  // We might not want to stop the server here on macOS unless the app is quitting.
  if (process.platform !== 'darwin') {
    // stopServer(); // Server will be stopped in 'will-quit'
    app.quit();
  }
});

app.on('will-quit', () => {
  stopServer(); // Ensure server is stopped when app is quitting
  // keyListener.kill(); (still commented out)
  console.log('App quitting. Key listener might still be active if its server runs independently.');
});

// Handle 'app-ready' from renderer process
ipcMain.on('app-ready', (event) => {
  console.log('[Main] Received app-ready signal. Processing queue...');
  processMessageQueue();
});

// Handle text insertion from renderer process
ipcMain.on('insert-text', (event, text) => {
  if (typeof text === 'string' && text.length > 0) {
    console.log(`[Main] Received text to insert: "${text}"`);
    if (isWindowReadyForIPC && mainWindow && systemPreferences.isTrustedAccessibilityClient(false)) {
      try {
        robot.typeString(text);
        console.log('[Main] Text inserted successfully.');
      } catch (error) {
        console.error('[Main] Error inserting text with RobotJS:', error);
      }
    } else {
      console.warn('[Main] Cannot insert text: window not ready, or accessibility not granted.');
    }
  } else {
    console.warn('[Main] Received invalid or empty text for insertion.', text);
  }
});

// Handle transcription failure from renderer process
ipcMain.on('transcription-failed', (event, errorDetails) => {
  // ... existing code ...
});

// Removed iohook specific start/stop and registration logic

/* // Old hotcakey code
app.whenReady().then(async () => {
  createWindow();

  try {
    console.log('Activating hotcakey...');
    await hotcakey.activate();
    console.log('hotcakey activated.');

    const hotkey = ['F13']; // Changed to F13
    console.log(`Registering hotkey: ${hotkey.join('+')}`);

    hotcakey.register(hotkey, (event) => {
      console.log('Raw hotkey event:', JSON.stringify(event, null, 2));
      const keySequenceString = event.keySequence ? event.keySequence.join(', ') : 'N/A';
      console.log(`Hotkey event: ${event.type} for key(s) ${keySequenceString} at ${event.time}`);
      
      if (event.type === 'keydown') {
        console.log('F13 key pressed'); // Updated log message
        // Start recording audio (placeholder)
      } else if (event.type === 'keyup') {
        console.log('F13 key released'); // Updated log message
        // Stop recording audio (placeholder)
      }
    });
    console.log('Hotkey registered.');

  } catch (error) {
    console.error('Failed to activate or register hotkey with hotcakey:', error);
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // hotcakey.deactivate(); // Consider deactivating if appropriate
    app.quit();
  }
});

app.on('will-quit', async () => {
  try {
    console.log('Deactivating hotcakey...');
    await hotcakey.deactivate();
    console.log('hotcakey deactivated.');
  } catch (error) {
    console.error('Error deactivating hotcakey:', error);
  }
});
*/ 