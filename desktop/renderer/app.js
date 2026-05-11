/**
 * 桌面端：新建会话 → 多段录音（波形）→ 每段停止后自动上传+豆包转写 → 一键 DeepSeek 生成终稿。
 */

const apiBase =
  (typeof window !== "undefined" && window.svi && window.svi.apiBase) || "http://127.0.0.1:8000";

const DEFAULT_STT = "doubao";
const DEFAULT_REWRITE = "deepseek";

/** 由「本次场景」选项的 default_output_target 同步；用于「按场景默认投递」 */
let presetDefaultOutputTarget = "clipboard";

/** GET /use-cases 缓存，供离线同步说明文案 */
let cachedUseCases = [];

/** GET /modes 失败时的回退；键须与后端 RewriteMode / registry id 一致 */
const MODE_LABELS_FALLBACK = {
  clean_intent: "原意清理 · 适合对话框粘贴",
  thinking_clarify: "思考澄清 · 提炼困惑与下一步",
  obsidian_note: "Obsidian 笔记 · Markdown",
  gaeh_goal: "GAEH Goal · 目标文档",
  coding_task: "编程任务 · 可执行施工说明",
  faithful_transcript: "忠实转录 · 少改动",
};

let currentSessionId = null;
let lastSegments = [];
let pollId = null;
let pollUntil = 0;

const el = {};
function bindEl() {
  el.health = document.getElementById("health");
  el.statusLine = document.getElementById("statusLine");
  el.sessionTitle = document.getElementById("sessionTitle");
  el.useCaseSelect = document.getElementById("useCaseSelect");
  el.useCaseHint = document.getElementById("useCaseHint");
  el.sessionMode = document.getElementById("sessionMode");
  el.rewriteProvider = document.getElementById("rewriteProvider");
  el.sttProvider = document.getElementById("sttProvider");
  el.createSessionBtn = document.getElementById("createSessionBtn");
  el.sessionSummary = document.getElementById("sessionSummary");
  el.waveCanvas = document.getElementById("waveCanvas");
  el.recordTimer = document.getElementById("recordTimer");
  el.startRecordBtn = document.getElementById("startRecordBtn");
  el.stopRecordBtn = document.getElementById("stopRecordBtn");
  el.segments = document.getElementById("segments");
  el.finalText = document.getElementById("finalText");
  el.finalizeBtn = document.getElementById("finalizeBtn");
  el.copyBtn = document.getElementById("copyBtn");
  el.outClipboardBtn = document.getElementById("outClipboardBtn");
  el.outPasteBtn = document.getElementById("outPasteBtn");
  el.outMdBtn = document.getElementById("outMdBtn");
  el.outObsidianBtn = document.getElementById("outObsidianBtn");
  el.outGaehBtn = document.getElementById("outGaehBtn");
  el.outPresetBtn = document.getElementById("outPresetBtn");
  el.refinalizeMode = document.getElementById("refinalizeMode");
  el.refinalizeBtn = document.getElementById("refinalizeBtn");
  el.audioPath = document.getElementById("audioPath");
  el.audioDuration = document.getElementById("audioDuration");
  el.addSegmentBtn = document.getElementById("addSegmentBtn");
  el.history = document.getElementById("history");
  el.refreshHistoryBtn = document.getElementById("refreshHistoryBtn");
  el.clearHistoryBtn = document.getElementById("clearHistoryBtn");
  el.toast = document.getElementById("toast");
}

/** ---------- API（与悬浮窗共用 svi-shared.js） ---------- */
async function api(path, options = {}) {
  if (!window.SVI_SHARED || typeof window.SVI_SHARED.fetchApi !== "function") {
    throw new Error("缺少 svi-shared.js：请确认 index.html 中先于 app.js 加载。");
  }
  return window.SVI_SHARED.fetchApi(apiBase, path, options);
}

function showToast(message, isError) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  el.toast.classList.toggle("error", !!isError);
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    el.toast.hidden = true;
  }, 5200);
}

function setStatus(text) {
  el.statusLine.textContent = text;
}

/** ---------- Modes ---------- */
function builtinModeRows() {
  return Object.keys(MODE_LABELS_FALLBACK).map((id) => ({
    id,
    name: MODE_LABELS_FALLBACK[id],
    description: "",
  }));
}

/**
 * @param {HTMLSelectElement | null} selectEl
 * @param {unknown} modes - `{modes:[{id,name,description}]}` 或旧式 string[]
 */
