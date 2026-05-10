# phase-g1.report.md — G1 Output Router 底座 P0–P1

## 验收

- [x] `POST /sessions/{id}/outputs` 支持 `clipboard`、`active_window_paste`；失败不丢 `final_text`（仅更新 `last_output_*` 元数据）  
- [x] `POST /sessions/{id}/output-feedback` 记录客户端执行结果  
- [x] Electron 主进程剪贴板 + 前台粘贴（Win：PowerShell SendKeys；macOS：AppleScript 模拟 Cmd+V；其他平台粘贴返回明确错误，剪贴板已写入）  
- [x] 渲染层通过 `preload` 桥接，不直接绕过 API 做文件类投递  
- [x] `pytest` 覆盖 outputs 与 feedback 行为（`tests/test_output_router.py`）  

**日期**：2026-05-10  
