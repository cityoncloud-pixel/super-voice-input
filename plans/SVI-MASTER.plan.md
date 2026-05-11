# SVI-MASTER.plan.md — 全阶段执行计划

> 对应 `specs/SVI-MASTER.spec.md` 与 `project_control/goal.md` §6。  
> **执行规则**：完成上一阶段「验收标准」+ 本文件该节 Deliverables 后，推进下一阶段。

---

## G0 — 核心引擎与工作台闭环

### 工作拆解
1. **回归基线**：对照 `specs/mvp-0001.spec.md`，列出与当前代码差异（若有）。  
2. **Provider 链**：豆包 public URL、format 合规、DeepSeek finalize；错误可见。  
3. **工作台**：Electron 多段录音、片段列表、整理、复制、历史（已实现则做差距清单）。  
4. **测试**：`pytest` + 文档化手工验收路径（`README` 或 `reports/phase-g0.report.md`）。

### Deliverables
- [ ] 差距清单关闭或登记为技术债项  
- [ ] `pytest -q` 绿  
- [ ] `reports/phase-g0.report.md`（验收勾选）

### 建议顺序
`差异盘点 → Provider 硬编码项收敛 → UI 差距 → 报告`

---

## G1 — Output Router 与 P0–P1

### 工作拆解
1. **领域模型**：`OutputTarget` 枚举、`OutputResult`、会话侧输出元数据。  
2. **API**：`POST /sessions/{id}/outputs`；服务层 `OutputRouter`。  
3. **Electron**：主进程实现剪贴板 + `globalShortcut`/robot 或 `nut-js` 类方案做粘贴（技术选型待评估，须安全）。  
4. **Preload 桥**：渲染进程仅通过 IPC 调用投递，不直接 `clipboard` 绕过路由（或文档例外）。  
5. **UI**：终稿区「输出到：剪贴板 / 粘贴到当前窗口」。

### Deliverables
- [ ] SPEC G1 验收标准全满足  
- [ ] 新增/更新测试  
- [ ] `reports/phase-g1.report.md`

### 依赖
G0 完成。

---

## G2 — 投递扩展 P2–P4

### 工作拆解
1. **MarkdownFileTarget**：路径模板、文件名规则。  
2. **ObsidianInboxTarget**：Vault 根路径校验、Inbox 相对路径。  
3. **GAEHGoalFileTarget**：项目根、`.gaeh/inbox` 约定、文件命名。  
4. **审计**：输出历史写入 DB 或追加日志表。

### Deliverables
- [ ] 三类 Target 集成测试或手工脚本  
- [ ] `reports/phase-g2.report.md`

### 依赖
G1 完成。

---

## G3 — 入口层（悬浮窗 + 快捷键）

### 工作拆解
1. **BrowserWindow** 或独立无边框小窗；置顶与显示策略。  
2. **快捷键**：与现有托盘快捷键整合；冲突检测。  
3. **状态同步**：小窗与主进程会话状态一致（轮询或 IPC 事件）。  
4. **文档**：用户侧快捷键表。

### Deliverables
- [ ] 无大面板完成一轮端到端（录音→整理→P0）  
- [ ] `reports/phase-g3.report.md`

### 依赖
G1 完成（建议 G2 P3/P4 可与 G3 并行开发但验收独立）。

---

## G4 — 场景预设

### 工作拆解
1. 预设模型与存储。  
2. API：`GET/POST /presets`（或本地 JSON 读写封装）。  
3. UI：预设选择器、默认预设。

### Deliverables
- [ ] `reports/phase-g4.report.md`

### 依赖
G1+；与 G3 可并行。

---

## G5 — 打包与分发

### 工作拆解
1. `electron-builder` 或等价；CI 可选。  
2. README：终端用户路径 vs 开发者路径。  
3. 版本与 LICENSE。

### Deliverables
- [ ] 可下载产物或明确「源码安装」唯一路径  
- [ ] `reports/phase-g5.report.md`

### 依赖
G3 稳定后推荐启动；可与 G4 并行文档部分。

---

## G6 — 模式化提示词通道

### 工作拆解
1. **Registry**：定义六种 `mode` id 与元数据；与既有 `RewriteMode` / 预设表字段对齐迁移方案。  
2. **模板**：按 `idea.md` 附录落盘 `prompts/modes/*.md`；实现 `load_prompt_template` + `{{combined_transcript}}` 渲染。  
3. **服务层**：finalize 路径改为「mode → 模板 → RewriteAdapter」；错误码与日志对齐 SPEC。  
4. **API**：`GET /modes`；会话更新 `mode`；finalize 使用当前 mode。  
5. **前端**：下拉数据来自接口；按钮文案「按当前模式整理」；切换 mode + 已有终稿时的提示。  
6. **测试**：mock 模板目录下多文件，断言不同 mode 走入不同 system prompt。

