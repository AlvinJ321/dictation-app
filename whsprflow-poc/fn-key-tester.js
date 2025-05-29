// fn-key-tester.js
const { uIOhook, UiohookKey } = require('uiohook-napi');

console.log("Attempting to start uiohook-napi...");

// It's good practice to set an error handler for uIOhook itself if available,
// though the documentation doesn't explicitly show one.
// We'll rely on try/catch for start and careful logging.

uIOhook.on('keydown', event => {
  console.log('>>> Keydown Handler Entered <<<'); // Check if handler is even called
  try {
    console.log('Keydown Event:', {
      keycode: event.keycode,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey
    });

    if (event.keycode === UiohookKey.Escape) {
      console.log('Escape key pressed, initiating shutdown...');
      stopHookAndExit();
    }
  } catch (e) {
    console.error('Error in keydown handler:', e);
  }
});

uIOhook.on('keyup', event => {
  console.log('>>> Keyup Handler Entered <<<'); // Check if handler is even called
  try {
    console.log('Keyup Event  :', {
      keycode: event.keycode,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey
    });
  } catch (e) {
    console.error('Error in keyup handler:', e);
  }
});

let stopping = false;
function stopHookAndExit(exitCode = 0) {
  if (stopping) {
    console.log('Already in the process of stopping.');
    return;
  }
  stopping = true;
  console.log('Attempting to stop uIOhook...');
  try {
    uIOhook.stop(); // This might be the call that hangs
    console.log('uIOhook stopped successfully.');
  } catch (e) {
    console.error('Error during uIOhook.stop():', e);
  } finally {
    console.log(`Exiting process with code ${exitCode}.`);
    process.exit(exitCode); // Force exit
  }
}

try {
  uIOhook.start();
  console.log("uIOhook-napi started successfully. Press keys (try 'fn' key).");
  console.log("Press Esc to quit, or Ctrl+C if Esc doesn't work.");
} catch (error) {
  console.error("Fatal error starting uIOhook-napi:", error);
  console.error("Please ensure system dependencies and permissions are correct.");
  console.error("(On macOS, check System Settings > Privacy & Security > Accessibility)");
  process.exit(1);
}

process.on('SIGINT', () => {
  console.log('SIGINT received (Ctrl+C).');
  stopHookAndExit(0);
});

// Keep the process alive. If uIOhook is working, it should manage the event loop.
// If it's not, the process might exit prematurely or behave erratically.
// Adding a long timeout just to see if it helps keep it alive for testing,
// but ideally uIOhook itself handles this.
const keepAliveInterval = setInterval(() => {
    // This is just to keep the Node.js event loop occupied
    // if uiohook isn't doing it properly.
}, 1000 * 60 * 5); // Keep alive for 5 minutes for testing

// Clean up interval on exit (though process.exit() might bypass this)
process.on('exit', () => {
    clearInterval(keepAliveInterval);
});