function fillModeSelect(selectEl, modes) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  let rows = [];
  if (Array.isArray(modes) && modes.length > 0) {
    if (typeof modes[0] === "object" && modes[0] && modes[0].id) {
      rows = modes;
    } else {
      rows = modes.map((id) => ({
        id,
        name: MODE_LABELS_FALLBACK[id] || id,
        description: "",
      }));
    }
  } else {
    rows = builtinModeRows();
  }
  for (const m of rows) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name || m.id;
    if (m.description) opt.title = m.description;
    selectEl.appendChild(opt);
  }
}

/** 页面一加载就有选项，避免等网络期间下拉为空 */
function seedModeSelects() {
  fillModeSelect(el.sessionMode, builtinModeRows());
  fillModeSelect(el.refinalizeMode, builtinModeRows());
}

async function loadModes() {
  try {
    const data = await api("/modes");
    fillModeSelect(el.sessionMode, data?.modes);
    fillModeSelect(el.refinalizeMode, data?.modes);
  } catch (e) {
    console.warn("[SVI] /modes 不可用，使用内置整理模式列表", e);
    seedModeSelects();
  }
}

function builtinUseCaseRows() {
  return [
    {
      id: "thinking_clarify",
      label: "思考澄清",
      mode: "thinking_clarify",
      default_output_target: "preview",
      description: "适合想法混乱时，提炼真实问题、核心困惑和下一步（非简单润色）。默认以上方预览为主，可自行复制或投递。",
    },
    {
      id: "send_to_ai",
      label: "发给 AI 对话框",
      mode: "clean_intent",
      default_output_target: "clipboard",
      description: "整理成自然、清楚的问题或表达，适合粘贴到 ChatGPT、Claude、Cursor。",
    },
    {
      id: "obsidian_inbox",
      label: "写入 Obsidian Inbox",
      mode: "obsidian_note",
      default_output_target: "obsidian_inbox",
      description: "整理成 Markdown 笔记，并写入配置的 Obsidian Inbox。",
    },
    {
      id: "gaeh_goal",
      label: "生成 GAEH Goal",
      mode: "gaeh_goal",
      default_output_target: "gaeh_goal_file",
      description: "整理成 GAEH 可消费的目标文档（Background / Problem / Objective / Requirements / Non-goals / Acceptance Criteria）。",
    },
    {
      id: "coding_task",
      label: "生成编程任务",
      mode: "coding_task",
      default_output_target: "clipboard",
      description: "整理成 Cursor / Codex / Claude Code 可执行的开发任务说明。",
    },
    {
      id: "faithful_transcript",
      label: "忠实转录",
      mode: "faithful_transcript",
      default_output_target: "clipboard",
      description: "尽量保留原始表达与顺序，只做标点、断句和明显错字修正。",
    },
  ];
}

function fillUseCaseSelect(rows) {
  if (!el.useCaseSelect) return;
  el.useCaseSelect.innerHTML = "";
  const list = Array.isArray(rows) && rows.length ? rows : builtinUseCaseRows();
  cachedUseCases = list;
  for (const row of list) {
    const opt = document.createElement("option");
    opt.value = row.id;
    opt.textContent = row.label || row.id;
    opt.dataset.mode = row.mode || "";
    opt.dataset.defaultOutput = row.default_output_target || "clipboard";
    opt.title = row.description || "";
    el.useCaseSelect.appendChild(opt);
  }
  syncUseCaseHint();
  applyUseCaseDefaultOutput();
}

function syncUseCaseHint() {
  if (!el.useCaseHint || !el.useCaseSelect) return;
  const opt = el.useCaseSelect.selectedOptions[0];
  el.useCaseHint.textContent = opt ? opt.title || "" : "";
}

function applyUseCaseDefaultOutput() {
  const opt = el.useCaseSelect && el.useCaseSelect.selectedOptions[0];
  presetDefaultOutputTarget = opt ? opt.dataset.defaultOutput || "clipboard" : "clipboard";
}

async function loadUseCases() {
  try {
    const data = await api("/use-cases");
    fillUseCaseSelect(Array.isArray(data?.use_cases) ? data.use_cases : []);
  } catch (e) {
    console.warn("[SVI] /use-cases 不可用，使用内置场景列表", e);
    fillUseCaseSelect(builtinUseCaseRows());
  }
}

