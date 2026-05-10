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

## 全局执行顺序（汇总）

```
G0 → G1 → G2 ─┬→ G3 → G5
                └→ G4（与 G2/G3 部分并行）
```

**门禁**：每阶段结束更新 `project_control/phase_status.md`（Current Phase / Done Criteria）。
