# phase-g6.report.md — G6 模式化提示词通道

## 验收（对照 `specs/SVI-MASTER.spec.md` §G6）

- [x] **六种整理模式**：`clean_intent`、`thinking_clarify`、`obsidian_note`、`gaeh_goal`、`coding_task`、`faithful_transcript`（枚举 + UI 下拉，`GET /modes` 为单一来源）。  
- [x] **思考澄清**：独立模板 `prompts/modes/thinking_clarify.md`；Registry 中名称/描述体现「澄清思考」而非泛泛「高级润色」。  
- [x] **独立 prompt 文件**：各模式对应 `prompts/modes/*.md`；最低占位符 `{{combined_transcript}}`；可选 `{{session_title}}`、`{{mode_name}}`。  
- [x] **Mode Registry**：`prompts/modes/registry.json`；`GET /modes` 返回 `id` / `name` / `description`（不暴露模板路径）。  
- [x] **Rewrite 管线**：`TemplateRewriteAdapter` 经 PromptLoader 加载模板；adapter 不含业务模式分支；`finalize` / `refinalize` 使用会话当前 `mode`。  
- [x] **会话 `mode` 持久化**：`PATCH /sessions/{id}` 可更新 `mode`；切换模式后已有终稿时前端提示可重新整理（工作台已实现）。  
- [x] **遗留别名**：`intent_cleanup`→`clean_intent`，`task_requirement`→`gaeh_goal`；SQLite 启动迁移更新旧会话与预设。  
- [x] **错误语义**：未知 mode → `UNKNOWN_MODE`（HTTP 400）；缺模板 → `PROMPT_TEMPLATE_NOT_FOUND` / `PROMPT_RENDER_FAILED`（经改写路径抛出）。  
- [x] **自动化**：`pytest tests -q` 全绿（含别名映射与未知 mode 用例）。  

## 非目标（确认未做）

- 自动推断整理模式；多 agent 编排；取代 Output Router。

## 手工抽检建议（Owner）

- 配置真实 `DEEPSEEK_API_KEY`，任选两种模式对同一 `combined_transcript` 整理，确认输出结构差异明显。  
- 旧数据库升级：启动一次后端后预设与会话中旧 mode 已迁移为 canonical id。

**日期**：2026-05-11  
