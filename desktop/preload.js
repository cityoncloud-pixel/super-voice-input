const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { contextBridge, ipcRenderer } = require("electron");

function readApiBase() {
  const prefix = "--svi-api-base=";
  const hit = process.argv.find((a) => typeof a === "string" && a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const host = process.env.SVI_API_HOST || "127.0.0.1";
  const port = process.env.SVI_API_PORT || "8000";
  return `http://${host}:${port}`;
}

contextBridge.exposeInMainWorld("svi", {
  apiBase: readApiBase(),
  writeClipboard: (text) => ipcRenderer.invoke("svi-write-clipboard", text),
  pasteForeground: (text) => ipcRenderer.invoke("svi-paste-foreground", text),
  /** @param {'toggleSegment'|'finalize'} action */
  subscribeHotkey: (action, cb) => {
    const map = { toggleSegment: "svi-hotkey-record-toggle", finalize: "svi-hotkey-finalize" };
    const channel = map[action];
    if (!channel || typeof cb !== "function") return () => {};
    const fn = () => {
      try {
        cb();
      } catch {
        /* ignore */
      }
    };
    ipcRenderer.on(channel, fn);
    return () => ipcRenderer.removeListener(channel, fn);
  },
});
