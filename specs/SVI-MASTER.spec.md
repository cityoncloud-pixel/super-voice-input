# SVI-MASTER.spec.md — 超级语音输入器 · 全阶段规格

> 与 `project_control/goal.md` §6 GOAL LIST（**G0–G9**）一一对应。验收以本节「验收标准」为准。

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
4. 当前实现下的各 `RewriteMode` / 整理模式均可生成 `final_text`（外网不可用时允许 mock/测试模式演示管线）；**六种模式与 Registry 以 G6 为准扩展**。

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

## G6 — 模式化提示词通道（六模式 · Registry）

### 目标
对齐 `project_control/.ggs/idea.md` **Required Modes** 与附录模板：**保留手动选择整理模式**；新增 **思考澄清**（`thinking_clarify`）；六种模式各占 **独立 prompt 模板**；整理按 **`session.mode`** 加载模板；**不做** 自动识别模式、不做复杂 agent。

### 模式 id（单一来源：Mode Registry）
- `clean_intent`、`thinking_clarify`、`obsidian_note`、`gaeh_goal`、`coding_task`、`faithful_transcript`  
- 实施时需处理与既有代码枚举（如 `intent_cleanup`、`task_requirement`）的 **迁移与映射**，避免预设与会话历史断裂。

### 功能范围
- **Registry**：后端常量或 JSON；字段至少含 `id`、`name`、`description`、`prompt_template`（文件名）。  
- **PromptLoader**：`mode → 读模板 → 渲染`；最低占位符 `{{combined_transcript}}`；缺文件/未知 mode 返回明确错误（`UNKNOWN_MODE`、`PROMPT_TEMPLATE_NOT_FOUND`、`PROMPT_RENDER_FAILED`）。  
- **Rewrite 路径**：`RewriteService`（或等价层）选模板并渲染；**RewriteAdapter** 仅调模型、不包含各模式 if-else 业务分支。  
- **API**：`GET /modes`（或项目统一前缀下的等价路径）返回全部可选模式元数据，**前端下拉的唯一来源**。  
- **VoiceSession**：`mode` 持久化；`PATCH` 或更新会话可改 `mode`；**finalize** 使用 **当前** `mode`；同一会话在已有 `final_text` 时切换 `mode` 后须允许 **再次整理**（`combined_transcript` 不丢；UI 提示见 idea.md）。  
- **模板文件**：`prompts/modes/*.md`（与现有 `prompts/*.txt` 的迁移策略在 PLAN 中定义）。  
- **可选**：`RewriteOutput` 表记录多轮整理；本阶段可继续仅保留 session 级 `final_text`，但实现不得假设「仅一次终稿」。

### 验收标准
1. 六模式在 UI 中可选；**思考澄清** 的说明文案符合「澄清思考」语义（非「高级润色」类误导）。  
2. 每种模式对应独立模板文件；同一段 `combined_transcript` 切换 `mode` 后整理结果 **结构可区分**。  
3. `GET /modes` 与 Registry 一致；未知 mode / 缺模板时错误清晰。  
4. Prompt 正文不出现在前端硬编码；`pytest` 覆盖「不同 mode 加载不同模板路径/内容」的关键断言。  
5. `pytest -q` 通过。

### G6 非目标
自动推断模式；多 agent 编排；替换或废除 Output Router（G1+）投递语义。

---

## G7 — 工作台「本次用途」一级入口（预设绑定 mode + 投递）

### 目标
对齐 `project_control/.ggs/idea.md` **§界面与用途层级**：主界面 **不再并列**「场景预设」与「整理模式」两套一级选择；用户只选 **本次用途**，系统根据 **用途预设 Registry** 自动设置 **`session.mode`** 与 **默认 `OutputTarget`**；**整理模式 / 投递目标 / 引擎** 默认隐藏在 **高级设置**，可覆盖。

### 用途预设 Registry（逻辑字段）
每条预设至少：`preset_id`、`label`（用户可见）、`mode`、`default_output_target`、`description`。六种用途与映射表以 **idea.md** 为准（思考澄清 / 发给 AI 对话框 / 写入 Obsidian Inbox / 生成 GAEH Goal / 生成编程任务 / 忠实转录）。

### `preview` 语义
若 `default_output_target` 为 **`preview`**（或无匹配枚举）：**不自动调用** `POST /outputs`，仅在面板展示 `final_text`；若需投递由用户在投递区操作或改为高级设置中的目标。（实现可与现有 OutputTarget 对齐或文档化等价行为。）

