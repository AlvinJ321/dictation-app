## Summary: Hotkey Selection for Dictation

**Date:** 2024-05-31

**Sub-Task:** Identify a suitable alternative key if the `fn` key proves problematic. (Revised to select `fn` as default with configurability)

**Background:**
Initial research (sub-tasks 1.1 and 1.2) highlighted that the `fn` key is generally unreliable for consistent global hotkey functionality across macOS and Windows. This is due to its low-level OS/hardware handling, variability in behavior, and lack of standard reporting to applications, making it problematic as a universally fixed hotkey.

**Selected Default Hotkey:**

Despite the known reliability concerns, the **`fn` key** will be used as the **default** key for initiating press-and-hold dictation.

**Key Rationale & Mitigation Strategy:**

*   **User Request:** This aligns with the preference to attempt using the `fn` key as the default.
*   **User Configurability (Crucial Mitigation):** To address the inherent unreliability and potential conflicts of the `fn` key, the application **must provide users with an option to change the hotkey** to a different key or key combination of their choice. This is a critical feature to ensure usability for all users.

**Considerations for Implementation (Sub-task 1.4):**

*   **`fn` Key Detection Challenges:**
    *   Standard global hotkey libraries often do **not** reliably detect the `fn` key.
    *   Implementation will likely require using lower-level I/O hooking libraries (e.g., `iohook-napi`, `libuiohook`) or OS-specific event tapping/hooking mechanisms. This significantly increases implementation complexity.
    *   Even with such libraries, detection might not be 100% consistent across all hardware (especially various Windows laptops).
*   **Press-and-Hold Logic:** The chosen library must clearly provide `keydown` and `keyup` events for the `fn` key if it's detected.
*   **Fallback/Error Handling:** If the `fn` key cannot be registered or detected on a particular system, the application should ideally inform the user and guide them to configure an alternative hotkey.
*   **Configurability Implementation:** The mechanism for users to select and register a custom hotkey will be a separate development task (potentially under UI or settings features) but is essential for the viability of using `fn` as a default.

**Next Step (from Task List):**
Sub-task 1.4: `Implement the chosen solution for detecting key press and release events globally` (attempting `fn` key detection, and preparing for user configurability).