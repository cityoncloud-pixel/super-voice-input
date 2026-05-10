/**
 * 悬浮窗：与主面板共用 svi-shared.js 的 API、录音编码与上传格式。
 */

const apiBase =
  (typeof window !== "undefined" && window.svi && window.svi.apiBase) || "http://127.0.0.1:8000";

const S = () => window.SVI_SHARED;

let sessionId = null;
let mediaRecorder = null;
let recordChunks = [];
let waveStream = null;
let recordStartedAt = 0;
/** 与主面板一致：豆包异步转写时需轮询，否则片段一直为 transcribing，整理按钮无法启用 */
let ovPollId = null;
let ovPollUntil = 0;
let lastOvSegments = [];

const ov = {};

function bind() {
  ov.status = document.getElementById("ovStatus");
  ov.transcript = document.getElementById("ovTranscript");
  ov.newBtn = document.getElementById("ovNew");
  ov.rec = document.getElementById("ovRec");
  ov.stop = document.getElementById("ovStop");
  ov.fin = document.getElementById("ovFin");
  ov.copy = document.getElementById("ovCopy");
}

async function api(path, options = {}) {
  if (!S() || typeof S().fetchApi !== "function") {
    throw new Error("缺少 svi-shared.js：请确认 overlay.html 中先于 overlay.js 加载。");
  }
  return S().fetchApi(apiBase, path, options);
}

function setStatus(t) {
  ov.status.textContent = t;
}

function escapeOvHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function hasOvTranscribing(segments) {
  return (segments || []).some((s) => s && s.status === "transcribing");
}

function stopOvPolling() {
  if (ovPollId) clearInterval(ovPollId);
  ovPollId = null;
  ovPollUntil = 0;
}

/** 与 app.js startPollingCurrentSession 对齐：直到没有 transcribing 或超时；首帧立即拉取减少等待 */
function startOvPolling(maxMs = 180000, intervalMs = 1200) {
  if (!sessionId) return;
  ovPollUntil = Date.now() + maxMs;
  if (ovPollId) return;

  async function tick() {
    if (!sessionId) {
      stopOvPolling();
      return;
    }
    if (Date.now() > ovPollUntil) {
      stopOvPolling();
      return;
    }
    try {
      await refresh();
      if (!hasOvTranscribing(lastOvSegments)) stopOvPolling();
    } catch {
      /* ignore */
    }
  }

  void tick();
  ovPollId = setInterval(tick, intervalMs);
}

function renderOvSegments(segments) {
  const box = ov.transcript;
  if (!box) return;
  if (!Array.isArray(segments) || !segments.length) {
    box.innerHTML = '<span style="color:#6b7380">暂无片段。</span>';
    return;
  }
  const lines = segments.map((s) => {
    const st = s.status || "";
    const txt = (s.raw_transcript || "").trim();
    const snippet = txt.length > 280 ? `${txt.slice(0, 280)}…` : txt;
    const label =
      st === "transcribing"
        ? "豆包转写中…"
        : st === "transcribed"
          ? "转写完成"
          : st === "error"
            ? "转写失败"
            : st;
    const body = snippet ? escapeOvHtml(snippet) : escapeOvHtml(st === "transcribing" ? "（等待结果）" : "（尚无文本）");
    const err = s.error_message ? `<div style="color:#ff9d9d;margin-top:4px">${escapeOvHtml(s.error_message)}</div>` : "";
    return `<div class="ov-seg"><span class="ov-seg-meta">第 ${s.order_index} 段 · ${escapeOvHtml(label)}</span><div class="ov-seg-txt">${body}</div>${err}</div>`;
  });
  box.innerHTML = lines.join("");
}

function syncButtons(sess, segments) {
  const recOn = mediaRecorder && mediaRecorder.state === "recording";
  ov.rec.disabled = !sessionId || recOn;
  ov.stop.disabled = !sessionId || !recOn;
  const hasSeg =
    Array.isArray(segments) &&
    segments.some((s) => s.status === "transcribed" && (s.raw_transcript || "").trim());
  ov.fin.disabled = !sessionId || !hasSeg;
  const ft = (sess && sess.final_text) || "";
  ov.copy.disabled = !sessionId || !String(ft).trim();
}

async function refresh() {
  if (!sessionId) {
    setStatus("未创建会话");
    lastOvSegments = [];
    renderOvSegments([]);
    syncButtons(null, []);
    return;
  }
  const data = await api(`/sessions/${sessionId}`);
  const sess = data.session;
  const segments = data.segments || [];
  lastOvSegments = segments;
  const transcribing = segments.filter((s) => s.status === "transcribing").length;
  const done = segments.filter((s) => s.status === "transcribed").length;
  const err = segments.filter((s) => s.status === "error").length;
  setStatus(
    `会话 ${sessionId.slice(0, 10)}… · ${sess.status} · 片段 ${segments.length}（转写中 ${transcribing} · 已完成 ${done}${err ? ` · 失败 ${err}` : ""}）`
  );
  renderOvSegments(segments);
  syncButtons(sess, segments);
}

