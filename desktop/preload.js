const { contextBridge } = require("electron");

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
});
