# decision_log.md

（AI 追加：关键决策与原因、路由变化、回滚原因、架构变更）

## 2026-05-09

- Decision: 接收 Owner 在对话中的 `APPROVE` 作为执行门禁通过依据。
  - Reason: `approval.json.policy.allow_chat_approval_token=true`，且 token 为 `APPROVE`。
  - Impact: 从目标分析阶段切换到 `mvp-0001` 连续实施阶段。

- Decision: 将当前主任务设为 `mvp-0001`，路由采用 Architecture/Phase 级（route C）。
  - Reason: 当前仓库尚无业务代码，需要先完成规格、计划、目录与骨架建立。
  - Impact: 先落盘 `specs/plans/reports`，再进入代码实现与验证闭环。

- Decision: 以 `idea.md` 作为 Owner 真实目标源，映射更新 `project_control/goal.md`。
  - Reason: 原 `goal.md` 仍是模板空壳，无法驱动可执行任务拆解。
  - Impact: 后续所有任务以更新后的 `goal.md` 作为最高优先级输入。

- Decision: MVP 第一轮先落地本地 API 骨架（FastAPI + SQLite + mock adapters）。
  - Reason: 当前仓库无业务代码，先建立可运行主流程骨架可降低后续 UI 与 provider 接入风险。
  - Impact: 已可通过 API 驱动会话/片段/整理流程，后续可平滑替换为真实 provider 与桌面端。

- Decision: 在本轮优先补“重录”接口与最小 API 集成测试，而不是先做桌面 UI。
  - Reason: 先稳住核心业务流可减少 UI 接入后的回归成本。
  - Impact: 当前主流程已具备可自动验证的回归基线（`pytest`）。

