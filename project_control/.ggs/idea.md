# Idea

# Goal: 构建支持多段录音会话的超级语音输入器

## Background

我经常在长文本输入时不想打键盘，尤其是在向 ChatGPT、Claude、Cursor、Codex、Claude Code、Obsidian 或 GAEH 输入较长想法时。普通输入法的语音输入只能把我说的话尽量原样转写出来，但我的真实需求不是简单转写，而是把一段或多段可能不连贯、重复、跳跃、语序混乱的口述整理成清楚、忠实原意、可直接使用的文本。

我之前做过一个录音转故事的程序，部署在服务器上，使用过豆包和 DeepSeek 两个 API 调用。但现在这个需求更日常、更底层，不应仅作为“录音转故事”功能存在，而应抽象成一个通用的语音输入增强工具。

更重要的是，我的真实思考过程往往不是一次录音就完整表达，而是会分多次补充、修正和追加。因此，本项目第一版不采用单段录音作为主流程，而是直接实现多段录音会话模式。

## Objective

构建一个本地优先的桌面端“超级语音输入器”，支持用户创建语音会话，在同一会话中录制多个语音片段。每个片段应独立保存、独立转写、可查看、可删除、可重录或重试。用户完成多段口述后，系统将所有片段的转写文本按顺序合并，并根据用户选择的整理模式生成最终可用文本。

核心流程为：

创建语音会话 → 录制多个语音片段 → 每段独立转写 → 合并转写文本 → 按模式整理 → 预览最终结果 → 复制输出 → 保存历史记录

## Core Positioning

本项目第一阶段不是完整智能体，不是语音操控电脑工具，不是会议纪要系统，也不是普通语音输入法。

它的第一身份是：

多段语音采集工具 + 语音转写工具 + 意图整理工具 + 文本输出工具

更准确地说，它是一个面向个人思考过程的语音输入基础设施。

未来它可以成为 Obsidian、GAEH、Cursor、ChatGPT、Claude、Codex 等系统的语音入口，但第一阶段必须专注完成“多段语音 → 可用文本”的稳定闭环。

## Main Requirements

1. 系统必须支持创建语音会话。
2. 一个语音会话必须支持包含多个录音片段。
3. 用户可以在当前会话中多次开始和结束录音。
4. 每次录音生成一个独立 VoiceSegment。
5. 每个 VoiceSegment 必须独立保存音频文件。
6. 每个 VoiceSegment 必须有顺序编号。
7. 每个 VoiceSegment 必须记录录音时长、创建时间、状态。
8. 每个 VoiceSegment 必须可以独立转写。
9. 某个片段转写失败，不应影响其他片段。
10. 用户可以查看每个片段的转写结果。
11. 用户可以删除某个片段。
12. 用户可以重试某个片段的转写。
13. 用户可以重录某个片段。
14. 用户点击“完成整理”后，系统应按顺序合并所有有效片段的转写文本。
15. 合并文本应保存为 combined_transcript。
16. 系统应根据用户选择的整理模式调用 LLM 生成 final_text。
17. 系统应保存 final_text。
18. 系统应显示最终结果预览。
19. 系统应支持复制 final_text 到剪贴板。
20. 系统应保存完整历史记录。
21. 系统应支持查看历史会话。
22. 系统应支持重新整理历史会话。
23. STT 调用必须通过 adapter 抽象。
24. Rewrite 调用必须通过 adapter 抽象。
25. Prompt 模板必须独立存放，不得硬编码在主流程中。
26. VoiceSession 和 VoiceSegment 必须是分离的数据结构。
27. 系统必须有统一错误处理。

## Recording Strategy

系统第一版应采用“分段转写，最终合并整理”的策略。

也就是说：

每段录音结束后，系统立即或手动触发该段转写；
每个片段保存自己的 raw_transcript；
用户完成全部录音后，系统合并所有片段的 raw_transcript；
最后调用整理模型生成 final_text。

第一版不建议采用“多个音频片段先合并为一个音频，再统一转写”的策略，因为该方式不利于失败恢复、片段删除、片段重试和局部管理。

## Required Modes

第一版至少支持四种整理模式：

1. 原意清理
2. Obsidian 笔记
3. 任务/需求整理
4. 忠实转录

### 原意清理

用于 ChatGPT、Claude、普通输入框。目标是把用户的多段口述整理成自然、清楚、忠实原意的表达。应删除口头禅、重复和无意义停顿，修复明显识别错误，适度调整语序，但不得新增用户没有表达的观点。

### Obsidian 笔记

