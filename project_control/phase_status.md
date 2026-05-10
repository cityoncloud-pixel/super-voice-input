# phase_status.md（Owner-owned · 与 goal.md GOAL LIST 同步）

## 主文档

- 全量目标：`project_control/goal.md` §6 **GOAL LIST**  
- 规格：`specs/SVI-MASTER.spec.md`  
- 计划：`plans/SVI-MASTER.plan.md`  

## 当前阶段（执行指针）

| 字段 | 值 |
|------|-----|
| **Current Phase** | **G5 收尾**（GOAL LIST G0–G4 已实现；G5 以文档与开发者分发路径为主） |
| 说明 | 自动化：`pytest -q` 全绿。手工外网联调（豆包/DeepSeek）仍由 Owner 在本地环境验收。安装包（electron-builder）未作为本轮交付；见 `reports/phase-g5.report.md`。 |

## 阶段完成登记表（人工勾选）

| 阶段 | 状态 | 报告 |
|------|------|------|
| G0 | 自动化通过；手工外网联调待 Owner | `reports/phase-g0.report.md` |
| G1 | 已完成（代码+测试） | `reports/phase-g1.report.md` |
| G2 | 已完成（代码+测试） | `reports/phase-g2.report.md` |
| G3 | 已完成 | `reports/phase-g3.report.md` |
| G4 | 已完成 | `reports/phase-g4.report.md` |
| G5 | 文档路径完成；安装包未交付 | `reports/phase-g5.report.md` |

## Forbidden Work（全局守卫）

- 不做账号/云同步/移动端  
- 不做完整智能体与自动执行外部开发流程  
- 投递逻辑不得长期绕过 **OutputRouter**（G1 起强制）

## 旧版 Phase 3 说明

原「Phase 3 Provider Verification」已并入 **G0** 中 Provider 与真实链路透跑验收；不再单独维护旧编号。
