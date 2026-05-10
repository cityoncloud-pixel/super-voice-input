/**
 * 工作台与悬浮窗共用的 API / 录音上传约定，避免两套参数不一致。
 * 需在 app.js / overlay.js 之前加载。
 */
(function () {
  const DEFAULT_STT = "doubao";
  const DEFAULT_REWRITE = "deepseek";

  const LS_MODE = "svi.lastSessionMode";

  function pickMimeType() {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    for (let i = 0; i < candidates.length; i += 1) {
      const t = candidates[i];
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  }

  /** 与 app.js 开始录音一致 */
  function createRecorder(waveStream) {
    const mime = pickMimeType();
    try {
      return mime ? new MediaRecorder(waveStream, { mimeType: mime }) : new MediaRecorder(waveStream);
    } catch {
      return new MediaRecorder(waveStream);
    }
  }

  /** 与 app.js `api()` 一致的错误提示（含端口占用线索） */
  async function fetchApi(apiBase, path, options) {
    const headers = { ...(options.headers || {}) };
    if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    let resp;
    try {
      resp = await fetch(`${apiBase}${path}`, { ...options, headers });
    } catch (e) {
      const name = e && e.name;
      const detail = e && e.message ? e.message : String(e);
      const hint =
        name === "TypeError" || /fetch|network|Failed to fetch/i.test(detail)
          ? `无法连接 API：${apiBase}。\n\n若已手动启动后端，请确认端口与 .env / 环境变量 SVI_API_PORT 一致；若端口占用(10048)，请关掉重复的 uvicorn 或勿重复启动第二个桌面进程。\n\n手动启动（端口请与上方一致）：\npython -m uvicorn local_api.main:app --host 127.0.0.1 --port <端口>`
          : detail;
      throw new Error(hint);
    }
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`${resp.status} ${body}`);
    }
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) return resp.json();
    return resp.text();
  }

  /** 与 app.js 停止录音后上传 multipart 一致 */
  async function uploadSegmentAudio(apiBase, sessionId, blob, mimeFromRecorder, durationSeconds, sttProvider) {
    const mime = mimeFromRecorder || "audio/webm";
    const ext = mime.includes("mp4") ? "m4a" : "webm";
    const form = new FormData();
    form.append("file", blob, `seg-${Date.now()}.${ext}`);
    form.append("duration_seconds", String(durationSeconds));
    form.append("stt_provider", sttProvider || DEFAULT_STT);
    const up = await fetch(
      `${apiBase}/sessions/${sessionId}/segments/upload?auto_transcribe=true`,
      { method: "POST", body: form }
    );
    if (!up.ok) {
      const t = await up.text();
      throw new Error(`${up.status} ${t}`);
    }
    return up.json();
  }

  function rememberSessionMode(mode) {
    try {
      if (mode) localStorage.setItem(LS_MODE, mode);
    } catch {
      /* ignore */
    }
  }

  function lastSessionMode(fallback) {
    try {
      const v = localStorage.getItem(LS_MODE);
      return v || fallback || "intent_cleanup";
    } catch {
      return fallback || "intent_cleanup";
    }
  }

  /**
   * 写入剪贴板：Electron 下优先主进程（无权限门闩）；避免依赖 navigator.clipboard（常报 Write permission denied）。
   * 回退：隐藏 textarea + execCommand('copy')。
   */
  function fallbackExecCommandCopy(t) {
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, t.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return { ok: !!ok, error: ok ? "" : "execCommand('copy') 失败" };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  async function writeClipboardBestEffort(text) {
    const t = String(text ?? "");
    if (window.svi && typeof window.svi.writeClipboard === "function") {
      try {
        const r = await window.svi.writeClipboard(t);
        if (r && r.ok) {
          return { ok: true, error: "" };
        }
        const fb = fallbackExecCommandCopy(t);
        return fb.ok ? fb : { ok: false, error: (r && r.error) || fb.error || "剪贴板写入失败" };
      } catch (e) {
        const fb = fallbackExecCommandCopy(t);
        return fb.ok ? fb : { ok: false, error: String(e.message || e) };
      }
    }
    const fb = fallbackExecCommandCopy(t);
    if (fb.ok) {
      return fb;
    }
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(t);
        return { ok: true, error: "" };
      }
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
    return { ok: false, error: fb.error || "无法写入剪贴板" };
  }

  window.SVI_SHARED = {
    DEFAULT_STT,
    DEFAULT_REWRITE,
    LS_MODE,
    pickMimeType,
    createRecorder,
    fetchApi,
    uploadSegmentAudio,
    rememberSessionMode,
    lastSessionMode,
    fallbackExecCommandCopy,
    writeClipboardBestEffort,
  };
})();
