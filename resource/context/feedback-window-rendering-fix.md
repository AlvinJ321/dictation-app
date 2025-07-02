# Summary: Fixing the Persistent Feedback Window Artifact

## 1. The Problem

A persistent visual artifact—a faint white oval or bar—remained on screen after the audio wave animation disappeared. This occurred in a transparent Electron `BrowserWindow` used for user feedback (recording status, processing loader). The artifact would wrongfully stay visible during the `'processing'` and `'idle'` states, cluttering the user's screen.

## 2. Root Cause Analysis

Initial attempts to solve the issue by forcing React component re-renders (e.g., using a `key` prop) or by modifying CSS were unsuccessful. The root cause was identified as a **Window State Pollution** issue within Electron's Chromium renderer.

Because the same transparent `BrowserWindow` was being reused (shown and hidden) for multiple recordings, its rendering surface was not being completely cleared between state changes. Remnants of the previous component's animation (`AudioWave`) were being cached by the compositor, leading to the lingering visual artifact. This is a common, though difficult to debug, issue with transparent windows in Electron.

## 3. The Solution: On-Demand Window Lifecycle

The most robust solution was to abandon the window reuse strategy and instead adopt an on-demand lifecycle for the feedback window.

1.  **Destroy on Hide**: Instead of hiding the window when a recording session ended, the window is now completely destroyed (`window.close()`). This guarantees that no rendering state can persist.
2.  **Create on Show**: When a new recording session begins, a brand new `BrowserWindow` is created.

This approach ensures a clean rendering slate for every single recording, definitively eliminating the state pollution bug.

## 4. Implementation Challenges & Refinements

Implementing this lifecycle introduced several follow-up challenges that were subsequently resolved:

*   **Focus Stealing**: The new window initially stole keyboard focus. This was fixed by using `window.showInactive()` instead of `window.show()`.
*   **Race Condition**: The audio wave animation would not appear because the main process sent the `'recording-status'` IPC message before the window's internal React app was ready to listen for it. This was solved by implementing a handshake:
    *   The feedback window's renderer process now sends a `'feedback-window-ready'` message to the main process once its React component has mounted.
    *   The main process waits for this signal before showing the window and sending the initial status.

This series of fixes resolved the visual artifact while ensuring the feedback window appears correctly and without disrupting the user's workflow. 