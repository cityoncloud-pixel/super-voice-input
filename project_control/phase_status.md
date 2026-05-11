# phase_status.md（Owner-owned · 与 goal.md GOAL LIST 同步）

## 主文档

- 全量目标：`project_control/goal.md` §6 **GOAL LIST**  
- 规格：`specs/SVI-MASTER.spec.md`  
- 计划：`plans/SVI-MASTER.plan.md`  

## 当前阶段（执行指针）

| 字段 | 值 |
|------|-----|
| **Current Phase** | **G9 已完成（代码）**；**G5** 安装包仍未交付；**G0** 外网联调仍可由 Owner 自选 |
| 说明 | **G9** 报告：`reports/phase-g9.report.md`。**G8**：`reports/phase-g8.report.md`。 |

## 阶段完成登记表（人工勾选）

| 阶段 | 状态 | 报告 |
|------|------|------|
| G0 | 自动化通过；手工外网联调待 Owner | `reports/phase-g0.report.md` |
| G1 | 已完成（代码+测试） | `reports/phase-g1.report.md` |
| G2 | 已完成（代码+测试） | `reports/phase-g2.report.md` |
| G3 | 已完成 | `reports/phase-g3.report.md` |
| G4 | 已完成 | `reports/phase-g4.report.md` |
| G5 | 文档路径完成；安装包未交付 | `reports/phase-g5.report.md` |
| G6 | 已完成（代码+测试；手工抽检见报告） | `reports/phase-g6.report.md` |
| G7 | 已完成（工作台场景单入口） | `reports/phase-g7.report.md` |
| G8 | 已完成（会话自动创建 / 能力探测 / 双入口） | `reports/phase-g8.report.md` |
| G9 | 已完成（悬浮窗状态化 / 文案 / 菜单栏） | `reports/phase-g9.report.md` |

## Forbidden Work（全局守卫）

- 不做账号/云同步/移动端  
- 不做完整智能体与自动执行外部开发流程  
- 投递逻辑不得长期绕过 **OutputRouter**（G1 起强制）

## 旧版 Phase 3 说明

原「Phase 3 Provider Verification」已并入 **G0** 中 Provider 与真实链路透跑验收；不再单独维护旧编号。