### 功能范围（工作台）
- **单一主下拉**：「本次用途」；下列 **说明文案** 随选项变。  
- **移除主路径**：「— 不使用预设 —」类开发者选项（或仅高级设置）。  
- **命名**：「生成 GAEH 任务稿」改为 **「生成 GAEH Goal」**；独立 **「生成编程任务」**。  
- **高级设置（折叠）**：可选展示并覆盖 **mode**、**output_target**、STT/Rewrite 引擎。  
- **会话同步**：新建或切换用途时更新会话 **mode** 与客户端默认投递指针（与现有 `presetDefaultOutputTarget` 一类状态合并）。  
- **悬浮窗**：跟随同一用途模型（最小实现可与主面板共用 preset API）。

### 架构约束
- **Rewrite** 仍只依赖 **`mode`** + 模板；**OutputRouter** 仍只依赖 **`output_target`**。  
- UI **不写死 prompt**；用途列表来自 **Registry**（`GET` 扩展或专用 **`GET /use-cases`**，实现选型在 PLAN）。  
- **G6** 的 `GET /modes` 保留供高级设置；主路径以用途 Registry 为主。

### 验收标准
1. 主界面用户 **只需一级选择用途** 即可完成常见「录音→整理→投递」心智模型。  
2. 六种用途与 **idea.md** 映射一致（含 **thinking_clarify**、**send_to_ai** 等 id）。  
3. 选用途后 **`session.mode`** 与 **默认投递** 自动正确；高级设置可覆盖。  
4. 主界面 **不出现** 并列的「场景预设」+「整理模式」双下拉（允许高级区内并列）。  
5. `pytest -q` 对后端合并逻辑/regression 保持通过（前端 E2E 可选）。

### G7 非目标
用语义 AI 自动猜用途；废除六种 **mode** 或模板机制。

---

## G8 — 会话自动管理与双入口产品化

### 目标
对齐 `project_control/.ggs/idea.md` **§会话自动管理、双入口分工与状态机**（由 Owner `newidea.md` 提炼）：把产品从「先建会话再录音」升级为 **以录音为默认起点**；**悬浮窗** 作为日常高频入口；**工作台** 作为完整管理/调试台；并补齐 **输出目标可用性** 的前置可见性。

### 功能范围

**A. 自动会话（`ensureCurrentSession` 语义）**  
- 用户点击「开始录音」时：若当前无可用会话，则按 **当前选中的用途**（`use_case_id`）**自动** `POST /sessions`（或等价），写入 **mode**、**默认 output_target**、**use_case_id**，并立即进入录音。  
- **新建会话** 保留为「开始新主题」的次要动作，**不是** 录音的前置必点。  
- 无会话时的空状态文案：引导「点击开始录音将自动创建会话」，而非仅「尚未创建会话」。

**B. 已完成会话后的再录音**  
- 当会话状态为 **已完成终稿闭环**（`completed` 或 SPEC 定义等价态）时，用户再次点录音：默认 **创建新会话**（新 `session_id`），避免新内容误挂到旧会话。  
- 「向旧会话追加」若需支持，应通过显式操作（后续迭代），而非默认行为。

**C. 自动标题**  
- 自动创建会话时，默认标题建议：`{用途显示名} YYYY-MM-DD HH:mm`；用户可在工作台修改。

**D. 切换用途**  
- 会话 **无片段**：可直接切换用途，并同步 `use_case_id` / `mode` / 默认投递语义。  
- 会话 **已有片段**：切换时须 **提示** 将影响整理结果；第一版可允许直接切换并同步字段；后续可做「仅本会话 / 另开新会话」分支。

**E. 工作台 vs 悬浮窗**  
- 悬浮窗：**用途显式、可切换**；录音/停段/转写/完成整理/投递/打开工作台；**不** 默认展示整理模式、双引擎、复杂历史编辑（与工作台分工一致）。  
- 工作台：片段管理、历史、配置、错误排查。

**F. 主状态机（按钮启用逻辑）**  
- 至少满足：`idle_no_session` 下 **「开始录音」可用**（依赖 A）。  
- 状态集合与字段映射在 PLAN 中落实到现有 `VoiceSession.status` 或客户端状态机，允许渐进对齐。

**G. 输出能力探测**  
- 新增 **`GET`**（路径以实现为准，建议统一前缀）：返回各 **`output_target`** 是否可用及人类可读原因（路径未配置、仅 Electron 可用等）。  
- 桌面 UI：**提前** 禁用或标注不可用目标，避免用户操作后才遇 HTTP 400。

