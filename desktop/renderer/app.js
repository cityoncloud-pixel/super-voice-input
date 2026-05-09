const apiBase = window.svi.apiBase;

let currentSessionId = null;
let modeOptions = [];

const el = {
  health: document.getElementById("health"),
  sessionTitle: document.getElementById("sessionTitle"),
  sessionMode: document.getElementById("sessionMode"),
  rewriteProvider: document.getElementById("rewriteProvider"),
  createSessionBtn: document.getElementById("createSessionBtn"),
  currentSession: document.getElementById("currentSession"),
  audioPath: document.getElementById("audioPath"),
  audioDuration: document.getElementById("audioDuration"),
  sttProvider: document.getElementById("sttProvider"),
  addSegmentBtn: document.getElementById("addSegmentBtn"),
  startRecordBtn: document.getElementById("startRecordBtn"),
  stopRecordBtn: document.getElementById("stopRecordBtn"),
  finalizeBtn: document.getElementById("finalizeBtn"),
  segments: document.getElementById("segments"),
  finalText: document.getElementById("finalText"),
  copyBtn: document.getElementById("copyBtn"),
  history: document.getElementById("history"),
  refreshHistoryBtn: document.getElementById("refreshHistoryBtn"),
  refinalizeMode: document.getElementById("refinalizeMode"),
  refinalizeBtn: document.getElementById("refinalizeBtn")
};

let mediaRecorder = null;
let recordingChunks = [];
let recordingStartAt = 0;

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const resp = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`${resp.status} ${body}`);
  }
  return resp.json();
}

function setModes(modes) {
  modeOptions = modes;
  el.sessionMode.innerHTML = "";
  el.refinalizeMode.innerHTML = "";
  for (const mode of modes) {
    const opt1 = document.createElement("option");
    opt1.value = mode;
    opt1.textContent = mode;
    el.sessionMode.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = mode;
    opt2.textContent = mode;
    el.refinalizeMode.appendChild(opt2);
  }
}

async function refreshHealth() {
  try {
    await api("/health");
    el.health.textContent = "API: online";
  } catch (err) {
    el.health.textContent = "API: offline（请先启动 uvicorn）";
  }
}

function renderSession(session) {
  if (!session) {
    el.currentSession.textContent = "未选择会话";
    return;
  }
  el.currentSession.textContent = `#${session.id} | ${session.title} | mode=${session.mode} | status=${session.status}`;
  el.finalText.value = session.final_text || "";
}

function segmentActions(segment) {
  const wrap = document.createElement("div");
  wrap.className = "row";

  const transcribeBtn = document.createElement("button");
  transcribeBtn.textContent = "重试转写";
  transcribeBtn.onclick = async () => {
    await api(`/segments/${segment.id}/transcribe/retry`, { method: "POST" });
    await refreshCurrentSession();
  };
  wrap.appendChild(transcribeBtn);

  const rerecordBtn = document.createElement("button");
  rerecordBtn.textContent = "重录";
  rerecordBtn.onclick = async () => {
    const audio = prompt("新的音频路径", segment.audio_file_path);
    if (!audio) return;
    const duration = Number(prompt("新的时长(秒)", String(segment.duration_seconds)));
    await api(`/segments/${segment.id}/rerecord`, {
      method: "POST",
      body: JSON.stringify({ audio_file_path: audio, duration_seconds: duration })
    });
    await refreshCurrentSession();
  };
  wrap.appendChild(rerecordBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "删除";
  deleteBtn.onclick = async () => {
    await api(`/segments/${segment.id}`, { method: "DELETE" });
    await refreshCurrentSession();
  };
  wrap.appendChild(deleteBtn);

  return wrap;
}

function renderSegments(segments) {
  el.segments.innerHTML = "";
  if (!segments.length) {
    el.segments.textContent = "暂无片段";
    return;
  }
  for (const s of segments) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>order=${s.order_index} | status=${s.status} | duration=${s.duration_seconds}s</div>
      <div>audio=${s.audio_file_path}</div>
      <div>transcript=${s.raw_transcript || "(empty)"}</div>
      <div>error=${s.error_message || "(none)"}</div>
    `;
    div.appendChild(segmentActions(s));
    el.segments.appendChild(div);
  }
}

async function refreshCurrentSession() {
  if (!currentSessionId) return;
  const data = await api(`/sessions/${currentSessionId}`);
  renderSession(data.session);
  renderSegments(data.segments);
}

async function refreshHistory() {
  const sessions = await api("/sessions");
  el.history.innerHTML = "";
  for (const s of sessions) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div>${s.title} | ${s.mode} | ${s.status}</div><div>${s.id}</div>`;
    const useBtn = document.createElement("button");
    useBtn.textContent = "加载";
    useBtn.onclick = async () => {
      currentSessionId = s.id;
      el.refinalizeMode.value = s.mode;
      await refreshCurrentSession();
    };
    div.appendChild(useBtn);
    el.history.appendChild(div);
  }
}

