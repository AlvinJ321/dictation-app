## Summary: `fn` Key Availability and Reliability

**Date:** 2024-05-31

**Sub-Task:** Investigate `fn` key availability and reliability for global binding across different systems/hardware.

**Sources:** Primarily based on findings from sub-task 1.1 (documented in `task/subtask-1.1-fn-key-research.md`).

**Conclusion:**

The `fn` key is **not suitable** for use as a reliable global hotkey for the proposed dictation feature due to the following reasons:

1.  **Inconsistent Reporting:** The `fn` key is not consistently reported to the operating system or applications as a standard modifier or regular key. Its events are often handled at a lower level (firmware/hardware drivers).
2.  **Cross-Platform Variability:**
    *   **macOS:** Behavior can be altered by system settings (standard function keys vs. special features). Detection might require specific macOS APIs (e.g., event taps) rather than cross-platform libraries.
    *   **Windows:** Behavior is highly dependent on the laptop manufacturer and their specific drivers. There's no universal standard for how the `fn` key press is signaled or if it's even made available to higher-level applications for global binding.
3.  **Library Support:** Most global hotkey libraries are designed to work with standard modifier keys (Ctrl, Shift, Alt, Cmd/Win) and are unlikely to reliably detect or interpret the `fn` key status (especially a press-and-hold state) in a cross-platform manner.
4.  **User Experience Issues:** Relying on the `fn` key would lead to an application that works on some systems but not others, or works inconsistently, providing a poor user experience.

**Recommendation:**
Proceed to identify an alternative, more reliable key or key combination for activating the dictation feature. 