/** ---------- Session UI ---------- */
function updateSessionSummary(session) {
  if (!session) {
    el.sessionSummary.textContent =
      "尚未创建会话 — 选择场景后可直接点「开始录音」自动创建；也可先填标题并点「新建会话」。";
    el.sessionSummary.classList.add("muted");
    return;
  }
  el.sessionSummary.classList.remove("muted");
  const opt = el.useCaseSelect && el.useCaseSelect.selectedOptions[0];
  const sceneLabel = opt ? opt.textContent : "";
  el.sessionSummary.textContent = `会话 ${session.id.slice(0, 12)}… · 场景 ${sceneLabel || session.mode} · 状态 ${session.status}`;
}

function pillClass(status) {
  if (status === "recorded") return "pill-recorded";
  if (status === "transcribing") return "pill-transcribing";
  if (status === "transcribed") return "pill-done";
  if (status === "error") return "pill-err";
  return "pill-recorded";
}

function pillLabel(status) {
  const map = {
    recorded: "已保存录音",
    transcribing: "豆包转写中",
    transcribed: "转写完成",
    error: "失败",
  };
  return map[status] || status;
}

function renderSegments(segments) {
  lastSegments = Array.isArray(segments) ? segments : [];
  el.segments.innerHTML = "";
  if (!segments.length) {
    el.segments.innerHTML = '<p class="hint">暂无片段。完成录音并停止本段后，会出现在这里。</p>';
    updateFinalizeEnabled(segments);
    return;
  }
  for (const s of segments) {
    const card = document.createElement("div");
    card.className = "segment-card";
    const full = (s.raw_transcript || "").trim() || "（尚无转写文本）";
    const snippet = full.length > 180 ? `${full.slice(0, 180)}…` : full;
    card.innerHTML = `
      <div class="meta">
        <span class="pill ${pillClass(s.status)}">${pillLabel(s.status)}</span>
        <span>第 ${s.order_index} 段</span>
        <span>时长 ${Number(s.duration_seconds).toFixed(1)} s</span>
      </div>
      <details class="seg-details" ${s.status === "error" ? "open" : ""}>
        <summary class="seg-summary">${escapeHtml(snippet)}</summary>
        <textarea class="seg-textarea" rows="10" readonly>${escapeHtml(full)}</textarea>
      </details>
      ${s.error_message ? `<div class="hint" style="color:#ff9d9d;margin-top:6px">${escapeHtml(s.error_message)}</div>` : ""}
    `;
    const actions = document.createElement("div");
    actions.className = "segment-actions";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn";
    retry.textContent = "重试豆包转写";
    retry.onclick = async () => {
      try {
        setStatus("正在重新请求豆包转写…");
        await api(`/segments/${s.id}/transcribe/retry`, { method: "POST" });
        await refreshCurrentSession();
        startPollingCurrentSession();
        setStatus("该片段已重新转写。");
      } catch (e) {
        showToast(String(e.message || e), true);
      }
    };
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn";
    del.textContent = "删除该段";
    del.onclick = async () => {
      await api(`/segments/${s.id}`, { method: "DELETE" });
      await refreshCurrentSession();
      setStatus("已删除一段录音。");
    };
    actions.appendChild(retry);
    actions.appendChild(del);
    card.appendChild(actions);
    el.segments.appendChild(card);
  }
  updateFinalizeEnabled(segments);
}

function hasTranscribingSegments() {
  return (lastSegments || []).some((s) => s && s.status === "transcribing");
}

function stopPolling() {
  if (pollId) clearInterval(pollId);
  pollId = null;
  pollUntil = 0;
}

