# Reviewer Rules (AI-owned)

Reviewer returns: PASS / REVISE / BLOCK

## Spec Gate
Check:
- 问题清晰、边界明确
- Acceptance 可验证
- UI/交互需求未遗漏（如涉及 UI）

## Plan Gate
Check:
- 步骤可执行、落盘点明确
- 有最小验证方式
- 不越权、不扩 scope
- 在执行前明确需要 Owner `APPROVE`

## Diff Gate
Check:
- 变更与 goal 对齐
- 无多余改动
- 可回滚（或至少有恢复方案）