async function dispatchClipboard() {
  if (!sessionId) return;
  const data = await api(`/sessions/${sessionId}/outputs`, {
    method: "POST",
    body: JSON.stringify({ target: "clipboard" }),
  });
  const text = data.final_text || "";
  const wr = await S().writeClipboardBestEffort(text);
  const ok = !!wr.ok;
  const detail = wr.error || "";
  await api(`/sessions/${sessionId}/output-feedback`, {
    method: "POST",
    body: JSON.stringify({ target: "clipboard", success: ok, detail }),
  });
  setStatus(ok ? "已通过路由写入剪贴板。" : detail || "剪贴板失败");
}

function wire() {
  ov.newBtn.onclick = async () => {
    try {
      const mode = S().lastSessionMode("intent_cleanup");
      const session = await api("/sessions", {
        method: "POST",
        body: JSON.stringify({
          title: `悬浮-${new Date().toLocaleString("zh-CN")}`,
          mode,
          rewrite_provider: S().DEFAULT_REWRITE,
        }),
      });
      sessionId = session.id;
      stopOvPolling();
      await refresh();
    } catch (e) {
      setStatus(String(e.message || e));
    }
  };

  ov.rec.onclick = async () => {
    if (!sessionId) return;
    try {
      waveStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (e) {
      setStatus(`无法打开麦克风：${e.message || e}`);
      return;
    }
    recordChunks = [];
    mediaRecorder = S().createRecorder(waveStream);
    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size) recordChunks.push(ev.data);
    };
    recordStartedAt = Date.now();
    mediaRecorder.start(250);
    syncButtons(null, []);
  };

  ov.stop.onclick = async () => {
    if (!mediaRecorder || mediaRecorder.state !== "recording") return;
    await new Promise((resolve) => {
      mediaRecorder.onstop = resolve;
      mediaRecorder.stop();
    });
    if (waveStream) {
      waveStream.getTracks().forEach((t) => t.stop());
      waveStream = null;
    }
    const mime = mediaRecorder.mimeType || "audio/webm";
    const blob = new Blob(recordChunks, { type: mime });
    const duration = Math.max(0.1, (Date.now() - recordStartedAt) / 1000);
    mediaRecorder = null;

    if (!blob.size) {
      setStatus("未采集到音频数据。");
      await refresh();
      return;
    }

    try {
      await S().uploadSegmentAudio(apiBase, sessionId, blob, mime, duration, S().DEFAULT_STT);
      await refresh();
      if (hasOvTranscribing(lastOvSegments)) {
        startOvPolling();
      }
      setStatus(
        hasOvTranscribing(lastOvSegments)
          ? "本段已上传；豆包转写进行中，下方列表会刷新（与主工作台一致轮询）。"
          : "本段已上传并完成转写（或同步测试模式）。"
      );
    } catch (e) {
      setStatus(String(e.message || e));
    }
  };

  ov.fin.onclick = async () => {
    if (!sessionId || ov.fin.disabled) return;
    try {
      await api(`/sessions/${sessionId}/finalize`, { method: "POST" });
      await refresh();
    } catch (e) {
      setStatus(String(e.message || e));
    }
  };

  ov.copy.onclick = async () => {
    if (!sessionId || ov.copy.disabled) return;
    try {
      await dispatchClipboard();
      await refresh();
    } catch (e) {
      setStatus(String(e.message || e));
    }
  };
}

function toggleRecordShortcut() {
  if (!sessionId) {
    setStatus("请先「新建会话」。");
    return;
  }
  if (mediaRecorder && mediaRecorder.state === "recording") {
    ov.stop.click();
  } else {
    ov.rec.click();
  }
}

async function finalizeShortcut() {
  if (!sessionId || ov.fin.disabled) {
    setStatus("无法整理：请确认已有转写成功的片段。");
    return;
  }
  try {
    await api(`/sessions/${sessionId}/finalize`, { method: "POST" });
    await refresh();
  } catch (e) {
    setStatus(String(e.message || e));
  }
}

bind();
wire();
if (window.svi && typeof window.svi.subscribeHotkey === "function") {
  window.svi.subscribeHotkey("toggleSegment", toggleRecordShortcut);
  window.svi.subscribeHotkey("finalize", finalizeShortcut);
}