用于生成 Markdown 笔记。输出应包含标题、摘要、主要内容、关键想法、待办或后续问题。第一版只需支持复制 Markdown，后续再支持直接写入 Obsidian Vault。

### 任务/需求整理

用于 GAEH、Cursor、Codex、Claude Code。输出应包含 Goal、Background、Problem、Objective、Requirements、Non-goals、Acceptance Criteria 等部分，使其适合进入后续软件开发流程。

### 忠实转录

用于尽量保留用户原始表达。只做标点、断句和明显识别错误修复，不重组内容，不总结，不改变表达顺序。

## Data Model Requirements

系统必须至少包含 VoiceSession 和 VoiceSegment 两类核心数据。

### VoiceSession

VoiceSession 表示一次多段语音会话，应包含：

- id
- title
- mode
- status
- combined_transcript
- final_text
- rewrite_provider
- created_at
- updated_at
- error_message

### VoiceSegment

VoiceSegment 表示会话中的一个录音片段，应包含：

- id
- session_id
- order_index
- audio_file_path
- duration_seconds
- raw_transcript
- stt_provider
- status
- created_at
- error_message

## MVP Scope

第一版必须完成以下能力：

1. 创建语音会话。
2. 在同一会话中录制多个音频片段。
3. 每个片段独立保存。
4. 每个片段独立转写。
5. 展示片段列表。
6. 展示每段转写状态。
7. 支持删除片段。
8. 支持重试转写失败的片段。
9. 支持按顺序合并所有片段转写。
10. 支持四种整理模式。
11. 支持调用 LLM 生成最终整理文本。
12. 支持预览最终文本。
13. 支持复制最终文本到剪贴板。
14. 支持保存历史会话。
15. 支持查看历史会话。
16. 支持统一错误提示。

## Non-goals

第一版不做以下内容：

1. 不做单段录音作为独立主流程。
2. 不做完整智能体。
3. 不做语音操控电脑。
4. 不做实时字幕。
5. 不做多人会议纪要。
6. 不做移动端 App。
7. 不做账号系统。
8. 不做云端同步。
9. 不做长期记忆系统。
10. 不做复杂知识库。
11. 不做自动调用 Cursor、Codex 或 Claude Code 执行任务。
12. 不做自动调用 GAEH 流程。
13. 不做复杂 workflow routing。
14. 不把自动粘贴到当前输入框作为第一版硬性要求。
15. 不把 Obsidian 自动写入作为第一版硬性要求。

## Recommended Architecture

推荐采用本地优先架构：

Desktop App → Local API Service → Session Manager → Recorder → STT Adapter → Transcript Merger → Rewrite Adapter → Output Manager → SQLite History Store

桌面端可以使用 Electron 或 Tauri。
本地服务可以使用 Python FastAPI。
本地存储可以使用 SQLite。
STT 和 Rewrite 必须采用 adapter 架构。
整理模式 prompt 必须独立存放为模板文件。

## Acceptance Criteria

1. 用户可以创建一个语音会话。
2. 用户可以在一个会话中录制多个片段。
3. 每个片段都能独立保存音频。
4. 每个片段都能独立转写。
5. 用户可以看到片段列表和每段状态。
6. 用户可以删除片段。
7. 用户可以重试失败片段。
8. 用户点击“完成整理”后，系统能按顺序合并所有有效片段转写。
9. 系统能根据用户选择的模式生成最终文本。
10. 用户可以预览最终文本。
11. 用户可以复制最终文本。
12. 系统能保存完整历史。
13. 历史记录中可以追溯原始音频、每段转写、合并转写和最终结果。
14. 原意清理模式不能明显篡改用户意思。
15. 忠实转录模式不能重组用户内容。
16. Obsidian 模式必须输出合法 Markdown。
17. 任务/需求整理模式必须输出适合 GAEH 使用的结构化文本。
18. STT provider 必须通过 adapter 调用。
19. Rewrite provider 必须通过 adapter 调用。
20. Prompt 模板必须独立存放。
21. VoiceSession 和 VoiceSegment 必须分离建模。
22. 错误处理必须清晰，不应静默失败。

## Context (Optional)

- Existing repo?:
- Target users?:
- Deadline?:
新增内容：你的判断是对的：**这个界面可以作为“调试台 / 工作流验证台”，但不应该成为最终主要使用方式。**

现在这个界面的价值是：证明链路跑通。

```text
新建会话 → 多段录音 → 分段转写 → 合并 → DeepSeek 整理 → 生成终稿
```

但真正的产品价值不是让你每天打开这个大窗口操作，而是把它变成一个**系统级语音输入能力**，能够把整理后的文本投递到你正在使用的程序里。

