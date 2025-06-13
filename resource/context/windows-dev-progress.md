# Windows Compatibility Debugging Summary

**Date:** 2024-06-04

This document summarizes the debugging session focused on making the macOS dictation application compatible with a Windows environment running inside a Parallels Virtual Machine.

---

### 1. Initial State

The application was functional on macOS but failed to run correctly on Windows. The primary issues were related to system permissions, platform-specific API calls, and audio recording.

### 2. Problems Encountered and Solutions

#### a. Missing Microphone Permissions

-   **Problem:** The application had no mechanism to request microphone access on Windows, which is a requirement for recording audio.
-   **Solution:** We implemented a platform check in `main.js` to call Electron's `systemPreferences.askForMediaAccess('microphone')` API when running on `win32`.

#### b. macOS-Specific API Crash

-   **Problem:** A fatal `TypeError` occurred on Windows because the code was calling `systemPreferences.isTrustedAccessibilityClient()`, a function that only exists on macOS.
-   **Solution:** We wrapped the call to this function within a condition (`if (process.platform === 'darwin')`) to ensure it is only executed on a Mac.

#### c. Incorrect Hotkey Detection

-   **Problem:** The global hotkey listener was hardcoded for the macOS `Right Option` key. This needed to be changed to `Right Control` for Windows.
-   **Solution:** We made the hotkey listener platform-aware. Further debugging revealed that the Parallels VM mapped the Mac `Right Option` key to `Right Alt` on Windows, so we configured the listener to accept *either* `Right Control` or `Right Alt` on Windows for full compatibility.

#### d. Empty Audio Recordings

-   **Problem:** This was the most complex issue. After fixing the hotkeys, triggering a recording would produce a valid but empty (0-byte) WAV file. This caused the downstream transcription API to fail with a `500` error.
-   **Investigation:**
    1.  Our initial hypothesis was a "race condition" where the file was being read before the recording stream had finished writing. We implemented a `Promise` to wait for the stream's `finish` event, which was a good stability improvement but did not solve the core problem.
    2.  We then noticed SoX (the audio recording program) was exiting with an error code (`1` or `null`), indicating a failure during the recording process itself.
    3.  We experimented with different SoX configurations (`program: 'rec'`, `device: '-t waveaudio default'`) based on online documentation, but these were incorrect for the Parallels environment and caused new crashes.

**Important Finding:** A standalone test script (`test-sox-record.js`) using the same SoX binary and configuration can successfully record audio on Windows. This suggests the issue is specific to the Electron environment rather than a fundamental problem with SoX or the Windows audio system.

**Current Status: Investigating Electron-specific Issues.** The application is still unable to record audio successfully on the Windows VM, but we have confirmed that SoX itself works correctly in a Node.js environment. This narrows down the problem to potential Electron-specific issues such as:
1. Environment variable differences between Node.js and Electron
2. Process spawning behavior differences in Electron
3. Audio device access permissions in Electron context

#### e. Hotkey Behavior Change
- **Problem:** The original hotkey behavior (press and hold to record) was not reliable on Windows, especially with modifier keys.
- **Solution:** Changed the hotkey behavior to toggle recording on press and release of the target key. This change is not final and may be adjusted based on further testing and user feedback.

---