function startPollingCurrentSession(maxMs = 180000, intervalMs = 1200) {
  if (!currentSessionId) return;
  pollUntil = Date.now() + maxMs;
  if (pollId) return;
  pollId = setInterval(async () => {
    if (!currentSessionId) {
      stopPolling();
      return;
    }
    if (Date.now() > pollUntil) {
      stopPolling();
      return;
    }
    try {
      await refreshCurrentSession();
      if (!hasTranscribingSegments()) stopPolling();
    } catch {
      // ignore transient errors
    }
  }, intervalMs);
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

/** @type {Record<string, { available?: boolean, reason?: string }>} */
let outputCapabilityMap = {};

function applyOutputCapabilityButtons() {
  const okTarget = (id) => {
    const row = outputCapabilityMap[id];
    return !(row && row.available === false);
  };
  const hint = (id) => {
    const row = outputCapabilityMap[id];
    return row && row.reason ? String(row.reason) : "";
  };
  const hasFinal = !!(el.finalText && (el.finalText.value || "").trim());
  const outOk = hasFinal && !!currentSessionId;
  el.outClipboardBtn.disabled = !outOk;
  el.outPasteBtn.disabled = !outOk || !okTarget("active_window_paste");
  el.outMdBtn.disabled = !outOk || !okTarget("markdown_file");
  el.outObsidianBtn.disabled = !outOk || !okTarget("obsidian_inbox");
  el.outGaehBtn.disabled = !outOk || !okTarget("gaeh_goal_file");
  el.outPresetBtn.disabled = !outOk;
  el.outPasteBtn.title = hint("active_window_paste") || "前台粘贴到当前输入窗口";
  el.outMdBtn.title = hint("markdown_file") || "写入 SVI_MARKDOWN_OUTPUT_DIR";
  el.outObsidianBtn.title = hint("obsidian_inbox") || "写入 Obsidian Inbox";
  el.outGaehBtn.title = hint("gaeh_goal_file") || "写入 GAEH 项目 inbox";
}

async function loadOutputCapabilities() {
  try {
    const data = await api("/output-capabilities");
    const targets = Array.isArray(data?.targets) ? data.targets : [];
    outputCapabilityMap = {};
    for (const t of targets) {
      if (t && t.id) outputCapabilityMap[t.id] = t;
    }
  } catch (e) {
    console.warn("[SVI] /output-capabilities", e);
    outputCapabilityMap = {};
  }
  applyOutputCapabilityButtons();
}

function updateFinalizeEnabled(segments) {
  const ok = segments.some((s) => s.status === "transcribed" && (s.raw_transcript || "").trim());
  el.finalizeBtn.disabled = !currentSessionId || !ok;
  const hasFinal = !!(el.finalText.value || "").trim();
  el.copyBtn.disabled = !hasFinal;
  applyOutputCapabilityButtons();
}

async function refreshCurrentSession() {
  if (!currentSessionId) return;
  const data = await api(`/sessions/${currentSessionId}`);
  const sess = data.session;
  const ucId = (sess && sess.use_case_id) || "";
  if (ucId && el.useCaseSelect && el.useCaseSelect.querySelector(`option[value="${ucId}"]`)) {
    el.useCaseSelect.value = ucId;
  } else if (sess && sess.mode && el.useCaseSelect) {
    const match = [...el.useCaseSelect.options].find((o) => o.dataset.mode === sess.mode);
    if (match) el.useCaseSelect.value = match.value;
  }
  syncUseCaseHint();
  applyUseCaseDefaultOutput();
  updateSessionSummary(sess);
  el.finalText.value = sess.final_text || "";
  const sm = (sess && sess.mode) || "";
  if (sm && el.sessionMode && el.sessionMode.querySelector(`option[value="${sm}"]`)) {
    el.sessionMode.value = sm;
  }
  if (sm && el.refinalizeMode && el.refinalizeMode.querySelector(`option[value="${sm}"]`)) {
    el.refinalizeMode.value = sm;
  }
  renderSegments(data.segments);
  if ((sess.final_text || "").trim()) el.copyBtn.disabled = false;
}

async function refreshHealth() {
  try {
    await api("/health");
    el.health.textContent = "API 已连接";
    el.health.classList.remove("badge-muted");
    el.health.classList.add("badge-ok");
  } catch {
    el.health.textContent = "API 未连接";
    el.health.classList.add("badge-warn");
    showToast("无法连接本地 API，请确认后端已启动（桌面版会自动拉起 uvicorn）。", true);
  }
}

/** ---------- Waveform ---------- */
let audioCtx = null;
let analyser = null;
let waveStream = null;
let waveRaf = null;
let mediaRecorder = null;
let recordChunks = [];
let recordStartedAt = 0;
let timerId = null;

function syncCanvasSize() {
  const canvas = el.waveCanvas;
  const wrap = canvas.parentElement;
  const rect = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(320, Math.floor(rect.width * dpr));
  const h = Math.floor(120 * dpr);
  canvas.width = w;
  canvas.height = h;
  return { ctx: canvas.getContext("2d"), w, h, dpr };
}

function drawFlatLine() {
  const { ctx, w, h, dpr } = syncCanvasSize();
  ctx.fillStyle = "#08090c";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#2a3344";
  ctx.lineWidth = Math.max(1, dpr);
  const mid = h / 2;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(w, mid);
  ctx.stroke();
}

function stopWaveform() {
  if (waveRaf) cancelAnimationFrame(waveRaf);
  waveRaf = null;
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
  analyser = null;
  drawFlatLine();
}

function startWaveform(stream) {
  stopWaveform();
  audioCtx = new AudioContext();
  const src = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  const buf = new Uint8Array(analyser.frequencyBinCount);

  function tick() {
    waveRaf = requestAnimationFrame(tick);
    analyser.getByteTimeDomainData(buf);
    const { ctx, w, h, dpr } = syncCanvasSize();
    ctx.fillStyle = "#08090c";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#6ea8fe";
    ctx.lineWidth = Math.max(2, 2 * dpr);
    ctx.beginPath();
    const slice = w / buf.length;
    let x = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i] / 128.0;
      const y = (v * h) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += slice;
    }
    ctx.stroke();
  }
  tick();
}