### 验收标准

1. **主工作台**：未点击「新建会话」，直接「开始录音」可录音；系统自动创建会话且绑定当前用途。  
2. **悬浮窗**：无当前会话时可直接录音；录音开始后会话已存在并与用途一致。  
3. **completed（或等价）后再录音**：默认产生 **新** 会话（可手工验收：观察新 `session_id`）。  
4. 自动创建的会话具备 **合理默认标题**（格式见上或与 OWNER 约定）。  
5. 用途在主工作台与悬浮窗之间 **同步**（同一记忆源或轮询一致）。  
6. 会话已有片段时切换用途：**有提示**；mode/投递随用途更新（行为与 SPEC 一致）。  
7. **能力探测 API** 可用；缺少 Obsidian/GAEH/Markdown 路径时 UI **可见** 不可用原因。  
8. 投递失败 **不** 导致 `final_text` 从界面消失（继承 G1）。  
9. `pytest -q` 对后端新增/变更路径保持通过。

### G8 非目标

自动推断用户意图并切换用途；复杂 agent；废除 OutputRouter；要求用户理解 mode/prompt 等内部名。

---

## G9 — 悬浮窗「遥控器」产品化（状态驱动 · 低干扰）

### 目标
对齐 `project_control/.ggs/idea.md` **§悬浮窗：遥控器，不是缩小工作台**：悬浮窗从「缩小版工作台」升级为 **日常高频、状态化的系统级输入入口**；完整管理、历史与配置仍在 **主控台（大工作台）**。

### 功能范围（Electron + overlay）

**A. 窗口形态**  
- 默认 **隐藏应用菜单栏**（至少 `autoHideMenuBar: true`，避免 `File/Edit/View…` 常驻占高）。  
- 可选：`alwaysOnTop`、`frame`/自定义标题区、固定或受限尺寸；具体组合以实现与 Owner 验收为准。

**B. 状态驱动 UI**  
- 客户端根据录音/片段转写/整理进度切换布局与主按钮优先级；建议状态：`idle`、`recording`、`transcribing`、`ready_to_finalize`、`finalizing`、`completed`、`error`（与 `VoiceSession.status` / 片段状态的映射在 PLAN 落地）。  
- 用户能 **一眼区分**：未录音、录音中、转写中、可整理、整理中、已完成、错误。

**C. 片段区（悬浮窗）**  
- 默认 **摘要**：段号、状态、字数或时长、单行预览；**不** 默认铺满完整转写长文以免撑高窗口。  
- 提供 **查看详情**（展开或跳转主控台）阅读全文。

**D. 文案用户化**  
- 对外不使用「路由」等工程术语；输出目标展示为 **「输出：剪贴板」** 或等价自然语言。  
- **整理主按钮** 与当前默认输出目标 **联动**，例如：`clipboard` →「整理并复制」；`active_window_paste` →「整理并粘贴」；Obsidian/文件类 →「整理并保存」；`gaeh_goal_file` →「整理为 Goal」；纯预览语义 →「生成终稿」或产品约定文案。

**E. 快捷键脚注**  
- 底部快捷键说明 **压缩为一行**（或折叠）。

**F. 职责边界**  
- 悬浮窗 **不** 承载完整历史列表、引擎下拉、复杂路径配置（仍在主控台）。

### 验收标准

1. 悬浮窗启动后 **默认不显示** 系统菜单栏（或等价隐藏）。  
2. 用户能识别 **当前状态**（未录 / 录中 / 转写中 / 可整理 / 整理中 / 完成 / 错误）。  
3. 用户能识别 **当前输出目标**（用户可读文案）。  
4. 用户能识别 **已录段数** 与各段是否失败（摘要级即可）。  
5. 片段列表 **不因长转写** 无限撑高主卡片（摘要 + 详情策略生效）。  
6. 「整理」类主按钮文案与 **当前投递语义** 一致或等价映射正确。  
7. 整理完成后有明确反馈（如已复制剪贴板 / 已保存路径等，与现有投递链路一致）。  
8. 主控台仍可查看完整历史与全文。

### G9 非目标

在悬浮窗内重做完整工作台；废除 OutputRouter；新增与语音输入无关的窗口管理能力（超出轻薄悬浮壳）。

---

## 文档索引

| 阶段 | PLAN 章节 | 建议报告 |
|------|-----------|----------|
| G0–G9 | `plans/SVI-MASTER.plan.md` | `reports/phase-gN.report.md` |
