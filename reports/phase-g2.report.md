# phase-g2.report.md — G2 投递扩展 P2–P4

## 验收

- [x] `markdown_file`：配置 `SVI_MARKDOWN_OUTPUT_DIR` 后服务端落盘；路径锁在配置根内  
- [x] `obsidian_inbox`：配置 `OBSIDIAN_VAULT_ROOT` + `SVI_OBSIDIAN_INBOX_REL` 后写入 Vault 下 Inbox；`../` 被解析后不得越出 Vault 根  
- [x] `gaeh_goal_file`：配置 `SVI_GAEH_PROJECT_ROOT` 后写入项目下 `.gaeh/inbox`（可配 `SVI_GAEH_INBOX_REL`）  
- [x] 配置缺失时 API 返回 400 与明确文案，不破坏会话终稿  
- [x] 相关用例见 `tests/test_output_router.py`（pytest + monkeypatch 临时目录）  

**日期**：2026-05-10  
