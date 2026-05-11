# phase-g7.report.md — G7 本次场景一级入口

## 验收（对照 `specs/SVI-MASTER.spec.md` §G7）

- [x] **用途 Registry**：`prompts/use_cases/registry.json`；**`GET /use-cases`** 返回 `id` / `label` / `mode` / `default_output_target` / `description`。  
- [x] **建会话**：`POST /sessions` 支持 **`use_case_id`**（与 **`mode`** 二选一，优先 `use_case_id`）；自动写入 **`session.mode`** 与 **`use_case_id`**。  
- [x] **PATCH**：`use_case_id` 切换场景时同步 **mode**；仅 **PATCH `mode`**（高级）时 **清空** `use_case_id`；**refinalize** 改 mode 时清空 `use_case_id`。  
- [x] **主面板**：首屏仅 **「本次场景」** + 说明；**整理模式 / 引擎** 在 **高级设置** 折叠内。  
- [x] **默认投递**：场景选项 `data-defaultOutput` 驱动 `presetDefaultOutputTarget`；**`preview`** 场景下「按场景默认投递」提示预览为主、不强制 Router。  
- [x] **悬浮窗**：新建会话使用 **`use_case_id`**（默认记忆 `send_to_ai`）。  
- [x] **自动化**：`pytest tests -q` 全绿（含 `test_use_cases_api.py`）。  

**日期**：2026-05-11  
