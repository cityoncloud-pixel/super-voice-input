/**
 * 悬浮窗：G9 状态化「遥控器」；与主面板共用 svi-shared.js。
 */

const apiBase =
  (typeof window !== "undefined" && window.svi && window.svi.apiBase) || "http://127.0.0.1:8000";

const S = () => window.SVI_SHARED;

const MAX_SNIPPET = 72;

let sessionId = null;
let mediaRecorder = null;
let recordChunks = [];
let waveStream = null;
let recordStartedAt = 0;
let ovPollId = null;
let ovPollUntil = 0;
let lastOvSegments = [];
/** 最近一次 refresh 的会话，供录音中计算 UI 状态 */
let lastOvSession = null;
let cachedUseCases = [];

const ov = {};

function bind() {
  ov.status = document.getElementById("ovStatus");
  ov.transcript = document.getElementById("ovTranscript");
  ov.sceneLine = document.getElementById("ovSceneLine");
  ov.newBtn = document.getElementById("ovNew");
  ov.rec = document.getElementById("ovRec");
  ov.stop = document.getElementById("ovStop");
  ov.fin = document.getElementById("ovFin");
  ov.copy = document.getElementById("ovCopy");
  ov.openMain = document.getElementById("ovOpenMain");
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

function builtinUseCases() {
  return [
    { id: "thinking_clarify", label: "思考澄清", default_output_target: "preview" },
    { id: "send_to_ai", label: "发给 AI 对话框", default_output_target: "clipboard" },
    { id: "obsidian_inbox", label: "写入 Obsidian Inbox", default_output_target: "obsidian_inbox" },
    { id: "gaeh_goal", label: "生成 GAEH Goal", default_output_target: "gaeh_goal_file" },
    { id: "coding_task", label: "生成编程任务", default_output_target: "clipboard" },
    { id: "faithful_transcript", label: "忠实转录", default_output_target: "clipboard" },
  ];
}

async function loadUseCases() {
  try {
    const data = await api("/use-cases");
    cachedUseCases = Array.isArray(data?.use_cases) && data.use_cases.length ? data.use_cases : builtinUseCases();
  } catch {
    cachedUseCases = builtinUseCases();
  }
}

function defaultOutputForUseCaseId(ucId) {
  const row = cachedUseCases.find((x) => x.id === ucId);
  return (row && row.default_output_target) || "clipboard";
}

function outputTargetReadable(t) {
  const m = {
    preview: "预览（不自动投递）",
    clipboard: "剪贴板",
    active_window_paste: "前台粘贴",
    markdown_file: "Markdown 文件",
    obsidian_inbox: "Obsidian Inbox",
    gaeh_goal_file: "GAEH Goal 文件",
  };
  return m[t] || t || "—";
}

function finalizePrimaryLabel(target) {
  const map = {
    clipboard: "整理并复制",
    active_window_paste: "整理并粘贴",
    markdown_file: "整理并保存",
    obsidian_inbox: "整理并保存",
    gaeh_goal_file: "整理为 Goal",
    preview: "生成终稿",
  };
  return map[target] || "整理并输出";
}

function updateSceneLine(sess) {
  if (!ov.sceneLine) return;
  const uc = (sess && sess.use_case_id) || S().lastUseCaseId("send_to_ai");
  const row = cachedUseCases.find((x) => x.id === uc);
  const sceneLabel = row?.label || S().useCaseDisplayLabel(uc);
  const target = defaultOutputForUseCaseId(uc);
  ov.sceneLine.textContent = `场景：${sceneLabel}　输出：${outputTargetReadable(target)}`;
}

function updateFinalizeButtonLabel(sess) {
  if (!ov.fin) return;
  const uc = (sess && sess.use_case_id) || S().lastUseCaseId("send_to_ai");
  const target = defaultOutputForUseCaseId(uc);
  ov.fin.textContent = finalizePrimaryLabel(target);
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
    const nChars = txt.length;
    const dur = Number(s.duration_seconds || 0).toFixed(1);
    const label =
      st === "transcribing"
        ? "转写中"
        : st === "transcribed"
          ? "已转写"
          : st === "error"
            ? "失败"
            : st;
    const snippet =
      txt.length > MAX_SNIPPET ? `${txt.slice(0, MAX_SNIPPET)}…` : txt;
    const bodyShort = snippet
      ? `<div class="ov-seg-snippet">${escapeOvHtml(snippet)}</div>`
      : `<span style="color:#6b7380">${escapeOvHtml(st === "transcribing" ? "（等待结果）" : "（尚无文本）")}</span>`;
    let detailBlock = "";
    if (txt.length > MAX_SNIPPET) {
      detailBlock = `<details><summary>查看全文（${nChars} 字）</summary><div class="ov-seg-full">${escapeOvHtml(txt)}</div></details>`;
    }
    const err = s.error_message
      ? `<div style="color:#ff9d9d;margin-top:4px">${escapeOvHtml(s.error_message)}</div>`
      : "";
    return `<div class="ov-seg"><span class="ov-seg-meta">第 ${s.order_index} 段 · ${escapeOvHtml(label)} · ${nChars} 字 · ${dur}s</span>${bodyShort}${detailBlock}${err}</div>`;
  });
  box.innerHTML = lines.join("");
}

