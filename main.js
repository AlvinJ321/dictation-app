const { app, BrowserWindow, ipcMain } = require('electron');
// const iohook = require('iohook'); // Remove iohook
const { GlobalKeyboardListener } = require('node-global-key-listener');
const path = require('path');
const { fork } = require('child_process'); // Added for forking the server process
const robot = require('@hurdlegroup/robotjs'); // Added RobotJS

let mainWindow; // Declare mainWindow globally within this module
let isWindowReadyForIPC = false; // Flag to indicate if window can receive IPC
let serverProcess; // Variable to hold the server child process

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
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // nodeIntegration: true, // May not be needed for node-global-key-listener in main
      // contextIsolation: false // May not be needed
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('did-finish-load', () => {
    isWindowReadyForIPC = true;
    console.log('Window finished loading. Ready for IPC.');
  });

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  // Set flags when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
    isWindowReadyForIPC = false;
    console.log('Window closed. IPC disabled.');
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

keyListener.addListener((e, down) => {
  // Log all key events to help identify the correct key name and structure
  // console.log(\`Key event: name=${e.name}, state=${e.state}, rawKey=${JSON.stringify(e.rawKey)}, down=${JSON.stringify(down)}\`);

  const isTargetKey = e.name === TARGET_KEY_NAME_PRIMARY || e.name === TARGET_KEY_NAME_SECONDARY || e.name === TARGET_KEY_NAME_TERTIARY;

  if (isTargetKey) {
    if (e.state === "DOWN") {
      if (!rightOptionPressed) {
        rightOptionPressed = true;
        console.log('Right Option key pressed (Name: ' + e.name + ')');
        if (isWindowReadyForIPC && mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) { // Check our flag and webContents status
          mainWindow.webContents.send('start-recording');
        } else {
          console.log('Window not ready, not available, or webContents destroyed. Cannot send start-recording IPC.');
        }
      }
    } else if (e.state === "UP") {
      if (rightOptionPressed) {
        rightOptionPressed = false;
        console.log('Right Option key released (Name: ' + e.name + ')');
        if (isWindowReadyForIPC && mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) { // Check our flag and webContents status
          mainWindow.webContents.send('stop-recording');
        } else {
          console.log('Window not ready, not available, or webContents destroyed. Cannot send stop-recording IPC.');
        }
      }
    }
  }
});

console.log('Global key listener added. Press Right Option key to test.');
console.log('NOTE: You may need to grant Accessibility permissions to the application (or your terminal if running in dev mode).');


// --- Electron App Lifecycle ---
app.whenReady().then(() => {
  startServer(); // Start the server when the app is ready
  createWindow();

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

// Handle text insertion from renderer process
ipcMain.on('insert-text', (event, text) => {
  if (typeof text === 'string' && text.length > 0) {
    console.log(`[Main] Received text to insert: "${text}"`);
    try {
      robot.typeString(text);
      console.log('[Main] Text inserted successfully.');
    } catch (error) {
      console.error('[Main] Error inserting text with RobotJS:', error);
    }
  } else {
    console.warn('[Main] Received invalid or empty text for insertion.', text);
  }
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