function formatTime(sec) {
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** ---------- Output Router（终端 → API → 主进程/文件） ---------- */
async function dispatchSessionOutput(target) {
  if (!currentSessionId) {
    showToast("请先创建会话并完成整理。", true);
    return;
  }
  let data;
  try {
    data = await api(`/sessions/${currentSessionId}/outputs`, {
      method: "POST",
      body: JSON.stringify({ target }),
    });
  } catch (e) {
    showToast(String(e.message || e), true);
    return;
  }

  const text = data.final_text || "";

  if (!data.requires_client_execution) {
    const hint = data.written_path ? `已写入：${data.written_path}` : "已完成";
    showToast(hint);
    await refreshCurrentSession();
    return;
  }

  if (target === "clipboard") {
    const wr = await window.SVI_SHARED.writeClipboardBestEffort(text);
    const ok = !!wr.ok;
    const detail = wr.error || "";
    try {
      await api(`/sessions/${currentSessionId}/output-feedback`, {
        method: "POST",
        body: JSON.stringify({ target, success: ok, detail }),
      });
    } catch (err) {
      console.warn("[SVI] output-feedback failed", err);
    }
    showToast(ok ? "已复制到剪贴板。" : detail || "剪贴板写入失败", !ok);
    await refreshCurrentSession();
    return;
  }

  if (target === "active_window_paste") {
    if (!window.svi || typeof window.svi.pasteForeground !== "function") {
      try {
        await api(`/sessions/${currentSessionId}/output-feedback`, {
          method: "POST",
          body: JSON.stringify({
            target,
            success: false,
            detail: "仅 Electron 桌面版支持前台粘贴",
          }),
        });
      } catch (err) {
        console.warn(err);
      }
      showToast("前台粘贴仅支持 Electron 桌面版；请改用「剪贴板」或其它投递。", true);
      await refreshCurrentSession();
      return;
    }
    const r = await window.svi.pasteForeground(text);
    try {
      await api(`/sessions/${currentSessionId}/output-feedback`, {
        method: "POST",
        body: JSON.stringify({
          target,
          success: !!r.ok,
          detail: r.error || "",
        }),
      });
    } catch (err) {
      console.warn(err);
    }
    showToast(r.ok ? "已尝试粘贴到前台窗口。" : r.error || "粘贴失败", !r.ok);
    await refreshCurrentSession();
  }
}

/** ---------- History list（须为顶层函数：init / wireEvents 多处调用） ---------- */
async function refreshHistoryList() {
  const sessions = await api("/sessions");
  sessions.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  el.history.innerHTML = "";
  if (!sessions.length) {
    el.history.innerHTML = '<p class="hint">暂无历史</p>';
    return;
  }
  for (const s of sessions) {
    const card = document.createElement("div");
    card.className = "segment-card";
    card.innerHTML = `
      <div class="meta"><strong>${escapeHtml(s.title)}</strong> · ${escapeHtml(s.mode)} · ${escapeHtml(s.status)}</div>
      <div class="hint">${escapeHtml(s.id)}</div>
    `;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn load-btn";
    btn.textContent = "加载此会话";
    btn.onclick = async () => {
      currentSessionId = s.id;
      await refreshCurrentSession();
      document.querySelector('.tab[data-tab="workflow"]').click();
      setStatus("已加载历史会话。");
    };
    card.appendChild(btn);
    el.history.appendChild(card);
  }
}

async function dispatchSceneDefaultOutput() {
  const t = presetDefaultOutputTarget || "clipboard";
  if (t === "preview") {
    showToast("当前场景以预览为主；终稿见上方，可用「复制终稿」或下方具体投递按钮。", false);
    return;
  }
  await dispatchSessionOutput(t);
}

async function postSessionWithCurrentUseCase() {
  const useCaseId = (el.useCaseSelect && el.useCaseSelect.value) || "";
  if (!useCaseId) {
    throw new Error("请选择本次场景");
  }
  const opt = el.useCaseSelect.selectedOptions[0];
  const label = opt ? opt.textContent.trim() : window.SVI_SHARED.useCaseDisplayLabel(useCaseId);
  const title =
    (el.sessionTitle && el.sessionTitle.value.trim()) ||
    window.SVI_SHARED.formatAutoSessionTitle(label);
  const session = await api("/sessions", {
    method: "POST",
    body: JSON.stringify({
      title,
      use_case_id: useCaseId,
      rewrite_provider: DEFAULT_REWRITE,
    }),
  });
  if (window.SVI_SHARED && typeof window.SVI_SHARED.rememberUseCaseId === "function") {
    window.SVI_SHARED.rememberUseCaseId(useCaseId);
  }
  if (session.mode && window.SVI_SHARED && typeof window.SVI_SHARED.rememberSessionMode === "function") {
    window.SVI_SHARED.rememberSessionMode(session.mode);
  }
  return session;
}

/** G8：录音前确保有未终稿的会话；无则创建，`done` 则新开 */
async function ensureSessionBeforeRecording() {
  const useCaseId = (el.useCaseSelect && el.useCaseSelect.value) || "";
  if (!useCaseId) {
    showToast("请先选择「本次场景」（若下拉为空请检查 API）。", true);
    return false;
  }
  if (!currentSessionId) {
    try {
      const session = await postSessionWithCurrentUseCase();
      currentSessionId = session.id;
      if (el.sessionTitle) el.sessionTitle.value = session.title || "";
      updateSessionSummary(session);
      await refreshHistoryList();
      setStatus("已按当前场景创建会话，正在打开麦克风…");
      return true;
    } catch (e) {
      showToast(String(e.message || e), true);
      return false;
    }
  }
  try {
    const data = await api(`/sessions/${currentSessionId}`);
    const st = data.session && data.session.status;
    if (st === "done") {
      const session = await postSessionWithCurrentUseCase();
      currentSessionId = session.id;
      if (el.sessionTitle) el.sessionTitle.value = session.title || "";
      if (el.finalText) el.finalText.value = "";
      updateSessionSummary(session);
      await refreshCurrentSession();
      await refreshHistoryList();
      setStatus("上一会话已生成终稿；已新建会话，正在打开麦克风…");
      return true;
    }
  } catch (e) {
    showToast(String(e.message || e), true);
    return false;
  }
  return true;
}

/** ---------- Recording ---------- */
function wireEvents() {
  let priorUseCaseValue = "";
  if (el.useCaseSelect) {
    el.useCaseSelect.addEventListener("focus", () => {
      priorUseCaseValue = el.useCaseSelect.value;
    });
    el.useCaseSelect.addEventListener("change", async () => {
      syncUseCaseHint();
      applyUseCaseDefaultOutput();
      if (!currentSessionId) return;
      if (lastSegments && lastSegments.length > 0) {
        const ok = confirm("当前会话已有片段，切换场景将影响最终整理方式。是否继续？");
        if (!ok) {
          el.useCaseSelect.value = priorUseCaseValue;
          syncUseCaseHint();
          applyUseCaseDefaultOutput();
          return;
        }
      }
      const hasFinal = !!(el.finalText && (el.finalText.value || "").trim());
      try {
        await api(`/sessions/${currentSessionId}`, {
          method: "PATCH",
          body: JSON.stringify({ use_case_id: (el.useCaseSelect.value || "").trim() }),
        });
        priorUseCaseValue = el.useCaseSelect.value;
        await refreshCurrentSession();
        if (window.SVI_SHARED && typeof window.SVI_SHARED.rememberUseCaseId === "function") {
          window.SVI_SHARED.rememberUseCaseId(el.useCaseSelect.value);
        }
        if (hasFinal) {
          showToast("当前已有整理结果。切换场景后可重新整理，原始转写不会丢失。", false);
        }
      } catch (e) {
        showToast(String(e.message || e), true);
      }
    });
  }

  if (el.sessionMode) {
    el.sessionMode.addEventListener("change", async () => {
      if (!currentSessionId) return;
      const hasFinal = !!(el.finalText && (el.finalText.value || "").trim());
      if (hasFinal) {
        showToast("当前已有整理结果。切换整理模式后可重新整理，原始转写不会丢失。", false);
      }
      try {
        await api(`/sessions/${currentSessionId}`, {
          method: "PATCH",
          body: JSON.stringify({ mode: (el.sessionMode.value || "").trim() }),
        });
        await refreshCurrentSession();
        if (window.SVI_SHARED && typeof window.SVI_SHARED.rememberSessionMode === "function") {
          window.SVI_SHARED.rememberSessionMode(el.sessionMode.value);
        }
      } catch (e) {
        showToast(String(e.message || e), true);
      }
    });
  }

el.createSessionBtn.onclick = async () => {
  try {
    const useCaseId = (el.useCaseSelect && el.useCaseSelect.value) || "";
    if (!useCaseId) {
      showToast("请先选择「本次场景」（若下拉为空请检查 API 是否已启动）。", true);
      return;
    }
    const opt = el.useCaseSelect.selectedOptions[0];
    const label = opt ? opt.textContent.trim() : window.SVI_SHARED.useCaseDisplayLabel(useCaseId);
    const body = {
      title: el.sessionTitle.value.trim() || window.SVI_SHARED.formatAutoSessionTitle(label),
      use_case_id: useCaseId,
      rewrite_provider: DEFAULT_REWRITE,
    };
    const session = await api("/sessions", { method: "POST", body: JSON.stringify(body) });
    if (window.SVI_SHARED && typeof window.SVI_SHARED.rememberUseCaseId === "function") {
      window.SVI_SHARED.rememberUseCaseId(useCaseId);
    }
    if (session.mode && window.SVI_SHARED && typeof window.SVI_SHARED.rememberSessionMode === "function") {
      window.SVI_SHARED.rememberSessionMode(session.mode);
    }
    currentSessionId = session.id;
    updateSessionSummary(session);
    el.startRecordBtn.disabled = false;
    el.stopRecordBtn.disabled = true;
    setStatus("会话已创建。请点击「开始录音」，可随时多次录音补充内容。");
    await refreshHistoryList();
    showToast("已新建会话，可以开始录音。");
  } catch (e) {
    showToast(String(e.message || e), true);
  }
};

el.startRecordBtn.onclick = async () => {
  const ensured = await ensureSessionBeforeRecording();
  if (!ensured) return;
  try {
    waveStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  } catch (e) {
    showToast(`无法打开麦克风：${e.message || e}`, true);
    return;
  }

  recordChunks = [];
  mediaRecorder = window.SVI_SHARED.createRecorder(waveStream);

  mediaRecorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size) recordChunks.push(ev.data);
  };

  startWaveform(waveStream);
  recordStartedAt = Date.now();
  el.recordTimer.textContent = "00:00";
  timerId = setInterval(() => {
    const sec = (Date.now() - recordStartedAt) / 1000;
    el.recordTimer.textContent = formatTime(sec);
  }, 400);

  mediaRecorder.start(250);
  el.startRecordBtn.disabled = true;
  el.stopRecordBtn.disabled = false;
  setStatus("正在录音…（波形应随声音起伏）点击「停止本段并转写」结束本段。");
};

