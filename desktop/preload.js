const { contextBridge } = require("electron");

const host = process.env.SVI_API_HOST || "127.0.0.1";
const port = process.env.SVI_API_PORT || "8000";

contextBridge.exposeInMainWorld("svi", {
  apiBase: `http://${host}:${port}`,
});