### Deliverables
- [ ] SPEC G6 验收标准全满足  
- [ ] `reports/phase-g6.report.md`

### 依赖
G0 整理管线可用；建议 **G4** 完成后一并验收预设中的 `rewrite_mode` 与新 id 一致。

---

## G7 — 本次用途单入口（预设 = mode + 投递）

### 工作拆解
1. **用途 Registry**：落盘 JSON 或扩展 `voice_presets`（字段：`preset_id`、`label`、`mode`、`default_output_target`、`description`）。  
2. **API**：`GET /use-cases`（或扩展 `/presets` 语义）；创建/切换会话时 body 可传 `use_case_id`，服务端写入 `session.mode` + 返回默认投递。  
3. **Electron 主面板**：移除并列「场景预设」「整理模式」；改为 **本次用途** 单选 + 说明；**高级设置** 内暴露 mode / output_target / 引擎覆盖。  
4. **`preview`**：无自动 `outputs` 调用时的 UI 行为（见 SPEC §G7）。  
5. **悬浮窗**：与主面板用途模型对齐（最小共用 preset 状态）。  
6. **测试**：API 层用途→mode→target 映射；回归 `pytest`。

### Deliverables
- [ ] SPEC G7 验收标准全满足  
- [ ] `reports/phase-g7.report.md`

### 依赖
**G6**（模板与 mode）、**G1–G2**（投递枚举）。

---

## G8 — 会话自动管理与双入口产品化

### 工作拆解
1. **后端**：创建会话 API 与当前前端流程对齐；若有「仅缺会话」的中间态，定义 **`ensure`** 行为（可先纯前端组合 `GET` + `POST`）。**completed → 再录音** 时服务端或客户端策略明确（新建会话规则写入 SPEC）。  
2. **自动标题**：创建会话时默认 `title`；与工作台编辑兼容。  
3. **主工作台 UI**：开始录音前 **不必** 强制新建会话；空状态文案按 SPEC。  
4. **悬浮窗**：无会话时录音 → 自动建会话；与 `svi-shared` 记忆的 **用途** 一致。  
5. **用途切换**：无片段 / 有片段两种路径与提示（modal 或 toast）。  
6. **状态机**：梳理按钮启用逻辑（可与现有控件渐进对齐）。  
7. **`GET /output-capabilities`**（或命名等价）：聚合 `.env`/路径配置，返回各 target 可用性；Electron 侧可选附加 `foreground_paste` 能力。  
8. **桌面投递区**：根据 capabilities 禁用选项并展示原因。  
9. **测试**：API 与会话状态相关的回归；capabilities 单测。

### Deliverables
- [ ] SPEC G8 验收标准全满足  
- [ ] `reports/phase-g8.report.md`

### 依赖
**G7**（用途 Registry）、**G3**（悬浮窗）、**G1–G2**（投递与配置）。

---

## G9 — 悬浮窗「遥控器」产品化

### 工作拆解
1. **Electron**：`BrowserWindow`（overlay）设置 `autoHideMenuBar: true`；评估 `alwaysOnTop`、`frame`、宽高固定；不改坏多实例/托盘逻辑。  
2. **overlay.html / overlay.js**：状态机驱动区块显隐；摘要化片段列表；「查看详情」展开或 `openMainPanel`。  
3. **文案**：替换「路由」等用语；整理按钮根据 **默认输出目标 / use_case** 动态标签（与 `presetDefaultOutputTarget` 或会话记忆对齐）。  
4. **快捷键区**：一行脚注或折叠。  
5. **手工验收**：对照 SPEC §G9；截图或简短录屏入 `reports/phase-g9.report.md`。

### Deliverables
- [ ] SPEC G9 验收标准全满足  
- [ ] `reports/phase-g9.report.md`

### 依赖
**G8**（会话与投递语义）、**G7**（用途与默认投递）。

---

## 全局执行顺序（汇总）

```
G0 → G1 → G2 ─┬→ G3 → G5
                └→ G4（与 G2/G3 部分并行）

G6：与 G5 可部分并行（文档/模板先行）；与 G4 字段对齐建议在 G4 完成后收口验收。
G7：在 G6 之后收敛工作台 UX；可与 G3 悬浮窗联动迭代。
G8：在 G7 之后实施；强化悬浮窗与会话自动创建、completed 后再录、输出能力探测。
G9：在 G8 之后实施；悬浮窗状态化、隐藏菜单栏、摘要化、文案联动。
```

**门禁**：每阶段结束更新 `project_control/phase_status.md`（Current Phase / Done Criteria）。