el.stopRecordBtn.onclick = async () => {
  if (!mediaRecorder || mediaRecorder.state !== "recording") return;
  el.stopRecordBtn.disabled = true;
  setStatus("正在保存录音并请求豆包转写，请稍候…");

  await new Promise((resolve) => {
    mediaRecorder.onstop = resolve;
    mediaRecorder.stop();
  });

  clearInterval(timerId);
  timerId = null;
  stopWaveform();
  if (waveStream) {
    waveStream.getTracks().forEach((t) => t.stop());
    waveStream = null;
  }

  const duration = Math.max(0.1, (Date.now() - recordStartedAt) / 1000);
  const mime = mediaRecorder.mimeType || "audio/webm";
  const blob = new Blob(recordChunks, { type: mime });
  mediaRecorder = null;

  if (!blob.size) {
    el.startRecordBtn.disabled = false;
    showToast("未采集到音频数据，请检查麦克风或缩短停顿后重试。", true);
    setStatus("本段没有采集到数据。");
    return;
  }

  try {
    await window.SVI_SHARED.uploadSegmentAudio(
      apiBase,
      currentSessionId,
      blob,
      mime,
      duration,
      DEFAULT_STT
    );
    await refreshCurrentSession();
    startPollingCurrentSession();
    setStatus("本段已上传并完成豆包转写（若失败请看重试）。可多录几段，最后点下方生成 DeepSeek 终稿。");
    showToast("本段处理完成。");
  } catch (e) {
    showToast(String(e.message || e), true);
    setStatus("上传或转写失败，请查看上方片段错误信息。");
  } finally {
    el.startRecordBtn.disabled = false;
    el.stopRecordBtn.disabled = true;
    drawFlatLine();
    el.recordTimer.textContent = "00:00";
  }
};

