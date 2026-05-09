# GAEH (Goal-Driven AI Engineering Harness)

这套模板用于把任意工程项目变成“可被 AI 按统一流程推进”的落地骨架：Owner 只负责目标/边界/验收与同意门禁；AI 负责工程拆解、实现、验证、报告与修复。

## Quick Start (Owner)
1) 填写/生成目标：
- 简单写：`project_control/goal.md`
- 或使用 GGS：编辑 `project_control/.ggs/idea.md`，再把 `project_control/.ggs/templates/runner.prompt.md` 粘贴给 Codex/Cursor 执行一次

2) 发起执行（先澄清，后同意门禁）：
把下面这句话发给 Codex/Cursor（或运行 `gaeh start` 复制输出）：
> 按 GAEH 流程开始：先检查 goal 是否清晰（尤其边界与 UI 交互），再给出最小问题清单；目标清晰后必须先征得我同意（等待我回复 APPROVE）再开始连续实现到验收完成，并把过程落盘到 plans/reviews/reports 与 project_control/*.md。

3) 同意执行：
- 对话中回复：`APPROVE`
- 或修改：`project_control/approval.json` / 使用 `gaeh approve`

## Governance
- Tiny Fix 允许不写 spec/plan，但必须：最小验证 + report + decision_log + task_queue 同步。
- 发现问题（已完成但不对）：把复现写到 `project_control/issues.md`，AI 先给“可能原因 + 证据收集计划”，定位根因后修复并回归验证。
- 新要求/变更：追加到 `project_control/change_requests.md`，必要时更新 `project_control/goal.md`，并再次征得同意后继续。

## MVP Local API (current implementation)
- Install deps: `pip install -r requirements.txt`
- Run API: `uvicorn local_api.main:app --reload`
- Open docs: `http://127.0.0.1:8000/docs`
- Run tests: `pytest -q`

Current scope:
- Session create/list/get
- Segment add/delete/retry transcribe
- Session finalize (`combined_transcript` + `final_text`)
- Prompt templates in `prompts/`

