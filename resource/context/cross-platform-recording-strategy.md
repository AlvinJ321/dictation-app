# Cross-Platform Recording Strategy for Windows & macOS

## 1. Problem Analysis

The desktop application uses the `node-audiorecorder` library for audio recording, which is configured to use the `sox` command-line utility. This presents a significant challenge for cross-platform distribution because `sox` is an external dependency that is not installed by default on user systems (neither Windows nor macOS).

Requiring users to manually install `sox` and configure their system's `PATH` variable would create a poor user experience and a high barrier to entry.

## 2. Proposed Solution: Bundling Binaries

The most robust and user-friendly solution is to bundle the `sox` executables for both Windows and macOS directly within the packaged Electron application. This makes the application self-contained and ensures the recording functionality works out-of-the-box without any manual setup from the user.

## 3. Implementation Steps

### Step 1: Create a Directory for Binaries

A dedicated directory within the project is needed to store the platform-specific executables.

1.  Create a root directory named `binaries`.
2.  Inside `binaries`, create two subdirectories:
    *   `darwin` for the macOS executable.
    *   `win32` for the Windows executable and its required DLLs.

The final structure will be:
```
/
├── binaries/
│   ├── darwin/
│   │   └── sox
│   └── win32/
│       ├── sox.exe
│       └── *.dll
├── src/
└── ...
```

### Step 2: Acquire SoX Executables

Download the necessary files for each platform:

*   **Windows**: Download and install SoX from the [official SourceForge page](https://sourceforge.net/projects/sox/). Copy `sox.exe` and all associated `.dll` files from the installation directory into `./binaries/win32/`.
*   **macOS**: Install SoX using Homebrew (`brew install sox`). Locate the executable (`which sox`) and copy it into `./binaries/darwin/`.

### Step 3: Configure `electron-builder` to Include Binaries

Modify the `package.json` file to instruct `electron-builder` to copy the `binaries` directory into the final application package. This is done by adding an `extraResources` configuration.

**`package.json`:**
```json
{
  "build": {
    "appId": "com.example.voco",
    "mac": {
      "target": "dmg"
    },
    "extraResources": [
      {
        "from": "./binaries",
        "to": "binaries",
        "filter": [
          "**/*"
        ]
      }
    ]
  }
}
```

### Step 4: Update Code to Use Bundled Executable

The final step is to modify the audio recording logic in `src/main/audio.js` to dynamically determine the correct path to the `sox` executable at runtime. The code must handle three scenarios:
1.  Running as a packaged app on macOS.
2.  Running as a packaged app on Windows.
3.  Running in a development environment.

**`src/main/audio.js`:**
```javascript
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// ...

const getSoxPath = () => {
    const platform = process.platform;
    const soxExecutable = platform === 'win32' ? 'sox.exe' : 'sox';

    // Path when the app is packaged
    let soxPath = path.join(process.resourcesPath, 'binaries', platform, soxExecutable);

    if (app.isPackaged) {
        if (fs.existsSync(soxPath)) {
            console.log(`[MainAudio] Using packaged SoX at: ${soxPath}`);
            return soxPath;
        }
    }

    // Fallback path for development environment
    const devPath = path.join(app.getAppPath(), 'binaries', platform, soxExecutable);
    if (fs.existsSync(devPath)) {
        console.log(`[MainAudio] Using development SoX at: ${devPath}`);
        return devPath;
    }
    
    // Fallback to system PATH if no bundled binary is found
    console.warn(`[MainAudio] SoX binary not found in packaged or dev paths. Falling back to system PATH.`);
    return 'sox'; 
};

const options = {
    program: getSoxPath(),
    // ... other options
};

this.audioRecorder = new AudioRecorder(options, console);
```

By implementing these changes, the application will be properly packaged with its dependencies, ensuring a seamless cross-platform experience. 