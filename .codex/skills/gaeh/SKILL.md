# GAEH (Codex Adapter)

GAEH 是一套“目标驱动的工程协作协议 + 目录骨架 + 状态文件”，用于让 Codex 在任意项目中稳定推进：澄清目标 → 征得同意 → 持续实现 → 验证 → 汇报 → 迭代。

## Role Boundary
- Owner（你）定义：目标、范围边界、验收标准、UI/交互取舍、是否同意执行。
- AI（Codex）负责：任务拆解、spec/plan、实现、验证、审查、落盘与状态同步。
- AI 不得替 Owner 做产品取舍；遇到边界/交互不清必须先问清楚。

## Required State (File-driven)
以项目根目录为准：
- `project_control/goal.md`
- `project_control/phase_status.md`
- `project_control/task_queue.json`
- `project_control/decision_log.md`
- `project_control/approval.json`
- `project_control/change_requests.md`
- `project_control/issues.md`
- `ai_harness/harness_rules.md`
- `plans/` `reviews/` `reports/` `specs/`

## Consent Gate (Must)
在开始“连续执行直到完成目标”前，必须先获得 Owner 明确同意：
- Owner 在对话中回复 `APPROVE`（或 `APPROVE <task_id>`），或
- Owner 在 `project_control/approval.json` 中把 `start_execution` 对应项改为 `APPROVED`。

未同意前：只允许澄清、提出 spec/plan、列出风险与选项；禁止直接实现改动（除非 Owner 明确授权 Tiny Fix）。

## Workflow
1) 读取 `project_control/goal.md`，若存在 UNKNOWN/边界模糊，优先问清“边界与 UI/交互需求”，再问技术栈偏好。
2) 目标清晰后，提出可验证的计划与最小验证方式，等待 `APPROVE`。
3) 获得同意后，按路由（Tiny Fix / Normal / Architecture / Phase）持续工作到完成，并把每一步落盘到 `plans/` `reports/` `reviews/` 与 `decision_log.md`。
4) 阶段完成后，如果 Owner 在 `change_requests.md` 提出新要求：必要时更新 `goal.md`，再次征求 `APPROVE` 后继续。
5) 如果 Owner 反馈“已完成但有问题”：读取/更新 `issues.md`，先输出可能原因与证据收集，再定位根因并修复与回归验证。

## Start Command (Owner)
在 Codex 对话里直接发：
`按 GAEH 流程开始：先检查 goal 是否清晰（尤其边界与 UI 交互），再给出最小问题清单；目标清晰后必须先征得我同意（等待我回复 APPROVE）再开始连续实现到验收完成，并把过程落盘到 plans/reviews/reports 与 project_control/*.md。`