function applyOvUiState(sess, segments) {
  const recOn = !!(mediaRecorder && mediaRecorder.state === "recording");
  let state = "idle_no_session";
  if (!sessionId) {
    state = "idle_no_session";
  } else if (recOn) {
    state = "recording";
  } else if (sess && sess.status === "done") {
    state = "completed";
  } else if (sess && sess.status === "error") {
    state = "error";
  } else if (hasOvTranscribing(segments)) {
    state = "transcribing";
  } else if (
    Array.isArray(segments) &&
    segments.some((s) => s.status === "transcribed" && (s.raw_transcript || "").trim())
  ) {
    state = "ready_to_finalize";
  } else {
    state = "idle_session";
  }
  document.body.dataset.ovUiState = state;
}

function syncButtons(sess, segments) {
  const recOn = mediaRecorder && mediaRecorder.state === "recording";
  ov.rec.disabled = recOn;
  ov.stop.disabled = !sessionId || !recOn;
  const hasSeg =
    Array.isArray(segments) &&
    segments.some((s) => s.status === "transcribed" && (s.raw_transcript || "").trim());
  const doneOrBusy = sess && (sess.status === "done" || sess.status === "processing");
  ov.fin.disabled = !sessionId || !hasSeg || !!doneOrBusy;
  const ft = (sess && sess.final_text) || "";
  ov.copy.disabled = !sessionId || !String(ft).trim();
  updateFinalizeButtonLabel(sess || lastOvSession);
}

async function createOverlaySession() {
  const uc = S().lastUseCaseId("send_to_ai");
  const label = S().useCaseDisplayLabel(uc);
  const title = S().formatAutoSessionTitle(label);
  const session = await api("/sessions", {
    method: "POST",
    body: JSON.stringify({
      title,
      use_case_id: uc,
      rewrite_provider: S().DEFAULT_REWRITE,
    }),
  });
  S().rememberUseCaseId(uc);
  if (session.mode) {
    S().rememberSessionMode(session.mode);
  }
  sessionId = session.id;
  stopOvPolling();
}

async function ensureOverlaySessionForRecording() {
  if (!sessionId) {
    await createOverlaySession();
    return;
  }
  const data = await api(`/sessions/${sessionId}`);
  const st = data.session && data.session.status;
  if (st === "done") {
    await createOverlaySession();
  }
}

async function refresh() {
  if (!sessionId) {
    setStatus("点击录音将按上次场景自动创建会话。");
    lastOvSession = null;
    lastOvSegments = [];
    renderOvSegments([]);
    syncButtons(null, []);
    updateSceneLine(null);
    applyOvUiState(null, []);
    return;
  }
  const data = await api(`/sessions/${sessionId}`);
  const sess = data.session;
  lastOvSession = sess;
  const segments = data.segments || [];
  lastOvSegments = segments;
  const transcribing = segments.filter((s) => s.status === "transcribing").length;
  const done = segments.filter((s) => s.status === "transcribed").length;
  const err = segments.filter((s) => s.status === "error").length;
  setStatus(
    `会话 ${sessionId.slice(0, 10)}… · ${sess.status} · ${segments.length} 段（转写中 ${transcribing} · 已完成 ${done}${err ? ` · 失败 ${err}` : ""}）`
  );
  renderOvSegments(segments);
  syncButtons(sess, segments);
  updateSceneLine(sess);
  applyOvUiState(sess, segments);
}

