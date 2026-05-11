Idea：超级语音输入器的真实产品形态与使用方法
1. 一句话定义

超级语音输入器不是普通语音输入法，也不是单纯录音转文字工具，而是一个面向个人思考、写作、笔记、AI 对话、GAEH 工作流和编程任务的 语音思想采集与文本投递工具。

它的核心价值是：

用户可以用语音分段说出混乱、不完整、跳跃的想法，系统自动转写、整理、澄清，并根据用户选择的场景，将结果变成可用文本，投递到正确位置。

2. 核心问题

用户在日常工作中经常遇到长文本输入需求，例如：

向 ChatGPT / Claude 提问
给 Cursor / Codex 描述编程任务
记录 Obsidian 笔记
生成 GAEH Goal
梳理混乱想法
忠实保存一段口述

普通语音输入法只能解决：

我说什么 → 它尽量转成什么

但用户真正需要的是：

我说一段混乱的想法
↓
系统帮我转写
↓
系统帮我整理和澄清
↓
系统把它变成适合当前用途的文本
↓
系统把文本复制、粘贴或写入目标位置

因此，本产品不能只围绕“转写”设计，而应围绕：

场景 → 多段录音 → 分段转写 → 合并整理 → 输出投递

来设计。

3. 当前产品方向的关键判断
3.1 不再把“单段录音”作为核心形态

用户真实思考不是一次性完整表达，而是：

先说一点
再补充一点
发现前面没说清楚
再修正一点
最后希望系统统一整理

所以产品核心应是：

VoiceSession + VoiceSegment

即：

一个语音会话包含多个语音片段

每个片段独立录音、独立保存、独立转写；最后按顺序合并，再根据场景整理成最终文本。

3.2 会话是系统内部对象，不应强迫用户每次手动创建

VoiceSession 在技术上是必要的，但从用户体验上，不应该要求用户每次先点击“新建会话”才能录音。

正确行为应该是：

用户点击开始录音
↓
系统检查当前是否有可用会话
↓
如果没有，则自动创建会话
↓
立即开始录音

也就是说：

用户可以手动新建会话，但“新建会话”不应是录音前的必需步骤。

3.3 用户入口应是“本次场景”，不是“整理模式 + 投递目标”

之前界面同时暴露了：

场景预设
整理模式
投递目标
转写引擎
整理引擎

这会让用户困惑。

用户真正关心的是：

我这次语音想用来做什么？

所以主界面应只暴露一个核心选择：

本次场景

例如：

思考澄清
发给 AI 对话框
写入 Obsidian Inbox
生成 GAEH Goal
生成编程任务
忠实转录

系统内部再根据场景自动映射：

场景 → 整理模式 mode → prompt 模板 → 默认投递目标 output_target
3.4 整理模式是内部机制，不是主界面概念

整理模式仍然需要存在，例如：

clean_intent
thinking_clarify
obsidian_note
gaeh_goal
coding_task
faithful_transcript

但它们不应该默认暴露在主界面，与场景并列让用户选择。

正确方式：

用户选择：本次场景
系统内部决定：整理模式 + prompt + 默认投递目标

“整理模式”“投递目标”“转写引擎”“整理引擎”可以保留在高级设置里，用于调试或覆盖默认行为。

3.5 工作台和悬浮窗必须分工

当前产品存在两个界面：

工作台主界面
悬浮窗入口

它们不应该承担相同职责。

工作台的职责

工作台是完整控制台，用于：

选择场景
填写标题
查看会话
查看所有片段
查看每段转写
删除片段
重试转写
重新整理
查看最终结果
选择投递方式
查看历史会话
配置 API / 路径 / 引擎
调试错误

工作台适合“认真整理”和“管理调试”。

悬浮窗的职责

悬浮窗是快速入口，用于：

选择当前场景
开始录音
停止本段并转写
查看已有片段数量/状态
完成整理
复制或投递

悬浮窗不应要求用户先打开主面板，也不应让用户先新建会话。

悬浮窗应能独立完成基础流程：

选场景 → 录音 → 停止本段 → 再录一段 → 完成整理 → 投递
4. 产品核心使用流程
4.1 最常用流程：悬浮窗快速输入
用户打开悬浮窗
↓
默认使用上次场景，或默认“思考澄清”
↓
用户可以轻量切换场景
↓
点击开始录音
↓
如果没有当前会话，系统自动创建会话
↓
用户说第一段
↓
点击停止本段并转写
↓
系统创建 VoiceSegment，保存音频，并转写该段
↓
用户继续录第二段、第三段
↓
用户点击完成整理
↓
系统合并所有已转写片段
↓
系统根据场景对应 prompt 生成 final_text
↓
系统按默认投递目标复制、粘贴或写入文件