el.finalizeBtn.onclick = async () => {
  if (!currentSessionId) return;
    setStatus("正在合并转写并按当前模式生成终稿…");
  el.finalizeBtn.disabled = true;
  try {
    const session = await api(`/sessions/${currentSessionId}/finalize`, { method: "POST" });
    el.finalText.value = session.final_text || "";
    if (session.status === "error") {
      showToast(session.error_message || "生成失败", true);
      setStatus(session.error_message || "生成失败");
    } else {
      setStatus("终稿已生成，可复制或使用投递区。");
      showToast("终稿已生成。");
    }
    await refreshCurrentSession();
    await refreshHistoryList();
  } catch (e) {
    showToast(String(e.message || e), true);
    await refreshCurrentSession();
  }
};

el.refinalizeBtn.onclick = async () => {
  if (!currentSessionId) return;
  try {
    const session = await api(`/sessions/${currentSessionId}/refinalize`, {
      method: "POST",
      body: JSON.stringify({
        mode: el.refinalizeMode.value,
        rewrite_provider: DEFAULT_REWRITE,
      }),
    });
    el.finalText.value = session.final_text || "";
    await refreshCurrentSession();
    showToast("已按新模式重新整理。");
  } catch (e) {
    showToast(String(e.message || e), true);
  }
};

