## brainstormed logic
When app is launched 
Check both permissions 
If both permissions are granted 
Use the app as normal

If either permission is missing 
Prompt user to grant permission 

If accessibility permission changes from no/not exist to yes,
Prompt the user to restart the app


## Refined summary
App Launch → Check Permissions → 
├─ Both Granted → Normal App Flow
└─ Either Missing → System Prompts → 
   └─ When Accessibility Changes (non-existent/no → yes) → Custom Restart Dialog → Restart App

## Implementation Status: ✅ COMPLETED

### Key Changes Made:

1. **Added `checkPermissionsOnly()` function** - Checks permissions without prompting
2. **Added `showRestartDialog()` function** - Shows custom dialog when accessibility permission is granted
3. **Added `monitorPermissionChanges()` function** - Monitors for accessibility permission changes from denied to granted
4. **Updated app initialization** - Added permission monitoring on `browser-window-focus` and `activate` events
5. **Added IPC handlers** - `check-permissions` and `restart-app` for renderer process access
6. **Updated preload.js** - Added permission management APIs
7. **Removed duplicate event handlers** - Cleaned up old auto-restart logic

### Workflow Implementation:
- ✅ App launches and checks permissions
- ✅ If permissions missing, system prompts appear automatically
- ✅ Permission changes are monitored continuously
- ✅ When accessibility permission changes from denied to granted, custom restart dialog appears
- ✅ User can choose to restart immediately or later
- ✅ Cross-platform support (macOS and Windows)

### Files Modified:
- `main.js` - Core permission workflow logic
- `preload.js` - Added permission APIs for renderer

---

## 总结方案（Summarized Solution）

1. **定时器轮询权限**：应用启动后，每2秒轮询一次麦克风和辅助功能权限状态。
2. **权限变更检测**：如果辅助功能权限从未授权/拒绝变为已授权，触发自定义重启对话框。
3. **对话框显示逻辑**：
   - 对话框弹出前确保主窗口已显示并聚焦，无论窗口是否隐藏或关闭。
   - 对话框内容为中文，按钮为"立即重启"和"稍后"。
4. **防止重复弹窗**：使用标志位，确保每次权限变更只弹出一次对话框。
5. **多事件检测**：除定时器外，窗口聚焦和 Dock 图标点击也会触发权限检测，确保各种场景下都能及时响应。
6. **重启后状态重置**：应用重启后，标志位重置，流程可再次正常工作。
7. **无测试代码**：所有测试相关代码已清理，生产环境代码简洁。

**核心文件变更**：
- `main.js`：核心权限检测与对话框逻辑
- `preload.js`、`src/types/electron.d.ts`：仅保留生产相关 API

**用户体验**：
- 用户授权辅助功能权限后，无论窗口是否可见，都会弹出中文自定义对话框提示重启。
- "立即重启"按钮可一键重启应用，权限立即生效。