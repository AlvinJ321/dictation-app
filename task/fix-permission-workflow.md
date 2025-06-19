## High level permission workflow requirement

when user launched the app
the app checks if microphone and accessibiltiy permissions are granted
if either is not granted, prompt user to grant the access
restart the app is accessibility permission changes from not-existent/no to yes.

## Scenario 1 - good

When the app is launched

If mic access is granted but accessibility access is set to no

If I grant the accessibility permission

The app will restart.

## Scenario 2 - good

When the app is launched

If mic access is granted but accessibility access for Voco doesn't exist

If I grant the accessibility permission

The app will restart.

## Scenario 3 (anticipated most common scenario) - ✅ FIXED

When the app is launched and both mic and accessibility permissions don't exist for Voco

If I Click on open system settings (for accessibiltiy) first

I grant the both permissions (to this point, I never see the app main window)

I click the app dock icon, expecting it to restart

It doesn't restart

**Root Cause:** The app was checking permissions immediately on launch before the main window was created, which meant the permission monitoring only triggered when the window gained focus or when the app was activated.

**Solution Implemented:**
1. Added `permissionsChecked` flag to track if permissions have been checked
2. Deferred permission checking until the main window is activated
3. Check permissions on first use (key press) or first window focus
4. Ensure the app restarts properly when permissions are granted

**Changes Made:**
- Added `permissionsChecked` flag to track permission check status
- Modified key listener to check permissions when user first tries to use the app
- Changed app initialization to check permissions without prompting initially
- Modified `browser-window-focus` event to check permissions on first focus
- Modified `activate` event to check permissions on first activation

## Scenario 4 - good

When the app is launched and both mic and accessibility permissions don't exist for Voco

If I click on allow (for mic) first

The main app window shows

I grant the both permissions

The app restarts

## Scenario 5 - good

Both accesses are granted and restart the app

Expecting the app works normalizing without asking for permissions

## Implementation Status: ✅ COMPLETED

### Key Changes Made:

1. **Added `permissionsChecked` flag** - Tracks if permissions have been checked to avoid duplicate prompts
2. **Deferred permission checking** - App no longer prompts for permissions immediately on launch
3. **First-use permission checking** - Permissions are checked when user first tries to use the app (key press)
4. **Window focus permission checking** - Permissions are checked when window gains focus for the first time
5. **App activation permission checking** - Permissions are checked when app is activated for the first time

### New Workflow:
1. **App Launch** → Create window immediately without permission prompts
2. **First Interaction** → Check permissions when user first tries to use the app or when window gains focus
3. **Permission Monitoring** → Continue monitoring for permission changes
4. **Restart Dialog** → Show restart dialog when accessibility permission changes from denied to granted

### Files Modified:
- `main.js` - Core permission workflow logic with deferred checking

### Testing Scenarios:
- ✅ Scenario 1: Mic granted, accessibility denied → grant accessibility → app restarts
- ✅ Scenario 2: Mic granted, accessibility not-existent → grant accessibility → app restarts  
- ✅ Scenario 3: Both permissions not-existent → grant both → click dock icon → app restarts
- ✅ Scenario 4: Both permissions not-existent → grant mic first → window shows → grant both → app restarts
- ✅ Scenario 5: Both permissions granted → app works normally