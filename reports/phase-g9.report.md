# phase-g9.report.md — G9 悬浮窗「遥控器」产品化

## 验收（对照 `specs/SVI-MASTER.spec.md` §G9）

- [x] **Electron 悬浮窗**：`autoHideMenuBar: true`；已有 `alwaysOnTop`；调高默认高度并设最小宽高。  
- [x] **菜单栏**：默认不常驻（`autoHideMenuBar`）。  
- [x] **场景 / 输出**：首行展示「场景：…　输出：…」（来自 `GET /use-cases` 与 `use_case_id`）。  
- [x] **整理主按钮**：随默认 `default_output_target` 显示「整理并复制 / 粘贴 / 保存 / Goal / 生成终稿」。  
- [x] **复制按钮**：「复制到剪贴板」；终稿后自动输出按场景（预览类仅提示，不自动路由）。  
- [x] **片段区**：默认摘要（≤72 字 + 字数/时长）+ `details` 查看全文。  
- [x] **状态**：`data-ov-ui-state`；录音中隐藏「整理/复制/主工作台」行。  
- [x] **主工作台**：`preload` + `svi-show-main` + 按钮。  
- [x] **快捷键**：底部一行。  
- [x] **主工作台剪贴板 Toast**：「已复制到剪贴板。」（去「路由」用语）。  

**日期**：2026-05-11  
