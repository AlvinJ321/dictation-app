Here’s a high‑level breakdown of how Flow’s “hold Fn → dictate anywhere” feature works under the hood, on both macOS and Windows:

---

### 1. Global hotkey detection

* **macOS**
  Flow needs to know when you press (and release) the Fn key, even when another app is frontmost. On macOS, most apps use either the Carbon `RegisterEventHotKey` API or a lower‑level event tap (Quartz Event Services) to register global shortcuts. Under the covers, Flow uses a small native component that:

  1. Registers a global hotkey (by default `Fn`) via `RegisterEventHotKey` (Carbon) or a CGEvent tap ([cocoadev.github.io][1]).
  2. On Apple’s keyboards the Fn key itself is handled in hardware, so Flow may bundle a light driver (or leverage IOKit/IOHIDManager) similar to how Karabiner‑Elements detects Fn ([Ask Different][2]), then maps it to a virtual keycode that the OS can monitor.

* **Windows**
  On Windows Flow calls the Win32 `RegisterHotKey` function to grab a global hotkey for the desired key (Fn on some laptop keyboards appears as a multimedia key or is remapped by OEM drivers) ([Microsoft Learn][3]). When that key combination is pressed, the app’s message loop receives a `WM_HOTKEY` event.

---

### 2. Audio capture

Once Flow sees the hotkey-down event:

* **macOS (and cross‑platform)**
  It spins up an audio graph using Apple’s AVFoundation (`AVAudioEngine`) to tap the microphone in real time. A tap on the input node delivers raw PCM buffers to Flow’s audio‑capture pipeline ([Stack Overflow][4], [Medium][5]).

* **Windows**
  It uses the Windows Audio Session API (WASAPI) or DirectSound to open the default capture device and begin streaming audio buffers as the user speaks.

---

### 3. Real‑time transcription

Flow streams those audio buffers to its transcription backend:

1. **Chunking & streaming**
   Audio is broken into small frames (e.g. 0.5–1 sec) and sent over WebSockets or gRPC to Flow’s private cloud, where a Whisper‑style ASR model runs in low‑latency streaming mode ([platform.openai.com][6]).

2. **Whisper model**
   On the server side, OpenAI’s Whisper (or a custom fine‑tuned variant) receives each chunk, returns partial transcripts, and appends them as it goes—minimizing lag while you speak.

---

### 4. Text injection into the frontmost app

As soon as Flow’s client receives each transcription result:

* **macOS**
  It synthesizes synthetic keystrokes via `CGEventCreateKeyboardEvent` / `CGEventPost` to insert the recognized text at the current insertion point in whichever app you’re using.

* **Windows**
  It calls `SendInput` or posts `WM_CHAR`/`WM_KEYDOWN` messages into the foreground window to emulate typing of the transcribed text.

---

### Putting it all together

1. **Hotkey down** → detect via global hook
2. **Start audio** → open mic stream
3. **Stream to server** → real‑time Whisper transcription
4. **Inject text** → emulate keystrokes
5. **Hotkey up** → stop audio capture

This combination of a global hotkey listener, low‑latency audio capture, Whisper‑powered streaming transcription, and synthetic keystroke injection is what lets Flow let you “hold Fn and just talk” inside any text field.

[1]: https://cocoadev.github.io/RegisterEventHotKey/?utm_source=chatgpt.com "RegisterEventHotKey - CocoaDev"
[2]: https://apple.stackexchange.com/questions/295842/detect-fn-and-function-key-simultaneously-pressed?utm_source=chatgpt.com "Detect fn and function key simultaneously pressed - Ask Different"
[3]: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey?utm_source=chatgpt.com "RegisterHotKey function (winuser.h) - Win32 apps | Microsoft Learn"
[4]: https://stackoverflow.com/questions/27203622/tap-mic-input-using-avaudioengine-in-swift?utm_source=chatgpt.com "Tap Mic Input Using AVAudioEngine in Swift - Stack Overflow"
[5]: https://arvindhsukumar.medium.com/using-avaudioengine-to-record-compress-and-stream-audio-on-ios-48dfee09fde4?utm_source=chatgpt.com "Using AVAudioEngine to Record, Compress and Stream Audio on iOS"
[6]: https://platform.openai.com/docs/guides/realtime?utm_source=chatgpt.com "Realtime API - OpenAI Platform"