async function dispatchSessionOutput(target) {
  if (!sessionId) return;
  let data;
  try {
    data = await api(`/sessions/${sessionId}/outputs`, {
      method: "POST",
      body: JSON.stringify({ target }),
    });
  } catch (e) {
    setStatus(String(e.message || e));
    return;
  }

  const text = data.final_text || "";

  if (!data.requires_client_execution) {
    const hint = data.written_path ? `已写入：${data.written_path}` : "已完成投递";
    setStatus(`终稿已生成。${hint}`);
    await refresh();
    return;
  }

  if (target === "clipboard") {
    const wr = await S().writeClipboardBestEffort(text);
    const ok = !!wr.ok;
    const detail = wr.error || "";
    try {
      await api(`/sessions/${sessionId}/output-feedback`, {
        method: "POST",
        body: JSON.stringify({ target: "clipboard", success: ok, detail }),
      });
    } catch (err) {
      console.warn("[SVI] output-feedback failed", err);
    }
    setStatus(ok ? "终稿已生成，已复制到剪贴板。" : detail || "复制到剪贴板失败");
    await refresh();
    return;
  }

  if (target === "active_window_paste") {
    if (!window.svi || typeof window.svi.pasteForeground !== "function") {
      try {
        await api(`/sessions/${sessionId}/output-feedback`, {
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
      setStatus("终稿已生成。前台粘贴仅桌面版可用，请改用复制或主工作台。");
      await refresh();
      return;
    }
    const r = await window.svi.pasteForeground(text);
    try {
      await api(`/sessions/${sessionId}/output-feedback`, {
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
    setStatus(r.ok ? "终稿已生成，已尝试粘贴到前台窗口。" : r.error || "粘贴失败");
    await refresh();
  }
}

async function dispatchClipboardOnly() {
  if (!sessionId) return;
  await dispatchSessionOutput("clipboard");
}

async function finalizeThenAutoOutput() {
  if (!sessionId || ov.fin.disabled) return;
  try {
    const session = await api(`/sessions/${sessionId}/finalize`, { method: "POST" });
    await refresh();
    if (session.status === "error") {
      setStatus(session.error_message || "整理失败");
      return;
    }
    if (session.status !== "done" || !String(session.final_text || "").trim()) {
      return;
    }
    const uc = session.use_case_id || S().lastUseCaseId("send_to_ai");
    const target = defaultOutputForUseCaseId(uc);
    if (target === "preview") {
      setStatus("终稿已生成。当前为预览类场景，请到主工作台查看全文或选择投递。");
      return;
    }
    await dispatchSessionOutput(target);
  } catch (e) {
    setStatus(String(e.message || e));
  }
}

function wire() {
  ov.newBtn.onclick = async () => {
    try {
      const uc = S().lastUseCaseId("send_to_ai");
      const session = await api("/sessions", {
        method: "POST",
        body: JSON.stringify({
          title: `悬浮-${new Date().toLocaleString("zh-CN")}`,
          use_case_id: uc,
          rewrite_provider: S().DEFAULT_REWRITE,
        }),
      });
      S().rememberUseCaseId(uc);
      if (session.mode) {
        S().rememberSessionMode(session.mode);
      }
      sessionId = session.id;
      stopOvPolling();
      await refresh();
    } catch (e) {
      setStatus(String(e.message || e));
    }
  };

  ov.rec.onclick = async () => {
    try {
      await ensureOverlaySessionForRecording();
    } catch (e) {
      setStatus(String(e.message || e));
      return;
    }
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
    syncButtons(lastOvSession, lastOvSegments);
    applyOvUiState(lastOvSession, lastOvSegments);
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
          ? "本段已上传，豆包转写进行中…"
          : "本段已上传并完成转写。"
      );
    } catch (e) {
      setStatus(String(e.message || e));
    }
  };

  ov.fin.onclick = async () => {
    await finalizeThenAutoOutput();
  };

  ov.copy.onclick = async () => {
    if (!sessionId || ov.copy.disabled) return;
    try {
      await dispatchClipboardOnly();
    } catch (e) {
      setStatus(String(e.message || e));
    }
  };

  if (ov.openMain && window.svi && typeof window.svi.showMainWindow === "function") {
    ov.openMain.onclick = async () => {
      try {
        await window.svi.showMainWindow();
      } catch (e) {
        setStatus(String(e.message || e));
      }
    };
  }
}

function toggleRecordShortcut() {
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
  await finalizeThenAutoOutput();
}

bind();
wire();

(async function init() {
  await loadUseCases();
  await refresh();
})();

if (window.svi && typeof window.svi.subscribeHotkey === "function") {
  window.svi.subscribeHotkey("toggleSegment", toggleRecordShortcut);
  window.svi.subscribeHotkey("finalize", finalizeShortcut);
}
