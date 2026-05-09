/**
 * 桌面端：新建会话 → 多段录音（波形）→ 每段停止后自动上传+豆包转写 → 一键 DeepSeek 生成终稿。
 */

const apiBase = window.svi.apiBase;

const DEFAULT_STT = "doubao";
const DEFAULT_REWRITE = "deepseek";

/** 与后端 RewriteMode 对齐 */
const MODE_LABELS = {
  intent_cleanup: "原意清理 · 适合对话框粘贴",
  obsidian_note: "Obsidian 笔记 · Markdown",
  task_requirement: "任务/需求 · 协作开发",
  faithful_transcript: "忠实转录 · 少改动",
};

let currentSessionId = null;

const el = {};
function bindEl() {
  el.health = document.getElementById("health");
  el.statusLine = document.getElementById("statusLine");
  el.sessionTitle = document.getElementById("sessionTitle");
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
  el.refinalizeMode = document.getElementById("refinalizeMode");
  el.refinalizeBtn = document.getElementById("refinalizeBtn");
  el.audioPath = document.getElementById("audioPath");
  el.audioDuration = document.getElementById("audioDuration");
  el.addSegmentBtn = document.getElementById("addSegmentBtn");
  el.history = document.getElementById("history");
  el.refreshHistoryBtn = document.getElementById("refreshHistoryBtn");
  el.toast = document.getElementById("toast");
}

/** ---------- API ---------- */
async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const resp = await fetch(`${apiBase}${path}`, { ...options, headers });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`${resp.status} ${body}`);
  }
  const ct = resp.headers.get("content-type") || "";
  if (ct.includes("application/json")) return resp.json();
  return resp.text();
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
function fillModeSelect(selectEl, modes) {
  selectEl.innerHTML = "";
  for (const m of modes) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = MODE_LABELS[m] || m;
    selectEl.appendChild(opt);
  }
}

async function loadModes() {
  try {
    const data = await api("/modes");
    fillModeSelect(el.sessionMode, data.modes);
    fillModeSelect(el.refinalizeMode, data.modes);
  } catch {
    const fallback = Object.keys(MODE_LABELS);
    fillModeSelect(el.sessionMode, fallback);
    fillModeSelect(el.refinalizeMode, fallback);
  }
}

/** ---------- Session UI ---------- */
function updateSessionSummary(session) {
  if (!session) {
    el.sessionSummary.textContent = "尚未创建会话";
    el.sessionSummary.classList.add("muted");
    return;
  }
  el.sessionSummary.classList.remove("muted");
  el.sessionSummary.textContent = `会话 ${session.id.slice(0, 12)}… · 模式 ${session.mode} · 状态 ${session.status}`;
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
  el.segments.innerHTML = "";
  if (!segments.length) {
    el.segments.innerHTML = '<p class="hint">暂无片段。完成录音并停止本段后，会出现在这里。</p>';
    updateFinalizeEnabled(segments);
    return;
  }
  for (const s of segments) {
    const card = document.createElement("div");
    card.className = "segment-card";
    const snippet = (s.raw_transcript || "").trim() || "（尚无转写文本）";
    card.innerHTML = `
      <div class="meta">
        <span class="pill ${pillClass(s.status)}">${pillLabel(s.status)}</span>
        <span>第 ${s.order_index} 段</span>
        <span>时长 ${Number(s.duration_seconds).toFixed(1)} s</span>
      </div>
      <div class="snippet">${escapeHtml(snippet.slice(0, 400))}${snippet.length > 400 ? "…" : ""}</div>
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

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function updateFinalizeEnabled(segments) {
  const ok = segments.some((s) => s.status === "transcribed" && (s.raw_transcript || "").trim());
  el.finalizeBtn.disabled = !currentSessionId || !ok;
  el.copyBtn.disabled = !(el.finalText.value || "").trim();
}

async function refreshCurrentSession() {
  if (!currentSessionId) return;
  const data = await api(`/sessions/${currentSessionId}`);
  updateSessionSummary(data.session);
  el.finalText.value = data.session.final_text || "";
  renderSegments(data.segments);
  if ((data.session.final_text || "").trim()) el.copyBtn.disabled = false;
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

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const t of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function formatTime(sec) {
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** ---------- Recording ---------- */
el.createSessionBtn.onclick = async () => {
  try {
    const body = {
      title: el.sessionTitle.value.trim() || `会话-${new Date().toLocaleString("zh-CN")}`,
      mode: el.sessionMode.value,
      rewrite_provider: DEFAULT_REWRITE,
    };
    const session = await api("/sessions", { method: "POST", body: JSON.stringify(body) });
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
  if (!currentSessionId) {
    showToast("请先点击「新建会话」。", true);
    return;
  }
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
  const mime = pickMimeType();
  try {
    mediaRecorder = mime ? new MediaRecorder(waveStream, { mimeType: mime }) : new MediaRecorder(waveStream);
  } catch {
    mediaRecorder = new MediaRecorder(waveStream);
  }

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

  const ext = mime.includes("mp4") ? "m4a" : "webm";
  const form = new FormData();
  form.append("file", blob, `seg-${Date.now()}.${ext}`);
  form.append("duration_seconds", String(duration));
  form.append("stt_provider", DEFAULT_STT);

  try {
    const up = await fetch(
      `${apiBase}/sessions/${currentSessionId}/segments/upload?auto_transcribe=true`,
      { method: "POST", body: form }
    );
    if (!up.ok) {
      const t = await up.text();
      throw new Error(`${up.status} ${t}`);
    }
    await refreshCurrentSession();
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
  setStatus("正在合并片段并请 DeepSeek 生成终稿…");
  el.finalizeBtn.disabled = true;
  try {
    const session = await api(`/sessions/${currentSessionId}/finalize`, { method: "POST" });
    el.finalText.value = session.final_text || "";
    if (session.status === "error") {
      showToast(session.error_message || "生成失败", true);
      setStatus(session.error_message || "生成失败");
    } else {
      setStatus("DeepSeek 终稿已生成，可复制使用。");
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
  const t = el.finalText.value || "";
  if (!t) return;
  try {
    await navigator.clipboard.writeText(t);
    showToast("已复制到剪贴板。");
  } catch {
    el.finalText.select();
    document.execCommand("copy");
    showToast("已尝试复制（若失败请手动全选复制）。");
  }
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

async function refreshHistoryList() {
  const sessions = await api("/sessions");
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
      el.refinalizeMode.value = s.mode;
      await refreshCurrentSession();
      document.querySelector('.tab[data-tab="workflow"]').click();
      setStatus("已加载历史会话。");
    };
    card.appendChild(btn);
    el.history.appendChild(card);
  }
}

el.refreshHistoryBtn.onclick = () => refreshHistoryList();

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
  setupTabs();
  requestAnimationFrame(() => drawFlatLine());
  await loadModes();
  await refreshHealth();
  await refreshHistoryList();
  setStatus("第一步：选择整理模式并新建会话；第二步：录音；第三步：片段自动转写；第四步：生成 DeepSeek 终稿。");
}

init();