el.copyBtn.onclick = async () => {
  await dispatchSessionOutput("clipboard");
};

el.outClipboardBtn.onclick = async () => {
  await dispatchSessionOutput("clipboard");
};
el.outPasteBtn.onclick = async () => {
  await dispatchSessionOutput("active_window_paste");
};
el.outMdBtn.onclick = async () => {
  await dispatchSessionOutput("markdown_file");
};
el.outObsidianBtn.onclick = async () => {
  await dispatchSessionOutput("obsidian_inbox");
};
el.outGaehBtn.onclick = async () => {
  await dispatchSessionOutput("gaeh_goal_file");
};
el.outPresetBtn.onclick = async () => {
  await dispatchSceneDefaultOutput();
};

el.addSegmentBtn.onclick = async () => {
  if (!currentSessionId) return;
  try {
    await api(`/sessions/${currentSessionId}/segments`, {
      method: "POST",
      body: JSON.stringify({
        audio_file_path: el.audioPath.value.trim(),
        duration_seconds: Number(el.audioDuration.value || 0),
        stt_provider: DEFAULT_STT,
      }),
    });
    await refreshCurrentSession();
    showToast("已添加片段记录（请自行触发转写）。");
  } catch (e) {
    showToast(String(e.message || e), true);
  }
};

el.refreshHistoryBtn.onclick = () => refreshHistoryList();
el.clearHistoryBtn.onclick = async () => {
  const ok = confirm("确认清除全部历史会话与片段？此操作不可恢复。");
  if (!ok) return;
  try {
    await api("/sessions", { method: "DELETE", body: JSON.stringify({ delete_audio: true }) });
    currentSessionId = null;
    el.finalText.value = "";
    el.segments.innerHTML = "";
    updateSessionSummary(null);
    await refreshHistoryList();
    setStatus("已清除全部历史会话。");
    showToast("历史已清除。");
  } catch (e) {
    showToast(String(e.message || e), true);
  }
};
}

/** ---------- Tabs ---------- */
function setupTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const id = `panel-${btn.dataset.tab}`;
      const panel = document.getElementById(id);
      if (panel) panel.classList.add("active");
    });
  });
}

window.addEventListener("resize", () => {
  if (!analyser) drawFlatLine();
});

async function init() {
  bindEl();
  wireEvents();
  seedModeSelects();
  setupTabs();
  requestAnimationFrame(() => drawFlatLine());
  await loadUseCases();
  await loadModes();
  await refreshHealth();
  await loadOutputCapabilities();
  await refreshHistoryList();
  if (el.startRecordBtn && el.useCaseSelect && el.useCaseSelect.options.length) {
    el.startRecordBtn.disabled = false;
  }
  setStatus("选择本次场景后可直接「开始录音」（自动创建会话）；或先「新建会话」。片段将自动转写，最后按场景整理终稿。");
}

init().catch((e) => {
  console.error("[SVI] init failed", e);
  try {
    const hint = document.createElement("div");
    hint.style.cssText =
      "margin:24px;padding:16px;font:14px sans-serif;color:#ffb4b4;background:#2a1515;border-radius:8px;white-space:pre-wrap;";
    hint.textContent = `界面初始化失败：${e && e.message ? e.message : String(e)}\n\n请打开开发者工具查看控制台。`;
    document.body.appendChild(hint);
    const h = document.getElementById("health");
    if (h) {
      h.textContent = "脚本异常";
      h.classList.add("badge-warn");
    }
  } catch {
    /* ignore */
  }
});
