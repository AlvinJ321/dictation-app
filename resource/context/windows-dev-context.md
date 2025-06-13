## context

This app already works on Mac.
The intention is to make it work for windows. I am doing the development on Parallels VM, but the app will target actual Windows machines.
when you make any changes, be very careful to keep the mac version working as before.

## App workflow
when user first launched the app, the app needs to access microphone and detecting keyboard events.
when the permissions are granted, user will login with phone number and OTP.
Once he is signed in, he can tab on any input field in any app,
press the right control key on Windows to start recording.
When he releases the right control key, the audio is sent to Aliyun for transcription
when the transcribed text is returned, it is inserted into the active input field.

