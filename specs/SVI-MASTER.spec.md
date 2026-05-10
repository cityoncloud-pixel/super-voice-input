# SVI-MASTER.spec.md — 超级语音输入器 · 全阶段规格

> 与 `project_control/goal.md` §6 GOAL LIST 一一对应。验收以本节「验收标准」为准。

---

## 全局架构原则

- **核心引擎**：会话、片段、转写、合并、整理；不依赖 UI 形态。  
- **投递层**：`final_text` 仅通过 **OutputRouter** → `OutputTarget`；禁止桌面 UI 直接调用系统剪贴板/键盘而不经 API（调试例外须在 SPEC 声明）。  
- **入口层**：快捷键与悬浮窗只触发引擎与路由，不复制业务逻辑。

---

## G0 — 核心引擎与工作台闭环

### 目标
满足 `project_control/.ggs/idea.md` 中 Main Requirements + MVP + Acceptance Criteria；工作台（大面板）作为 **可回归的主调试界面**。

### 功能范围
- VoiceSession / VoiceSegment 分离建模与 SQLite 持久化。  
- 创建会话、多段录音、每段独立保存与 `order_index`。  
- 分段转写（adapter）、失败可单段重试、不影响其他段。  
- 删除片段、重录片段。  
- `combined_transcript` 与 `finalize` → `final_text`（四模式 + prompt 外置）。  
- 预览、`final_text` 复制、历史列表与 `refinalize`。  
- 统一错误处理；空会话/全失败禁止整理并提示。

### Provider 与工程现实
- **STT**：Doubao OpenSpeech 标准版路径（submit/query）；须满足火山侧 **公网 `audio.url`** 与 **format 在文档允许集合内**（若浏览器产出 webm，须在实现层映射或转封装为文档允许格式 — 实现细节见该阶段 PLAN）。  
- **Rewrite**：DeepSeek（或配置项）；密钥走 `.env`。  
- **测试**：`SVI_TEST_MODE` 下可回归不带外网。

### 验收标准（必须全部满足）
1. `pytest -q` 通过。  
2. 手工：新建会话 → 至少 2 段录音 → 至少 1 段转写成功 → 完成整理 → 得到非空 `final_text` → 复制成功 → 历史可载入（在配置好外网与密钥的开发者环境下）。  
3. 片段级失败可重试；会话不崩溃。  
4. 四种 `RewriteMode` 均可生成 `final_text`（外网不可用时允许 mock/测试模式演示管线）。

### G0 非目标
不包含 Output Router、悬浮窗作为唯一入口、Obsidian/GAEH 文件自动写入（属于 G1+）。

---

## G1 — Output Router 底座与 P0–P1

### 目标
终稿离开「仅页面预览」，进入可编程投递；最小实现 **P0 剪贴板**、**P1 前台窗口粘贴**。

### 接口与抽象（逻辑）
- `POST /sessions/{session_id}/outputs`（或等价资源）：body 含 `target`（枚举）、可选 `context`。  
- `OutputRouter.dispatch(session_id, target) -> OutputResult`（成功/失败原因/可追溯 log id）。  
- **P0 Clipboard**：将 `final_text` 写入系统剪贴板（通过 **主进程** 或受控桥，避免渲染进程随意调 OS）。  
- **P1 ActiveWindowPaste**：顺序：`final_text`→剪贴板 → 恢复先前前台窗口焦点 → 发送 **Ctrl+V**（Windows）或平台等价；失败则提示并保留终稿。

### 数据与审计
- 输出尝试写入会话扩展字段或关联表：`last_output_target`、`last_output_status`、`last_output_at`（最小集）。  
- **禁止**：输出失败清空 `final_text`。

### 验收标准
1. API + Router 单元/集成测试覆盖成功与失败分支（失败可 mock OS）。  
2. 手工：生成终稿 → 一键复制成功；「粘贴到当前窗口」在记事本或浏览器输入框可验证（环境允许时）。  
3. 失败时有 Toast/日志，用户仍可手动复制页面中的终稿。

### G1 非目标
Obsidian/GAEH 路径写入、Webhook、悬浮窗专属 UI（G2/G3）。

---

## G2 — 投递扩展 P2–P4

### 目标
文件类投递与 GAEH 工作流衔接。

### 范围
- **P2 MarkdownFile**：按规则写入用户配置目录下 `.md`（文件名含时间戳）。  
- **P3 ObsidianInbox**：配置 `OBSIDIAN_VAULT_ROOT` + 相对 Inbox 子路径；写入 Markdown；不开发 Obsidian 插件。  
- **P4 GAEHGoalFile**：配置项目根与相对路径（如 `.gaeh/inbox/`）；任务/需求模式下写入 `goal` 或时间戳文件；不自动触发 GAEH runner。

### 验收标准
1. 各 Target 在配置正确时可写入文件且内容为当前 `final_text`。  
2. 路径穿越与安全校验（禁止写出 Vault 外）。  
3. 配置缺失时明确报错，不崩溃。

---

## G3 — 入口层：全局快捷键 + 迷你悬浮窗

### 目标
日常主路径不依赖大面板；大面板降级为「控制台/历史/调试」。

### 范围
- 迷你悬浮层 UI：**录音中状态、停止本段、完成整理、当前模式显示**；置顶可选。  
- 全局快捷键：**开始/停止本段、完成整理并投递到默认目标**（键位可配置，避免与系统冲突列表文档化）。  
- 与 G1 默认投递目标联动。

### 验收标准
1. 关闭主窗口仅用悬浮层 + 托盘可完成「多段录音 → 整理 → P0 投递」。  
2. 快捷键在 README 中可查。

### 无法实现/降级
- 部分游戏/全屏独占应用无法抢焦点 → 文档说明降级为仅剪贴板。

---

## G4 — 场景预设

### 目标
减少每次手动选模式与投递目标。

### 范围
- 预设结构：`name`、`rewrite_mode`、`default_output_target`、可选快捷键槽位。  
- 持久化（SQLite 或本地 JSON，技术选型在 PLAN）。  
- UI：预设列表、切换、设为默认。

### 验收标准
1. 至少 3 条内置预设可切换（与 idea.md 示例对齐即可）。  
2. 切换预设后新会话继承默认目标（行为以 PLAN 细化为准）。

---

## G5 — 打包与分发收尾

### 目标
非开发者可安装使用。

### 范围
- Windows 可分发包（或文档化 `npm run desktop` + Python 环境）；`README` 一键步骤。  
- `.env.example` 与故障排查（端口、豆包 URL、剪贴板权限）。  
- 已知限制列表（与全局 Out of Scope 一致）。

### 验收标准
1. 干净机器按 README 可完成安装与首次启动（或在 SPEC 中声明「开发者模式」与「安装包模式」双路径）。  
2. 版本号与变更说明可追踪。

---

## 文档索引

| 阶段 | PLAN 章节 | 建议报告 |
|------|-----------|----------|
| G0–G5 | `plans/SVI-MASTER.plan.md` | `reports/phase-gN.report.md` |
