# Platform-Specific Configuration Analysis

**Date:** 2024-06-03

This document outlines the necessary configurations and platform-specific implementations required for the desktop dictation app to run on both macOS and Windows.

---

### 1. Global Dictation Hotkey

The core functionality of initiating dictation relies on a global hotkey. This key is different for each platform.

-   **macOS:** `Right Option` key.
    -   The `node-global-key-listener` library detects this key with the names `'RIGHT ALT'` or `'RIGHT OPTION'`.
-   **Windows:** `Right Control` key.
    -   The key listener library is expected to detect this as `'RIGHT CONTROL'`.

**Status:**
-   The current implementation in `main.js` is **macOS-only**. It is hardcoded to listen for the Mac-specific key names.
-   **Action Required:** The code must be updated to check the host operating system (`process.platform`) and listen for the appropriate key(s).

---

### 2. System Permissions

The application must request user permissions for microphone and accessibility access, which is handled differently by each OS.

-   **macOS:**
    -   **Implementation:** The `checkAndRequestPermissions` function in `main.js` uses Electron's `systemPreferences` API.
    -   **Status:** This is correctly implemented for macOS.
-   **Windows:**
    -   **Implementation:** Windows handles microphone permissions differently, and there is no direct equivalent to the macOS "Accessibility" permission for this app's purpose.
    -   **Status:** There is **no permission-handling logic** for Windows.
    -   **Action Required:** A Windows-specific workflow for checking microphone access needs to be implemented.

---

### 3. Application Lifecycle

The app's behavior regarding window management and icon interaction is platform-dependent.

-   **Window Closing:**
    -   **macOS:** The app correctly remains active when the window is closed, as is standard.
    -   **Windows:** The app correctly quits when the window is closed.
-   **App Activation:**
    -   **macOS:** Clicking the Dock icon correctly re-creates the window if none are open.
    -   **Windows:** Not applicable.

**Status:**
-   The current implementation correctly handles these standard lifecycle events for both platforms. No changes are needed.

---

### 4. System-Wide Text Insertion

The app programmatically types the transcribed text into the active application.

-   **Implementation:** The app uses the `@hurdlegroup/robotjs` library via the `robot.typeString()` function in `src/main/audio.js`.
-   **Status:** `robotjs` is a cross-platform library. The existing implementation is expected to work on both macOS and Windows without modification.

---

### 5. Active Input Field Detection

To save on API costs, the app should only transcribe if the user is in a valid text field.

-   **macOS:**
    -   **Plan:** The `task-list.md` suggests using AppleScript.
-   **Windows:**
    -   **Plan:** The `task-list.md` suggests using native Windows APIs (e.g., UI Automation).

**Status:**
-   This feature is **not implemented** on any platform. My analysis of the codebase found no implementation for checking the active input field.
-   **Action Required:** This feature needs to be built with separate, OS-specific logic for both macOS and Windows.

---

### Summary of Actions

1.  **Modify `main.js`** to select the correct hotkey based on the operating system.
2.  **Implement a permission flow** for Windows microphone access.
3.  **Implement the active input field detection** feature with separate logic for macOS and Windows. 