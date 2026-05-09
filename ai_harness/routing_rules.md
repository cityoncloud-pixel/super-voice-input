# Routing Rules (AI-owned)

## Route A — Tiny Fix
Criteria:
- 单文件小改动 / 文案或样式小调整 / 明确可回滚的 bugfix

Flow:
- Goal → (Mini plan in report) → Execute → Verify → Report

Governance (still required):
- `reports/{task_id}.report.md`（含最小验证步骤与结果）
- `project_control/decision_log.md`（记录改动与原因）
- `project_control/task_queue.json`（登记 task；spec/plan/review 可为 null）

## Route B — Normal Task
Criteria:
- 常规功能开发 / UI + 状态 / 简单 API

Flow:
- Goal → Task Spec → Plan → (Owner APPROVE) → Execute → Verify → Report → Review

## Route C — Architecture Task
Criteria:
- schema/backend/storage/cross-module / 影响面较大

Flow:
- Goal → Full Spec → Review Gate → Plan → Review Gate → (Owner APPROVE) → Execute → Verify → Report

## Route D — Phase Task
Criteria:
- 多子系统/多依赖/需要分阶段交付

Flow:
- Goal → Phase Spec → Task Queue → (Owner APPROVE) → Iterative execution + verification + reporting

