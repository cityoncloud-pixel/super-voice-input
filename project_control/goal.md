# goal.md（Owner-owned · 全量分阶段目标）

> 本文一次性列出 **超级语音输入器** 在 `project_control/.ggs/idea.md` 下的全部阶段目标；执行顺序 **G0→G5**，前一阶段验收通过后方可进入下一阶段（GAEH：SPEC → PLAN → EXECUTE → 报告/门禁）。

---

## 1) Intent / 原始意图

将多段、不连贯的口述稳定转化为 **可直接使用的文本**，并进一步作为 **系统级语音输入基础设施**，把终稿 **投递** 到用户当前工作场景（剪贴板、前台输入框、文件、GAEH 项目等），而非长期依赖单一大型调试面板。

---

## 2) Target Outcome / 总交付物

一个 **本地优先** 的应用体系，包含：

1. **核心引擎**：多段会话、分段转写、合并、按模式整理、历史与 adapter/prompt 架构。  
2. **投递层（Output Router）**：终稿可路由到多种 `OutputTarget`。  
3. **入口层**：全局快捷键与迷你悬浮交互为主入口；大面板为控制台/调试台。  
4. **工程产物**：源码、`specs/`、`plans/`、`reports/`、可运行入口与发布说明。

---

## 3) Success Criteria / 全局成功标准（跨阶段）

至少满足：

1. **可验证自动化**：`pytest -q` 对本地 API 核心路径保持通过；重大阶段合并前补充用例。  
2. **可观察行为**：每阶段文档中列出「最小手工验收路径」。  
3. **架构约束**：STT / Rewrite 经 adapter；Prompt 模板独立；VoiceSession 与 VoiceSegment 分离；错误对用户可见、不可静默吞掉 `final_text`。  
4. **顺序门禁**：按 §6 GOAL LIST 编号推进；阶段完成记录在 `project_control/phase_status.md` 与 `reports/`。

---

## 4) Scope / 范围

### In Scope（全项目生命周期）

- 桌面端（Electron 路径）+ 本地 FastAPI + SQLite。  
- 多段会话、投递扩展、快捷键与悬浮入口（按阶段）。  
- 本地文件写入（Obsidian 目录、GAEH 目录）作为投递形式之一。

### Out of Scope（与 idea.md 一致，全文适用）

- 单段录音作为唯一主流程；完整智能体；语音操控电脑；实时字幕；多人会议纪要。  
- 移动端 App；账号系统；云端同步；复杂知识库；自动代替用户执行 Cursor/Codex/GAEH 任务。  
- **第一版不做**：网页 DOM 级识别 ChatGPT 输入框；Obsidian 专用插件（仅用文件写入模拟）；依赖云端「长期记忆」的产品形态。

### 无法实现或仅能尽力而为（须写入 SPEC 风险）

- **前台粘贴**：依赖操作系统与应用配合；部分全屏/权限场景可能失败 → 必须有 **仅剪贴板** 降级且不打断终稿保留。  
- **豆包录音文件识别**：云端必须能 **HTTP GET** 音频 URL → 需公网可达或合规格式；与火山配额/格式限制相关 → 以 SPEC 中「环境验收」为准。

---

## 5) Constraints / 约束

- 本地优先；敏感配置走 `.env`，勿提交密钥。  
- UI 不直接绕开 API 操作投递逻辑（idea.md：**Output Router** 统一出口）。  
- 中文文档与注释优先；对外命令与仓库路径可中英并存。

---

## 6) GOAL LIST（分阶段 · 全部列出）

| 编号 | 阶段名 | 一句话目标 | 对应 SPEC / PLAN |
|------|--------|------------|------------------|
| **G0** | 核心引擎与工作台闭环 | 多段会话→转写→合并→四模式整理→预览/复制/历史；真实/模拟 Provider 可配置；引擎层稳定可回归 | `specs/SVI-MASTER.spec.md` §G0、`plans/SVI-MASTER.plan.md` §G0 |
| **G1** | Output Router 底座与 P0–P1 | 引入 `OutputRouter` + API；**P0 剪贴板**、**P1 前台窗口粘贴（剪贴板+激活+Ctrl+V）**；失败不丢 `final_text` | §G1、§G1 |
| **G2** | 投递扩展 P2–P4 | **P2** 写入 Markdown 文件；**P3** Obsidian Inbox 路径规则；**P4** GAEH 项目 goal/inbox 文件；输出审计入库或日志 | §G2、§G2 |
| **G3** | 入口层：快捷键 + 迷你悬浮窗 | 默认入口为小悬浮层：录音状态、停止本段、完成整理、当前模式；与大面板解耦；延续全局快捷键策略 | §G3、§G3 |
| **G4** | 场景预设 | 可保存「模式 + 默认投递目标」预设（如：原意清理→粘贴、Obsidian 模式→Inbox）；一键切换 | §G4、§G4 |
| **G5** | 打包与分发收尾 | 可安装/可分发产物、最终用户 README、环境变量说明、已知限制列表 | §G5、§G5 |

**依赖关系**：G1 依赖 G0；G2 依赖 G1；G3 可与 G2 **部分并行** 但建议在 G1 完成后全面切入入口层；G4 依赖 G1+（建议 G2 核心完成后）；G5 可在 G3 功能稳定后并行准备。

---

## 7) SPEC → PLAN → EXECUTE（固定流水线）

| 环节 | 产物 | 说明 |
|------|------|------|
| **SPEC** | `specs/SVI-MASTER.spec.md` | 按 §G0–G5 分节描述功能、接口、数据、验收、非目标 |
| **PLAN** | `plans/SVI-MASTER.plan.md` | 每阶段任务拆解、顺序、依赖、交付物列表 |
| **EXECUTE** | 代码 + `reports/phase-g*.report.md` | 实现与验证；每阶段结束更新 `project_control/phase_status.md`、必要时 `task_queue.json` |

**阶段完成定义（门禁）**：该节 SPEC 中「验收标准」全部满足 + PLAN 中该节 Deliverables 勾选 + 简短报告落盘。

---

## 8) Inputs / 输入材料

- `project_control/.ggs/idea.md`（战略与 Phase A–D 叙述）  
- `specs/SVI-MASTER.spec.md`、`plans/SVI-MASTER.plan.md`  
- 本仓库 **已有** 本地 API、Electron、adapter、prompt 等实现（非空仓库）

---

## 9) Output Format / 产出物

- 代码与配置；`specs/`、`plans/`、`reports/`；`project_control/goal.md`（本文件）。  
- 每阶段验收记录：`reports/phase-gN.report.md`（模板可沿用 MVP 报告结构）。

---

## 10) Risks / 风险

- Provider（豆包/DeepSeek）政策与格式变更 → adapter 与 `.env` 文档同步更新。  
- 跨应用粘贴可靠性 → 预设降级路径。  
- 阶段过多导致并行混淆 → **严格执行 GOAL LIST 顺序与门禁**。

---

## 11) Approval Policy / 同意门禁

- 重大范围变更须更新本文件与 `SVI-MASTER.spec.md` 同序章节。  
- Owner 回复 **`APPROVE`** 后，执行侧从 **`phase_status.md` 当前指针** 所指阶段按 PLAN 连续实施直至全表完成。

---

## 附录：与旧版 goal 的差异说明

- 旧版仅覆盖 MVP（等价 **G0**）。  
- 本版将 **idea.md 新增** 的投递层、入口层、预设、打包 **一次性纳入 GOAL LIST**，避免「挤牙膏」式追加；细节以 **SVI-MASTER.spec.md** 为准。
