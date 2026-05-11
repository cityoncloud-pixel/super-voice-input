# phase-g8.report.md — G8 会话自动管理与双入口产品化

## 验收（对照 `specs/SVI-MASTER.spec.md` §G8）

- [x] **工作台**：未先点「新建会话」可直接「开始录音」；必要时自动 `POST /sessions`（默认标题 `{场景名} YYYY-MM-DD HH:mm`）。  
- [x] **已完成会话再录音**：当前会话 `status === done` 时，开始录音前自动新建会话并绑定当前用途。  
- [x] **悬浮窗**：无会话时可点录音 → `ensureOverlaySessionForRecording`；终稿后再录同上新建会话。  
- [x] **快捷键**：`toggleRecordShortcut` 不再拒绝无会话（交由录音按钮逻辑创建会话）。  
- [x] **切换场景**：本会话已有片段时 `confirm` 后再 `PATCH use_case_id`。  
- [x] **`GET /output-capabilities`**：返回各 `output_target` 是否可用及原因；工作台投递按钮 `disabled` + `title` 前置提示。  
- [x] **`pytest tests -q`**：26 passed（含 `test_output_capabilities.py`）。  

**日期**：2026-05-11  
