# Analysis: Single Key Press-and-Hold for Dictation

**Date:** 2024-05-31 (Updated 2025-05-29)

**Context:** This document summarizes the discussion regarding the core requirement of a "press and hold one key" mechanism to start and stop audio recording for dictation. This version includes findings from Proof of Concept (POC) attempts using various libraries, culminating in a successful implementation with `node-global-key-listener`.

## Core Requirement: Press and Hold

The primary user interaction desired is:
1.  User **presses and holds** a specific key (e.g., `fn`, `Right Control`, `Right Option`).
2.  Audio recording **starts** immediately upon key down.
3.  User **releases** the key.
4.  Audio recording **stops** immediately upon key up.

This implies a need to distinctly detect both the `keydown` and `keyup` events for a single, globally monitored key.

## Electron's `globalShortcut` Module

*   **Functionality:** Electron's `globalShortcut.register(accelerator, callback)` is designed to trigger a callback when a registered `accelerator` (key combination) is pressed.
*   **Limitation for Hold/Release:** It primarily signals a single event when the shortcut is activated. It does not natively provide separate, easily distinguishable events for the `keydown` and `keyup` of a single, non-modifier key in a way that's straightforward to manage a "hold" state. For example, if you register "F1", the callback fires when F1 is pressed. Getting a distinct "F1 released" event to stop an action initiated by the press requires more complex state management or lower-level listeners.
*   **Use Case:** It's excellent for triggering actions on discrete key presses or combinations (e.g., `CmdOrCtrl+Shift+P`) but not ideal for a continuous "press and hold" action on a single key where the release is as critical as the press for defining the action's duration.

## `whspr-flow-fn-key-strategy.md` Insights

The document `whspr-flow-fn-key-strategy.md` accurately outlines the more robust, albeit complex, approach required for true "press and hold" detection of a single key, especially problematic ones like `fn`:

*   **Native, Low-Level Hooks:** It highlights the necessity of using OS-specific, lower-level APIs:
    *   **macOS:** Carbon `RegisterEventHotKey`, Quartz Event Taps (`CGEvent`), or even IOKit/IOHIDManager for keys like `fn` that might not generate standard key events. These can provide distinct key down and key up events.
    *   **Windows:** Win32 `RegisterHotKey` (primarily for `WM_HOTKEY` on key down) and potentially other hooks like `SetWindowsHookEx` with `WH_KEYBOARD_LL` to reliably capture `WM_KEYDOWN`, `WM_KEYUP`, `WM_SYSKEYDOWN`, `WM_SYSKEYUP`.
*   **Complexity:** This approach typically involves writing native addon modules (C++/Objective-C/Swift) to interface between Node.js/Electron and these OS-level APIs.

## Node.js Libraries for Global Key Listening

Several Node.js libraries aim to provide a cross-platform JavaScript abstraction over these native OS hooks, simplifying development. Our POC explored a few options:

*   **`hotcakey` (v0.8.0 on macOS):**
    *   **Initial Promise:** Seemed capable of providing distinct `keydown` and `keyup` events.
    *   **Key Limitation:** Failed to register standalone modifier keys on macOS (e.g., `AltRight` (Right Option), `AltLeft`, `ControlRight`, `ShiftLeft`). It produced a "cannot find a virtual key" error for these.
    *   **Successes:** It *did* work for non-modifier keys like `Space`, `Enter`, and extended function keys (e.g., `F13`).
    *   **Conclusion:** Unsuitable for the POC if a standalone modifier key (like Right Option) was required.

*   **`iohook` (v0.9.3, specifically the Droplr/iohook-v2 fork, on macOS with Electron 28):**
    *   **Initial Promise:** A powerful library often used for low-level input event handling.
    *   **Major Challenge:** Significant difficulties were encountered in getting `iohook` to build and run correctly with Electron 28 (ABI 120) on macOS. The primary issue stemmed from `iohook` v0.9.3 not officially supporting this Electron ABI in its own build scripts and `supportedTargets` list.
    *   **Build Process:** Manual intervention, including forcing rebuilds with `@electron/rebuild` and manually ensuring Electron binaries were correctly installed, was required. Even then, `iohook` failed to find its compiled `.node` file due to ABI mismatch (looking for `v119` instead of `v120`).
    *   **Conclusion:** The build complexities and outdated support for modern Electron versions made `iohook` too unreliable and time-consuming for this POC.

*   **`node-global-key-listener` (v0.3.0 on macOS with Electron 28):**
    *   **Architecture:** Uses a pre-compiled, out-of-process "key server" (`MacKeyServer` on macOS) to listen for global key events, communicating with the Node.js process via stdio. This avoids `node-gyp` compilation issues for the end-user.
    *   **Initial Setup:** Required a manual `chmod +x` on its `MacKeyServer` binary due to a permission error during its own setup attempt.
    *   **Permissions:** Requires Accessibility Access on macOS, which was granted during testing.
    *   **Success:** Once the executable permission was fixed, `node-global-key-listener` **successfully detected `keydown` and `keyup` events for the Right Option key**.
    *   **Key Identification:** The Right Option key was identified with `e.name === 'RIGHT ALT'`.
    *   **Conclusion:** This library proved to be a viable solution for the POC\'s core requirement of detecting press-and-hold for the Right Option key.

## Conclusion for Proof of Concept (POC)

*   For a simple "press and hold" of a *single specific key*, Electron\'s `globalShortcut` is insufficient because it doesn\'t inherently distinguish between the key down and key up events of the registered accelerator in a way that maps directly to starting and stopping an action.
*   **`node-global-key-listener` (v0.3.0) has been successfully demonstrated to capture `keydown` and `keyup` events for the Right Option key (identified as `'RIGHT ALT'`) on macOS with Electron 28.** This meets the primary technical goal of the POC.
*   While `node-global-key-listener` is an archived project and was last published some time ago, its approach of using pre-compiled binaries (for the key server) bypassed the complex `node-gyp` build issues encountered with `iohook`. A minor manual permission adjustment (`chmod`) was needed for its key server binary.
*   The experience with `hotcakey` and `iohook` highlights the challenges in reliable global key listening, especially with modifier keys as standalone triggers and with keeping native modules compatible with evolving Electron versions.
*   The success with `node-global-key-listener` provides a clear path forward for implementing the desired press-and-hold dictation trigger using the Right Option key.
*   **Next Steps:**
    *   Consider the implications of using an archived library (`node-global-key-listener`) for a production application (e.g., potential future compatibility issues, lack of updates).
    *   For the POC, proceed with `node-global-key-listener`.
    *   Clean up the POC code (e.g., remove unnecessary logging, refine key name constants).

This analysis will guide the selection of tools and techniques for implementing the global hotkey feature.