---

# 一、从用户角度看，现在的问题

现在这个界面像一个“生产车间控制台”，不是“日常输入器”。

它适合做：

```text
测试 API 是否连通
测试豆包转写是否成功
测试 DeepSeek 整理效果
测试多段录音流程
查看片段状态
调试历史会话
```

但它不适合做高频输入，因为用户真正想要的是：

```text
我正在 ChatGPT / Obsidian / Cursor / 浏览器里
我不想切换注意力
我按一个快捷键
说几段话
系统整理好
自动放到我当前要输入的位置
```

所以后续方向应该从“做一个界面”转向“做一个输入基础设施”。

---

# 二、产品形态要重新分层

我建议把它拆成三个层级。

## 第一层：核心引擎

这是你现在已经开始做的部分。

```text
录音
转写
整理
会话
片段
历史
provider adapter
prompt 模板
```

这一层不关心用户在哪里输入，只负责把语音变成文本。

它的输出是：

```json
{
  "raw_transcript": "...",
  "combined_transcript": "...",
  "final_text": "...",
  "mode": "intent_cleanup",
  "session_id": "..."
}
```

这一层应该继续保留，而且要做稳。

---

## 第二层：投递层

这是你下一步真正要建设的核心。

它负责把 `final_text` 送到不同目标：

```text
剪贴板
当前输入框
Obsidian 文件
ChatGPT 网页输入框
Cursor 输入框
GAEH 项目 goal.md
任意程序的文本框
```

这层才是“超级语音输入器”从玩具变成工具的关键。

---

## 第三层：入口层

入口层决定你怎么触发它。

未来不应该主要靠大窗口，而应该有几种入口：

```text
1. 全局快捷键
2. 小悬浮条
3. 系统托盘
4. Obsidian 插件入口
5. Cursor/项目目录入口
6. 右键菜单或快捷命令
```

也就是说，当前大界面应该降级为：

> **工作流面板 / 历史与调试面板**

而不是主入口。

---

# 三、真正应该实现的用户流程

我建议你把未来主流程设计成这样。

## 流程 A：发送到当前输入框

这是最高频场景。

```text
用户正在 ChatGPT / Cursor / 浏览器 / 任何输入框
按全局快捷键 Ctrl + Alt + Space
开始录音
说第一段
按快捷键停止本段
继续说第二段
再次停止
按快捷键完成整理
系统生成文本
自动粘贴到当前输入框
```

用户感受到的不是“打开了一个软件”，而是：

> 我的电脑多了一个智能语音输入能力。

这个才是产品的核心方向。

---

## 流程 B：发送到 Obsidian

```text
按快捷键开始语音会话
说多段想法
选择/默认 Obsidian 笔记模式
完成整理
系统生成 Markdown
写入 Obsidian Inbox 或 Daily Notes
```

结果可以写到：

```text
ObsidianVault/00_Inbox/voice-2026-05-09-1430.md
```

或者：

```text
ObsidianVault/10_Daily/2026-05-09.md
```

这里建议先做 **写入 Inbox**，不要一开始改 Daily Notes，因为 Daily Notes 涉及追加位置、格式冲突、模板等问题。

---

## 流程 C：发送到 GAEH 项目

```text
用户在某个项目目录中
打开超级语音输入器的小入口
口述软件想法
选择“任务/需求整理”
系统生成 goal.md
保存到项目指定目录
```

例如：

```text
project/
  .gaeh/
    inbox/
      voice-goal-2026-05-09.md
```

或者：

```text
project/
  goals/
    voice-goal-super-input.md
```

这就把它变成了你 GAEH 的语音入口。

---

## 流程 D：发送到剪贴板

这是最低风险、最通用的第一步。

```text
语音 → 转写 → 整理 → 复制到剪贴板
```

然后你自己 Ctrl+V。

这个一定要先做稳，因为它兼容所有程序。

---

# 四、下一步不要继续美化大界面，应该先做“投递系统”

你现在最容易走偏的地方是继续优化这个大窗口 UI。
但我认为下一步重点不是美化，而是把输出结果变成“可投递对象”。

也就是说，系统内部要有一个明确的 Output Router。

---

# 五、建议新增核心模块：Output Router

当前流程大概是：

```text
final_text → 显示在页面里 → 用户复制
```

下一步应该改成：

```text
final_text → Output Router → 不同目标
```

建议抽象为：

```text
OutputTarget
  - clipboard
  - active_window
  - obsidian_file
  - gaeh_goal_file
  - markdown_file
  - custom_webhook
```

结构类似：

