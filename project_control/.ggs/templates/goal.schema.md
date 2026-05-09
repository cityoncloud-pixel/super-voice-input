# GGS Goal Schema (v1.0)

GGS 的输出目标是生成 `project_control/goal.md`（以及可选的 `project_control/goal.next.md`），供 GAEH 直接消费。

## Hard Gates (必须满足，否则不得 PASS)

1. `Target Outcome` 明确交付物（代码/功能/可运行程序/文档等）。
2. `Success Criteria` 至少 3 条，且至少 1 条是可验证的：
   - 命令验证（建议）：例如 `npm test` / `pytest` / `dotnet test`
   - 或可观察行为：例如“启动后页面出现 X”
3. `Scope` 必须包含 In/Out，明确不做什么。
4. `Constraints` 至少给出 tech/platform 的默认假设（如果未知，写入 assumptions.md）。
5. `Inputs` 说明是从零开始还是基于现有仓库；如未知，写 assumptions。
6. `Output Format` 列出至少 1 个具体产物（文件/模块/接口）。
7. `Risks` 列出至少 1 条不确定/决策点（没有也写“无明显风险”并说明）。

## Tone / Policy

- 目标应可执行、可验证、可审计。
- 当用户回答不了或信息缺失，允许 LLM 做“最优可执行假设”，但必须写入 `assumptions.md`，并在 `Risks/Constraints` 明示。

