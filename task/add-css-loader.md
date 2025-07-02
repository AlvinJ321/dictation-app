
## Current
When recording is in progress, an audio wave will appear at the bottom of the screen. The transcription usually takes around one second, if longer text, it will take longer. User might be confused after dictation that the Transcribed text is not showing.

## Expected
when recording is complete, show subtle css loader presenting transcription is in progress
when the transcription results is returned the css loader disappears gracefully

## Context
there's a feedback window at the bottom of the screen. you can levearge that.
The loader should not appear on the main app page. because the state management there is not used. the "in progress" effect should appear in the feedback window, not the main app window.

## relevant files
src/feeback.tsx