```python
class OutputTarget:
    def send(self, final_text: str, context: OutputContext) -> OutputResult:
        pass
```

---

# 六、输出目标优先级

我建议按这个顺序推进。

## P0：剪贴板输出

必须最先稳定。

```text
final_text → clipboard
```

验收标准：

```text
1. 生成终稿后自动复制或手动复制。
2. 复制后有明确提示。
3. 保留 final_text，不因复制失败丢失结果。
```

这是所有投递的底座。

---

## P1：当前输入框粘贴

这是最关键的高频能力。

```text
final_text → clipboard → 模拟 Ctrl+V → 当前焦点输入框
```

注意：这里不要一开始追求“识别 ChatGPT 输入框 DOM”这种复杂方式。

最简单、最稳的是：

```text
1. 保存当前焦点窗口
2. 生成 final_text
3. 写入剪贴板
4. 激活原窗口
5. 模拟 Ctrl+V
```

它对大多数程序都有效：

```text
ChatGPT 网页
Claude 网页
Obsidian
Cursor
VS Code
浏览器表单
微信/飞书输入框
普通文本框
```

这才是“超级语音输入器”的真正体验。

---

## P2：Obsidian 文件写入

```text
final_text → 指定 Vault/Inbox 目录 → markdown 文件
```

建议第一版配置：

```text
Obsidian Vault 路径
默认写入目录：00_Inbox
文件名规则：voice-YYYYMMDD-HHmm.md
```

不要一开始做复杂 Obsidian 插件。
先做普通文件写入就够了，因为 Obsidian 本质上就是 Markdown 文件夹。

---

## P3：GAEH 文件写入

```text
final_text → 当前项目 .gaeh/inbox/goal.md
```

这里可以支持一个“项目目录”配置：

```text
项目路径
输出类型：goal / task / bug_report / note
输出目录：.gaeh/inbox/
```

这个对你非常重要，因为它能把语音直接接入你的目标驱动开发流程。

---

## P4：Web/API 投递

后续再考虑：

```text
POST final_text 到本地 API
POST 到 GAEH runner
POST 到某个 agent service
```

这一步先不要急。

---

# 七、界面未来应该变成两种形态

## 形态 1：主控台

就是你现在这个大界面。

用途：

```text
调试
历史查看
配置 provider
查看片段
重新整理
错误排查
```

它可以存在，但不是日常主入口。

---

## 形态 2：迷你悬浮窗

这是未来真正高频使用的形态。

它应该非常小：

```text
┌──────────────────────┐
│  🎙 正在录音 00:18     │
│  [停止本段] [完成整理] │
│  当前：原意清理        │
└──────────────────────┘
```

或者未录音时：

```text
┌──────────────────────┐
│  超级语音输入          │
│  [开始录音]            │
│  模式：原意清理         │
└──────────────────────┘
```

这个小窗才应该常驻、置顶、低干扰。

---

# 八、从用户角度，最终最好是这三种操作

## 1. 快速输入

```text
Ctrl + Alt + Space
说话
Ctrl + Alt + Space 停止
自动整理并粘贴
```

适合短文本。

---

## 2. 多段输入

```text
Ctrl + Alt + Space 开始第一段
Ctrl + Alt + Space 停止第一段并转写
Ctrl + Alt + Space 开始第二段
Ctrl + Alt + Space 停止第二段并转写
Ctrl + Alt + Enter 完成整理并粘贴
```

适合复杂想法。

---

## 3. 语音笔记

```text
Ctrl + Alt + N
说多段
完成整理
自动保存到 Obsidian Inbox
```

适合笔记。

---

# 九、你现在应该让 GAEH 进入下一阶段：从 UI 面板到投递架构

可以给 GAEH 一个明确的新目标：