用户不需要手动理解：

VoiceSession
VoiceSegment
mode
output_target
prompt_template

这些是系统内部概念。

4.2 工作台正式整理流程
用户打开工作台
↓
选择本次场景
↓
可填写标题
↓
可以手动新建会话，也可以直接点击录音自动创建
↓
多段录音
↓
查看每个片段转写状态
↓
删除错误片段或重试转写
↓
点击完成整理
↓
查看 combined_transcript 和 final_text
↓
复制或投递到目标位置
↓
可保存历史，后续重新整理

工作台不是高频入口，而是完整管理和审查界面。

5. 场景预设设计

系统应使用“场景预设”作为用户入口。

每个场景预设都包含：

preset_id
label
description
mode
prompt_template
default_output_target
5.1 场景 1：思考澄清
用户看到的名称
思考澄清
用途

适合用户自己也没完全想清楚，只是想把混乱想法先说出来。

目标

帮助用户提炼：

真正想说的是什么
已经说清楚的部分
真正困惑的部分
隐含的深层问题
整理后的表达稿
下一步可以追问的问题
内部配置
{
  "id": "thinking_clarify",
  "label": "思考澄清",
  "mode": "thinking_clarify",
  "output_target": "preview",
  "description": "适合想法混乱时，提炼真实问题、核心困惑和下一步。"
}
5.2 场景 2：发给 AI 对话框
用户看到的名称
发给 AI 对话框
用途

适合把口述内容整理成可以直接发给 ChatGPT、Claude、Cursor 等 AI 工具的问题或说明。

目标

生成自然、清楚、忠实原意的文本，不做过度分析。

内部配置
{
  "id": "send_to_ai",
  "label": "发给 AI 对话框",
  "mode": "clean_intent",
  "output_target": "clipboard",
  "description": "整理成自然清楚的问题或表达，适合粘贴到 ChatGPT、Claude、Cursor。"
}
5.3 场景 3：写入 Obsidian Inbox
用户看到的名称
写入 Obsidian Inbox
用途

适合把语音整理成 Markdown 笔记，保存到 Obsidian。

目标

生成包含标题、摘要、主要内容、关键想法、待办/后续问题的 Markdown 笔记。

内部配置
{
  "id": "obsidian_inbox",
  "label": "写入 Obsidian Inbox",
  "mode": "obsidian_note",
  "output_target": "obsidian_inbox",
  "description": "整理成 Markdown 笔记，并写入 Obsidian Inbox。"
}
5.4 场景 4：生成 GAEH Goal
用户看到的名称
生成 GAEH Goal
用途

适合把软件想法、工具想法、流程想法整理成 GAEH 可消费的目标文档。

目标

生成：

Goal
Background
Problem
Objective
Requirements
Non-goals
Acceptance Criteria
Notes / Open Questions
内部配置
{
  "id": "gaeh_goal",
  "label": "生成 GAEH Goal",
  "mode": "gaeh_goal",
  "output_target": "gaeh_inbox",
  "description": "整理成 GAEH 可消费的目标文档。"
}
5.5 场景 5：生成编程任务
用户看到的名称
生成编程任务
用途

适合把口述需求整理成 Cursor、Codex、Claude Code 可以执行的开发任务。

目标

生成：

Task
Current Problem
Required Change
Scope
Files / Modules
Constraints
Acceptance Criteria
Test Requirements
内部配置
{
  "id": "coding_task",
  "label": "生成编程任务",
  "mode": "coding_task",
  "output_target": "clipboard",
  "description": "整理成 Cursor / Codex / Claude Code 可执行的开发任务。"
}
5.6 场景 6：忠实转录
用户看到的名称
忠实转录
用途

适合保留原始口述，例如自传、经历、故事素材、访谈、原始记录。

目标

尽量保留原始表达、原始顺序和口述风格，只做标点、断句和明显识别错误修正。

内部配置
{
  "id": "faithful_transcript",
  "label": "忠实转录",
  "mode": "faithful_transcript",
  "output_target": "clipboard",
  "description": "尽量保留原始表达，只做标点、断句和明显错字修正。"
}
6. 会话自动创建规则

系统必须支持自动创建会话。

6.1 规则一：开始录音时确保会话存在

当用户点击“开始录音”时：

