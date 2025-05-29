## Research Summary: Global Hotkey Detection (fn Key)

**Date:** 2024-05-31

**Sub-Task:** Research libraries/approaches for global hotkey detection (macOS & Windows), especially for the `fn` key.

**Findings:**

*   **`fn` Key Challenges:**
    *   The `fn` key is often handled at a low OS/hardware level, not as a standard modifier.
    *   Reliable detection across all macOS and Windows systems is unlikely with standard hotkey libraries.
    *   Behavior varies significantly between Mac/Windows and different hardware manufacturers.
    *   Potential conflicts with accessibility features or other utilities.

*   **General Global Hotkey Approaches & Libraries:**
    *   **Node.js/Electron:**
        *   `hotcakey`: Cross-platform, uses physical keycodes. `fn` key not explicitly mentioned.
        *   `qHotkeys` (uses `uiohook-napi`): Aims for non-overriding global hotkeys. `fn` key not explicitly mentioned.
        *   `iohook` / `uiohook-napi`: Lower-level I/O hooking, might see raw `fn` key events (scancodes) but adds complexity and OS-specific handling.
        *   Electron's `globalShortcut`: Standard module, unlikely to support `fn` key directly.
    *   **Go-based:**
        *   `golang-design/hotkey`: Cross-platform, uses standard modifiers.
    *   **Native OS APIs:**
        *   **macOS:** `Carbon` APIs (`RegisterEventHotKey`) or `CGEventTapCreate` (event taps). Might capture `fn` with more complex native code.
        *   **Windows:** `RegisterHotKey` (standard modifiers) or lower-level keyboard hooks (`SetWindowsHookEx` with `WH_KEYBOARD_LL`).

**Conclusion for Sub-Task:**

*   Directly and reliably using only the `fn` key for press-and-hold dictation is **highly problematic and likely not consistently achievable** across platforms.
*   Most solutions are built for standard modifier keys (`Ctrl`, `Shift`, `Alt`, `Cmd`/`Win`).
*   Attempting `fn` key detection would likely require low-level I/O hooking, significantly increasing complexity and platform-specific work.

**Next Steps (from Task List):**

*   Investigate `fn` key availability and reliability further (though current research strongly suggests it's unreliable).
*   Identify a suitable alternative key. 