```markdown
# Goal: 将超级语音输入器从工作流面板升级为系统级文本投递工具

## 背景

当前系统已经实现或初步实现了多段语音会话、转写、整理和终稿预览。但现在主要使用方式仍是打开大界面，在界面中手动查看和复制结果。这不符合超级语音输入器的最终定位。

本工具的真正价值不是作为一个独立大窗口使用，而是作为系统级语音输入能力，将整理后的文本投递到用户正在使用的程序中，例如 ChatGPT、Obsidian、Cursor、浏览器输入框、GAEH 项目目录等。

## 目标

新增 Output Router 和多种输出目标，使 final_text 不仅能显示在界面中，还能被发送到指定位置。

## 主要需求

1. 新增 Output Router 模块。
2. 支持 ClipboardOutputTarget。
3. 支持 ActiveWindowPasteOutputTarget。
4. 支持 MarkdownFileOutputTarget。
5. 支持 ObsidianInboxOutputTarget。
6. 支持 GAEHGoalFileOutputTarget。
7. final_text 生成后可以选择输出目标。
8. 支持默认输出目标配置。
9. 支持生成后自动复制。
10. 支持生成后自动粘贴到原输入窗口。
11. 支持保存到 Obsidian Inbox。
12. 支持保存为 GAEH goal.md。
13. 输出失败不能导致 final_text 丢失。
14. 所有输出动作必须记录到 session history。
15. UI 中增加“输出到”选项，但不要让配置干扰主流程。

## 推荐输出目标优先级

P0：复制到剪贴板  
P1：粘贴到当前输入框  
P2：保存为 Markdown 文件  
P3：保存到 Obsidian Inbox  
P4：保存为 GAEH Goal 文件  
P5：POST 到本地 API 或 Agent 服务

## 验收标准

1. 用户生成终稿后，可以一键复制 final_text。
2. 用户可以选择“粘贴到当前输入框”。
3. 系统能将 final_text 写入剪贴板并模拟 Ctrl+V。
4. 用户可以配置 Obsidian Vault 路径。
5. 系统能将 Obsidian 模式输出保存为 Markdown 文件。
6. 用户可以配置 GAEH 项目目录。
7. 系统能将任务/需求模式输出保存为 goal.md 或带时间戳的 goal 文件。
8. 每次输出动作都有明确成功或失败提示。
9. 输出失败时 final_text 仍保留在会话中。
```

---

# 十、当前界面具体怎么改

你现在这个界面不需要推倒，但要改变定位。

## 保留

```text
会话与输出样式
录音
片段进度
DeepSeek 生成终稿
历史会话
API 状态
```

## 增加

```text
输出目标
默认动作
生成后自动处理
```

例如在“DeepSeek 生成终稿”区域加入：

```text
输出到：
[仅预览] [复制到剪贴板] [粘贴到当前输入框] [Obsidian Inbox] [GAEH Goal]
```

终稿生成按钮改成两段式：

```text
[生成终稿]
[发送到目标]
```

或者更高频：

```text
[生成并粘贴]
[生成并复制]
[生成并保存到 Obsidian]
```

但不要把按钮搞太多。建议第一版只做：

```text
默认输出目标：剪贴板
[生成终稿]
[复制终稿]
[发送到...]
```

---

# 十一、最重要的架构原则

你要避免让 UI 组件直接决定输出逻辑。

不要这样：

```text
React Button → 直接写文件 / 直接粘贴 / 直接调系统 API
```

应该这样：

```text
React Button
  ↓
POST /api/sessions/{id}/outputs
  ↓
OutputRouter
  ↓
具体 OutputTarget
```

这样以后加 Obsidian、GAEH、Cursor、Webhook 都不会乱。

---

# 十二、建议最终产品路线

## Phase A：当前工作流面板补全

目标：让当前界面完整可用。

```text
1. 多段录音稳定
2. 片段列表稳定
3. 合并转写稳定
4. 四种整理模式稳定
5. 终稿预览稳定
6. 复制终稿稳定
```

---

## Phase B：Output Router

目标：让结果可以投递。

```text
1. clipboard
2. active window paste
3. markdown file
4. obsidian inbox
5. gaeh goal file
```

---

## Phase C：全局快捷键 + 小悬浮窗

目标：让它变成日常工具。

```text
1. 全局快捷键开始录音
2. 悬浮窗显示状态
3. 快捷键停止本段
4. 快捷键完成整理
5. 自动投递到默认目标
```

---

## Phase D：场景预设

目标：减少每次选择。

```text
预设 1：发给 ChatGPT
模式：原意清理
输出：当前输入框

预设 2：写入 Obsidian
模式：Obsidian 笔记
输出：Obsidian Inbox

预设 3：生成 GAEH Goal
模式：任务/需求整理
输出：GAEH 项目目录

预设 4：忠实转录
模式：忠实转录
输出：剪贴板
```

---

# 十三、我的总体建议

现在不要继续把它当成“大窗口应用”来完善。
你应该把它重新定义为：

> **一个有调试面板的系统级语音输入服务。**

当前大界面只是控制台。真正的产品应该是：

```text
全局快捷键
小悬浮窗
多段录音
自动整理
投递到当前程序
保存到指定目标
```

下一步最关键的建设不是 UI，而是：

```text
Output Router
Active Window Paste
Obsidian File Output
GAEH File Output
```

一句话：

> 你已经做出了“语音到终稿”的工作台；下一步要做“终稿到工作现场”的投递系统。

