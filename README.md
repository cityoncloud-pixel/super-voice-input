# GAEH (Goal-Driven AI Engineering Harness)

这套模板用于把任意工程项目变成“可被 AI 按统一流程推进”的落地骨架：Owner 只负责目标/边界/验收与同意门禁；AI 负责工程拆解、实现、验证、报告与修复。

## Quick Start (Owner)
1) 填写/生成目标：
- 简单写：`project_control/goal.md`
- 或使用 GGS：编辑 `project_control/.ggs/idea.md`，再把 `project_control/.ggs/templates/runner.prompt.md` 粘贴给 Codex/Cursor 执行一次

2) 发起执行（先澄清，后同意门禁）：
把下面这句话发给 Codex/Cursor（或运行 `gaeh start` 复制输出）：
> 按 GAEH 流程开始：先检查 goal 是否清晰（尤其边界与 UI 交互），再给出最小问题清单；目标清晰后必须先征得我同意（等待我回复 APPROVE）再开始连续实现到验收完成，并把过程落盘到 plans/reviews/reports 与 project_control/*.md。

3) 同意执行：
- 对话中回复：`APPROVE`
- 或修改：`project_control/approval.json` / 使用 `gaeh approve`

## Governance
- Tiny Fix 允许不写 spec/plan，但必须：最小验证 + report + decision_log + task_queue 同步。
- 发现问题（已完成但不对）：把复现写到 `project_control/issues.md`，AI 先给“可能原因 + 证据收集计划”，定位根因后修复并回归验证。
- 新要求/变更：追加到 `project_control/change_requests.md`，必要时更新 `project_control/goal.md`，并再次征得同意后继续。

## Super Voice Input — Local API & Providers

- Install deps: `pip install -r requirements.txt`
- Run API: `uvicorn local_api.main:app --reload --host 0.0.0.0 --port 8000`
- Open docs: `http://127.0.0.1:8000/docs`
- Run tests: `pytest -q`（测试时会自动设置 `SVI_TEST_MODE`，不使用真实豆包/DeepSeek）
- Copy `.env.example` → `.env`，填入密钥（勿提交 `.env`）。

**生产行为（非测试）：**

- 转写：`provider=doubao`，必须配置 `DOUBAO_API_KEY`、`DOUBAO_RESOURCE_ID`。本项目与 verstory 对齐，`DOUBAO_RESOURCE_ID` 推荐使用 `volc.seedasr.auc`（或 `volc.bigasr.auc`）。接口遵循官方「录音文件识别标准版」：`submit` → `query` 轮询，直至 `X-Api-Status-Code=20000000`。参见火山文档：[大模型录音文件识别标准版API](https://www.volcengine.com/docs/6561/1354868)。
- 豆包云端只能访问 **公网可达** 的音频 URL。推荐两种方式之一：
  0. **桌面端自动隧道（推荐）**：安装 `cloudflared` 后直接运行桌面端即可，应用会自动建立临时公网地址并配置给后端（无需手动填 `SVI_PUBLIC_BASE_URL`）。
  1. **内网穿透（ngrok 联调）**：
     - 终端 A：在项目根启动 API：`python -m uvicorn local_api.main:app --host 127.0.0.1 --port 8000`（端口与 `.env` 里 `SVI_API_PORT` 一致）。
     - 终端 B：`ngrok http 8000`，复制 **`https://xxxx.ngrok-free.app`**（以 ngrok 控制台为准）。
     - 在 `.env` 设置 **`SVI_PUBLIC_BASE_URL=https://xxxx.ngrok-free.app`**（无尾部斜杠），**重启 uvicorn**。
     - 自检：浏览器或 `curl` 访问 `https://xxxx.ngrok-free.app/health` 应返回 JSON；录音转写时豆包会请求 `https://xxxx.ngrok-free.app/files/audio/{session_id}/{filename}`（本仓库已实现该路由）。
     - 单元测试：`pytest tests/test_doubao_audio_url.py -q`（校验 URL 拼接，不调火山）。
  2. **自建前缀**：若已有对象存储/CDN URL，设置 `DOUBAO_AUDIO_URL_PREFIX`，使本地 `data/audio/...` 路径能映射成完整 https URL。
- 改写：`provider=deepseek`，必须配置 `DEEPSEEK_API_KEY`。

**默认 HTTP 基址**：`DOUBAO_BASE_URL=https://openspeech.bytedance.com/api/v3`（OpenSpeech，与官方示例一致）。

Current scope:
- Session create/list/get
- Segment add/delete/retry transcribe
- Segment upload (`/sessions/{id}/segments/upload`)
- Segment rerecord
- Session finalize (`combined_transcript` + `final_text`)
- Session refinalize (history re-organization)
- Prompt templates in `prompts/`

## Desktop App (Electron)

- `npm install`
- `npm run desktop` — **会自动在本机启动** `uvicorn`（工作目录为仓库根目录）。若你已手动起 API，可先设置环境变量 `SVI_SKIP_BACKEND=1` 再启动 Electron。
- **自动重启（开发）**：
  - **`npm run dev`**（推荐）：并行 **`dev:api`**（`uvicorn --reload`，改 `local_api/` 等 Python 即重启）与 **`dev:electron`**（`electronmon` 监视 `desktop/` 下 js/html/css，改界面即重启 Electron）。Electron 使用 `SVI_SKIP_BACKEND=1`，不再自带起第二个 uvicorn；请保证 `.env` 里 **`SVI_API_PORT` 与 `dev:api` 端口一致**（默认 **8000**）。
  - **`npm run desktop:reload`**：单进程模式，仍由 Electron 拉起 uvicorn，子进程带 **`--reload`**（已设置 `SVI_UVICORN_RELOAD`）；改 `local_api` 会由 uvicorn 重载。改 `desktop/` 时更推荐用上面的 **`npm run dev`**（`electronmon` 会重载/重启窗口）。
- 托盘图标 + **Ctrl+Shift+V** 显示/隐藏**主面板**；关闭窗口默认隐藏到托盘（托盘菜单退出会结束后端进程）。
- **全局快捷键（悬浮窗）**：**Ctrl+Alt+Space** 切换本段录音；**Ctrl+Alt+Enter** 触发整理（需已有会话且存在可整理片段）。托盘菜单可「显示悬浮窗」。
- **入口分层**：默认启动 **主工作台 + 悬浮窗**；若只要主窗，在 `.env` 设置 **`SVI_SHOW_OVERLAY_ON_START=0`**。悬浮窗仍可通过托盘或 **`Ctrl+Alt+Space` / `Ctrl+Alt+Enter`** 按需创建（无需提前打开）。
- **单实例**：同一时间只允许运行 **一个** Electron 进程；否则可能拉起第二个 uvicorn，导致 **API 端口占用(10048)**。第二次启动会聚焦已有窗口。
- **工作台与悬浮窗共用逻辑**：`desktop/renderer/svi-shared.js` 统一 **录音 MIME 选择、`MediaRecorder` 构造、`/segments/upload` multipart** 与 **`fetchApi` 错误提示**，避免两套请求不一致。
- **Output Router**：终稿投递走 `POST /sessions/{id}/outputs`（见 OpenAPI）。剪贴板与「粘贴到前台窗口」由 **Electron 主进程**执行并回报 `output-feedback`；Markdown / Obsidian Inbox / GAEH 文件由 **后端**写入（路径见 `.env.example`）。
- **场景预设**：后端 `GET /presets` 提供内置预设；主面板可选预设并「按预设默认投递」。
- **界面流程（主面板）**：① 新建会话并选择整理模式（可选场景预设）→ ② 录音（实时波形）→ 每段「停止」后自动上传并由豆包转写 → ③ 列表查看片段 → ④ 一键「DeepSeek 生成终稿」→ ⑤ 投递区（剪贴板 / 前台粘贴 / 文件类）。
- **录音权限**：窗口内容由内置 **HTTP（127.0.0.1 随机端口）** 提供而非 `file://`，以满足 Chromium 对麦克风所需的「安全上下文」；否则会出现点击录音无声 / `getUserMedia` 被拒绝。
- 录音上传后会 **默认自动转写**（`upload?auto_transcribe=true`）。

### 分发说明（G5）

当前官方路径为 **源码 + 依赖安装**（`pip` + `npm`）；未附带独立 `.exe` 安装包。若需 `electron-builder` 一键打包，可在后续迭代追加脚本与 CI。

