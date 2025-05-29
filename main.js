const { app, BrowserWindow } = require('electron');
// const iohook = require('iohook'); // Remove iohook
const { GlobalKeyboardListener } = require('node-global-key-listener');
const path = require('path');

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // nodeIntegration: true, // May not be needed for node-global-key-listener in main
      // contextIsolation: false // May not be needed
    }
  });

  mainWindow.loadFile('index.html');

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
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
        // Start recording audio (placeholder)
      }
    } else if (e.state === "UP") {
      if (rightOptionPressed) {
        rightOptionPressed = false;
        console.log('Right Option key released (Name: ' + e.name + ')');
        // Stop recording audio (placeholder)
      }
    }
  }
});

console.log('Global key listener added. Press Right Option key to test.');
console.log('NOTE: You may need to grant Accessibility permissions to the application (or your terminal if running in dev mode).');


// --- Electron App Lifecycle ---
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// It's good practice to clean up the listener when the app quits,
// though node-global-key-listener might handle this with its out-of-process server.
app.on('will-quit', () => {
  // keyListener.kill(); // Method to stop the listener if available - documentation doesn't explicitly show this.
  // For now, we assume its out-of-process nature handles cleanup or it's not critical for POC.
  console.log('App quitting. Key listener might still be active if its server runs independently.');
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