如果当前没有 session：
    根据当前 selectedPreset 自动创建 session
    设置 session.preset_id
    设置 session.mode
    设置 session.output_target
    设置 session.status = open / draft
    设置默认标题
    然后开始录音

如果当前有 open/draft session：
    直接在当前 session 下创建新 segment 并开始录音

用户不应因为没有会话而被阻止录音。

6.2 默认标题规则

自动创建会话时，标题可以自动生成：

{场景名称} YYYY-MM-DD HH:mm

例如：

思考澄清 2026-05-11 14:30
写入 Obsidian Inbox 2026-05-11 14:32
生成 GAEH Goal 2026-05-11 14:35

用户可在工作台中修改标题。

6.3 当前会话状态规则
open / draft

如果当前会话状态是 open 或 draft，继续录音表示：

向当前会话追加一个 VoiceSegment
completed

如果当前会话已经 completed，用户再次点击录音，默认应该：

创建新会话

避免把新主题误追加到旧会话。

如用户确实想继续补充旧会话，应通过：

追加补充

或在工作台中手动操作。

6.4 切换场景规则

如果当前会话没有片段：

可以直接切换场景

如果当前会话已有片段，用户切换场景时，应提示：

当前会话已有片段，切换场景会影响最终整理方式。

第一版可以允许直接切换，但必须同步更新：

session.preset_id
session.mode
session.output_target

后续可以提供两个选项：

仅切换当前会话场景
新建会话并使用该场景
7. 工作台设计原则

工作台是完整控制台。

7.1 工作台主界面应显示
本次场景
标题
新建会话
高级设置
录音区域
片段列表
完成整理区域
输出预览
投递按钮
历史入口

但主界面第一优先级是：

本次场景 + 开始录音

而不是：

新建会话
整理模式
转写引擎
整理引擎
7.2 新建会话按钮的定位

工作台中可以保留“新建会话”按钮，但它不是录音前必需步骤。

它的定位是：

主动开始新主题

而不是：

每次录音前都必须点击

无会话状态下，工作台提示应改成：

点击“开始录音”将自动创建会话；也可以先填写标题后新建会话。

不应只显示：

尚未创建会话
7.3 高级设置

高级设置可以包含：

整理模式 mode
投递目标 output_target
转写引擎
整理引擎
prompt 通道

默认折叠。

普通使用时，用户不需要理解这些。

8. 悬浮窗设计原则

悬浮窗是快速入口，不是完整工作台。

8.1 悬浮窗必须支持的能力
显示当前场景
切换当前场景
开始录音
停止本段并转写
显示片段数量与状态
完成整理
复制或投递
打开工作台
8.2 悬浮窗不应显示
整理模式
转写引擎
整理引擎
复杂投递配置
完整历史管理
完整片段编辑

这些放到工作台。

8.3 悬浮窗无会话时的行为

无会话时，悬浮窗不应提示用户必须打开主面板或先新建会话。

正确提示：

点击录音将自动创建会话。

点击录音后：

自动创建会话
立即开始录音
8.4 悬浮窗中的新建会话

悬浮窗可以有“新建会话”，但应是次要操作。

可以放在：

更多菜单

或者作为小按钮：

新会话

但主按钮必须是：

开始录音
9. 提示词通道设计

每个场景对应一个内部 mode，每个 mode 对应独立 prompt 模板。

9.1 模式列表
clean_intent
thinking_clarify
obsidian_note
gaeh_goal
coding_task
faithful_transcript
9.2 模板文件
server/modes/clean_intent.md
server/modes/thinking_clarify.md
server/modes/obsidian_note.md
server/modes/gaeh_goal.md
server/modes/coding_task.md
server/modes/faithful_transcript.md
9.3 处理流程
用户选择场景
↓
系统得到 mode
↓
系统加载对应 prompt 模板
↓
填入 combined_transcript
↓
调用整理引擎
↓
生成 final_text

UI 不应硬编码 prompt 内容。

10. 投递目标设计

投递目标是内部机制，由场景默认决定，也可在高级设置中覆盖。

10.1 基础投递目标
preview
clipboard
foreground_paste
markdown_file
obsidian_inbox
gaeh_inbox
10.2 投递优先级

应先保证：

clipboard
markdown_file
obsidian_inbox
gaeh_inbox

稳定。

foreground_paste 只在 Electron 桌面版可用，不应作为唯一主路径。

10.3 前台粘贴能力边界

前台粘贴需要 Electron 桌面能力。

普通浏览器环境不能模拟 Ctrl+V 到其他程序。

所以系统应检测 runtime capability：

如果 window.svi.pasteForeground 存在：
    foreground_paste 可用
