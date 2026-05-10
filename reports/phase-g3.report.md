# phase-g3.report.md — G3 入口层：悬浮窗与快捷键

## 验收

- [x] 额外 `BrowserWindow` 加载 `desktop/renderer/overlay.html`，置顶悬浮入口（录音 / 停止本段 / 整理 / 路由剪贴板）  
- [x] 托盘菜单「显示悬浮窗」可唤起  
- [x] 全局快捷键：`Ctrl+Alt+Space` 切换悬浮窗内本段录音；`Ctrl+Alt+Enter` 触发整理（会话就绪时）  
- [x] README 已补充快捷键说明  

## 局限（SPEC 允许）

- 前台粘贴与快捷键依赖操作系统与其他应用焦点；失败时有 Toast / 文案降级  

**日期**：2026-05-10  