el.createSessionBtn.onclick = async () => {
  const body = {
    title: el.sessionTitle.value || "untitled-session",
    mode: el.sessionMode.value,
    rewrite_provider: el.rewriteProvider.value || "deepseek"
  };
  const session = await api("/sessions", { method: "POST", body: JSON.stringify(body) });
  currentSessionId = session.id;
  await refreshCurrentSession();
  await refreshHistory();
};

el.addSegmentBtn.onclick = async () => {
  if (!currentSessionId) return;
  await api(`/sessions/${currentSessionId}/segments`, {
    method: "POST",
    body: JSON.stringify({
      audio_file_path: el.audioPath.value || `audio/${Date.now()}.wav`,
      duration_seconds: Number(el.audioDuration.value || 0),
      stt_provider: el.sttProvider.value || "doubao"
    })
  });
  await refreshCurrentSession();
};

el.startRecordBtn.onclick = async () => {
  if (!currentSessionId) return;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recordingChunks = [];
  mediaRecorder = new MediaRecorder(stream);
  recordingStartAt = Date.now();
  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordingChunks.push(event.data);
    }
  };
  mediaRecorder.start();
};

el.stopRecordBtn.onclick = async () => {
  if (!mediaRecorder || mediaRecorder.state !== "recording") return;
  await new Promise((resolve) => {
    mediaRecorder.onstop = resolve;
    mediaRecorder.stop();
  });
  const tracks = mediaRecorder.stream ? mediaRecorder.stream.getTracks() : [];
  for (const t of tracks) t.stop();
  const duration = (Date.now() - recordingStartAt) / 1000;
  const blob = new Blob(recordingChunks, { type: "audio/webm" });
  const form = new FormData();
  form.append("file", blob, `seg-${Date.now()}.webm`);
  form.append("duration_seconds", String(duration));
  form.append("stt_provider", el.sttProvider.value || "doubao");
  const up = await fetch(`${apiBase}/sessions/${currentSessionId}/segments/upload?auto_transcribe=true`, {
    method: "POST",
    body: form
  });
  if (!up.ok) {
    const t = await up.text();
    alert(`上传失败: ${up.status} ${t}`);
    return;
  }
  await refreshCurrentSession();
};

el.finalizeBtn.onclick = async () => {
  if (!currentSessionId) return;
  const session = await api(`/sessions/${currentSessionId}/finalize`, { method: "POST" });
  renderSession(session);
  await refreshCurrentSession();
  await refreshHistory();
};

el.refinalizeBtn.onclick = async () => {
  if (!currentSessionId) return;
  const session = await api(`/sessions/${currentSessionId}/refinalize`, {
    method: "POST",
    body: JSON.stringify({
      mode: el.refinalizeMode.value,
      rewrite_provider: el.rewriteProvider.value || "deepseek"
    })
  });
  renderSession(session);
  await refreshCurrentSession();
  await refreshHistory();
};

el.copyBtn.onclick = async () => {
  await navigator.clipboard.writeText(el.finalText.value || "");
};

el.refreshHistoryBtn.onclick = refreshHistory;

async function init() {
  await refreshHealth();
  try {
    const modes = await api("/modes");
    setModes(modes.modes);
  } catch (err) {
    setModes([
      "intent_cleanup",
      "obsidian_note",
      "task_requirement",
      "faithful_transcript"
    ]);
  }
  await refreshHistory();
}

init();