否则：
    禁用 foreground_paste
    提示“仅 Electron 桌面版支持”

前台粘贴是增强体验，不是核心依赖。

11. 文件投递路径配置

以下投递需要路径配置：

SVI_MARKDOWN_OUTPUT_DIR
OBSIDIAN_VAULT_ROOT
SVI_GAEH_PROJECT_ROOT

它们含义分别是：

普通 Markdown 输出目录
Obsidian Vault 根目录
GAEH 项目根目录

未配置时，不应等用户点击后才报 400。系统应在 UI 上提前显示不可用状态。

建议提供：

GET /api/output/capabilities

返回每个 output_target 是否可用及原因。

12. 数据模型核心要求
12.1 VoiceSession

VoiceSession 表示一次多段语音会话。

至少包含：

id
title
preset_id
mode
output_target
status
combined_transcript
final_text
created_at
updated_at
error_message
12.2 VoiceSegment

VoiceSegment 表示会话中的一个录音片段。

至少包含：

id
session_id
order_index
audio_file_path
duration_seconds
raw_transcript
status
stt_provider
created_at
error_message
12.3 状态

VoiceSession 状态建议：

draft / open
processing
completed
error
archived

VoiceSegment 状态建议：

recording
recorded
transcribing
transcribed
transcribe_error
deleted
13. 主状态机

产品应围绕以下状态运行：

idle_no_session
draft_empty
recording
transcribing
draft_with_segments
rewriting
completed
error

关键原则：

idle_no_session 状态下，“开始录音”也必须可用。

按钮行为：

状态	主按钮	说明
idle_no_session	开始录音	自动创建会话并开始录音
draft_empty	开始录音	在当前会话录第一段
recording	停止本段并转写	保存片段并转写
transcribing	等待 / 继续录音	片段转写中
draft_with_segments	继续录音 / 完成整理	可补充或生成终稿
rewriting	生成中	禁止重复提交
completed	复制 / 投递 / 新会话	已生成结果
error	重试 / 查看错误	错误恢复
14. 用户不应面对的内部概念

主界面和悬浮窗中不应强迫用户理解：

VoiceSession
VoiceSegment
mode
prompt_template
output_target
provider adapter
runtime capability

这些可以在高级设置、调试信息或开发者视图中出现。

用户主要面对：

本次场景
开始录音
停止本段
完成整理
复制 / 投递
15. 未来产品形态

最终产品应有两个形态：

15.1 工作台

用于完整管理：

调试
历史
片段
重试
重新整理
路径配置
引擎配置
错误处理
15.2 悬浮窗

用于日常高频输入：

选场景
录音
停止
完成整理
投递

真正的高频使用入口应该是悬浮窗，而不是工作台。

16. 不要做的事情

当前阶段不应做：

不做复杂 agent
不做自动判断用户意图
不做复杂 workflow routing
不把整理模式和场景并列暴露
不要求用户每次手动新建会话
不把前台粘贴作为唯一输出方式
不把大工作台作为唯一使用入口
不在 UI 里硬编码 prompt
不让用户面对过多模型和引擎选择
17. 当前阶段的建设目标

本阶段要把产品从“工作流面板”升级为：

以场景为入口、自动管理会话、支持悬浮窗快速录音的语音思想输入工具。

最重要的目标是：

用户选择场景
↓
点击录音
↓
系统自动创建会话
↓
多段录音
↓
系统按场景整理
↓
系统按场景投递
18. 可以交给 GAEH 的核心 Goal 草案
# Goal: 将超级语音输入器升级为以场景为入口的多段语音思想输入工具

## Background

当前超级语音输入器已经具备多段录音、转写、整理、工作台和悬浮窗雏形。但当前使用方式仍存在几个问题：

1. 用户每次使用前需要手动新建会话，打断高频输入流程。
2. 工作台和悬浮窗职责不够清晰。
3. 悬浮窗还不能作为真正独立的快速入口。
4. 界面曾同时暴露“场景预设”和“整理模式”，导致用户需要理解内部概念。
5. 用户真正关心的是“本次语音要用来做什么”，而不是手动组合 mode、prompt、output_target。
6. 前台粘贴、文件投递、Obsidian、GAEH 等输出目标需要作为投递机制处理，而不是干扰主流程。

## Objective

将系统改造成以“本次场景”为用户入口的语音思想输入工具。

用户只需选择场景，例如：

- 思考澄清
- 发给 AI 对话框
- 写入 Obsidian Inbox
- 生成 GAEH Goal
- 生成编程任务
- 忠实转录

