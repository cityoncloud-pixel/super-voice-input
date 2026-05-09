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

