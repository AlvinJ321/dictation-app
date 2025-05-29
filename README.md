# Electron Hotkey POC

This is a Proof of Concept for using a global hotkey (Right Option on macOS) to simulate press-and-hold functionality in an Electron application, using the `hotcakey` library.

## Prerequisites

- Node.js and npm

## Setup

1. Clone this repository (or create the files as listed).
2. Navigate to the project directory in your terminal.
3. Install dependencies:
   ```bash
   npm install
   ```

## Running the POC

1. Start the Electron application:
   ```bash
   npm start
   ```
2. A small window should appear.
3. Press and hold the **Right Option** key on your macOS keyboard.
4. Observe the terminal output. You should see messages for `keydown` (when you press the key) and `keyup` (when you release the key).

## How it Works

- `main.js` is the main Electron process.
- It initializes `hotcakey` and registers `AltRight` as the global hotkey.
  - `AltRight` is the `event.code` for the Right Option key on macOS.
- When the hotkey is pressed or released, a message is logged to the console.

## Notes

- The `hotcakey` library requires Accessibility permissions on macOS. If the hotkey doesn't work, go to System Settings > Privacy & Security > Accessibility, and ensure your terminal application (or the compiled Electron app if you package it) has permission. You might need to add it and enable it.
- This POC focuses on macOS. The `hotcakey` library aims to be cross-platform, but key codes and behavior might vary on other operating systems (e.g. `ControlRight` might be a suitable default for Windows). 