系统根据场景自动决定整理模式、prompt 模板和默认投递目标。

用户点击“开始录音”时，如果当前没有会话，系统应自动创建会话，不应要求用户先手动新建会话。

悬浮窗应成为真正的快速入口，支持选择场景、开始录音、停止本段、完成整理和投递。

## Main Requirements

1. 主界面只保留一个一级用户选择：“本次场景”。
2. 场景预设内部映射到：
   - mode
   - prompt_template
   - default_output_target
3. 不再在主界面并列暴露“场景预设”和“整理模式”。
4. 整理模式、投递目标、转写引擎、整理引擎放入高级设置。
5. 系统支持以下场景：
   - 思考澄清
   - 发给 AI 对话框
   - 写入 Obsidian Inbox
   - 生成 GAEH Goal
   - 生成编程任务
   - 忠实转录
6. 每个场景必须有独立 prompt 通道。
7. 点击“开始录音”时必须调用 ensureCurrentSession。
8. 如果没有当前 session，系统自动根据当前场景创建 session。
9. 自动创建 session 后立即开始录音。
10. 如果当前 session 是 open/draft，继续录音应追加 VoiceSegment。
11. 如果当前 session 是 completed，再次录音应默认创建新 session。
12. 新建会话按钮保留，但降级为“开始新主题”的次要操作。
13. 工作台用于管理、调试、历史、片段和配置。
14. 悬浮窗用于快速录音和投递。
15. 悬浮窗必须显示并允许切换当前场景。
16. 悬浮窗无会话时，点击录音也应自动创建会话。
17. 工作台和悬浮窗共享 selectedPreset。
18. 切换场景时，应同步更新 session.mode 和 output_target。
19. final_text 的生成必须根据 session.mode 加载对应 prompt 模板。
20. output_target 由场景默认决定，可在高级设置中覆盖。
21. 前台粘贴仅在 Electron 桌面版支持，不应作为唯一输出路径。
22. 文件投递路径未配置时，应在 UI 中提前显示不可用，而不是点击后才报 400。
23. final_text 生成后不得因投递失败而丢失。
24. VoiceSession 与 VoiceSegment 必须继续保持分离建模。
25. 用户主流程中不应被迫理解 mode、prompt、output_target 等内部概念。

## Acceptance Criteria

1. 打开应用后，不点击“新建会话”，直接点击“开始录音”可以开始录音。
2. 系统会自动创建 session。
3. 自动创建的 session 使用当前选中的场景。
4. 自动创建的 session 有合理默认标题。
5. 主界面只显示“本次场景”作为一级用途选择。
6. 主界面不再并列显示“场景预设”和“整理模式”。
7. 选择“思考澄清”时，系统使用 thinking_clarify prompt。
8. 选择“发给 AI 对话框”时，系统使用 clean_intent prompt。
9. 选择“写入 Obsidian Inbox”时，系统使用 obsidian_note prompt，并默认投递到 obsidian_inbox。
10. 选择“生成 GAEH Goal”时，系统使用 gaeh_goal prompt。
11. 选择“生成编程任务”时，系统使用 coding_task prompt。
12. 选择“忠实转录”时，系统使用 faithful_transcript prompt。
13. 悬浮窗可以显示当前场景。
14. 悬浮窗可以切换当前场景。
15. 悬浮窗无会话时可以直接点击录音。
16. 悬浮窗点击录音后自动创建会话并开始录音。
17. 工作台和悬浮窗场景同步。
18. 已完成会话后再次录音默认创建新会话。
19. 新建会话按钮不再是录音前必需步骤。
20. 高级设置中仍可查看或覆盖 mode、output_target、转写引擎、整理引擎。
21. prompt 模板不硬编码在 UI 中。
22. Output Router 根据 output_target 投递。
23. 投递失败不导致 final_text 丢失。
19. 最终产品思想总结

这个产品最终不应让用户感觉自己在“配置一个转写系统”。

它应该让用户感觉：

我只要选择这次语音的用途，然后开始说。
系统会帮我创建会话、分段转写、整理成适合用途的文本，并投递到该去的地方。

最核心的产品原则是：

用户选择场景，不选择内部机制。
用户点击录音，不手动管理会话。
悬浮窗负责快速使用，工作台负责管理调试。
多段录音是默认能力，自动会话是默认行为。
prompt 通道由场景决定，投递目标由场景默认决定。

一句话：

超级语音输入器应该成为一个“以场景为入口的语音思想输入系统”，而不是一个需要用户手动配置会话、模式和投递方式的技术面板