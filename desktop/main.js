const path = require("path");
// 与 Python 端一致：从仓库根 .env 读 SVI_API_PORT 等；若仅靠 process.env，npm run desktop 时永远读不到 .env，会与 uvicorn 实际端口不一致。
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  session,
  dialog,
  ipcMain,
  clipboard,
} = require("electron");

/** 禁止第二个桌面进程：否则会再次 spawn uvicorn，典型报错为端口占用(10048)。 */
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

/** 默认启动时打开悬浮窗（可与工作台并存）；设为 0 则仅托盘手动打开，快捷键仍会按需创建悬浮窗。 */
const SHOW_OVERLAY_ON_START =
  (process.env.SVI_SHOW_OVERLAY_ON_START || "1").toLowerCase() !== "0" &&
  (process.env.SVI_SHOW_OVERLAY_ON_START || "").toLowerCase() !== "false";
const http = require("http");
const fs = require("fs");
const url = require("url");
const { spawn, spawnSync } = require("child_process");

const API_PORT = process.env.SVI_API_PORT || "8000";
const API_HOST = process.env.SVI_API_HOST || "127.0.0.1";
const AUTO_TUNNEL = (process.env.SVI_AUTO_TUNNEL || "1").toLowerCase() !== "0";

let mainWindow = null;
let overlayWindow = null;
let tray = null;
let backendProcess = null;
/** 仅为 true 时表示 uvicorn 由本进程 spawn，退出时才 kill，避免关掉用户手动起的占口服务 */
let backendSpawnedByUs = false;

/** 本地 HTTP 静态服务：页面必须用 http(s) 来源，否则 Chromium 视 file:// 为非安全上下文，getUserMedia 会被拒绝 */
let rendererHttpServer = null;
let rendererStaticPort = null;
let tunnelProcess = null;
let tunnelPublicUrl = null;

ipcMain.handle("svi-write-clipboard", (_evt, text) => {
  try {
    clipboard.writeText(String(text ?? ""));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? String(e.message) : String(e) };
  }
});

ipcMain.handle("svi-paste-foreground", async (_evt, text) => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  const choice = await dialog.showMessageBox(win || undefined, {
    type: "info",
    buttons: ["确定", "取消"],
    defaultId: 0,
    cancelId: 1,
    title: "粘贴到前台窗口",
    message: "请先切换到目标应用，并将光标放在输入框内，然后点「确定」。",
    noLink: true,
  });
  if (choice.response !== 0) {
    return { ok: false, error: "cancelled" };
  }
  try {
    clipboard.writeText(String(text ?? ""));
    await new Promise((r) => setTimeout(r, 200));
    if (process.platform === "win32") {
      const { execFileSync } = require("child_process");
      execFileSync(
        "powershell",
        [
          "-NoProfile",
          "-STA",
          "-Command",
          "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
        ],
        { timeout: 8000, windowsHide: true },
      );
    } else if (process.platform === "darwin") {
      const { execFileSync } = require("child_process");
      execFileSync(
        "osascript",
        ["-e", 'tell application "System Events" to keystroke "v" using command down'],
        { timeout: 8000 },
      );
    } else {
      return { ok: false, error: "当前平台不支持自动粘贴，请手动 Ctrl+V（剪贴板已写入）。" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? String(e.message) : String(e) };
  }
});

ipcMain.handle("svi-show-main", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
  return { ok: true };
});

function mimeForExt(ext) {
  const m = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
  };
  return m[ext] || "application/octet-stream";
}

function startRendererHttpServer(staticRoot) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const pathname = url.parse(req.url).pathname || "/";
      let rel = pathname === "/" ? "index.html" : pathname.slice(1);
      try {
        rel = decodeURIComponent(rel);
      } catch {
        res.writeHead(400);
        res.end("Bad request");
        return;
      }
      rel = rel.replace(/\\/g, "/");
      const filePath = path.join(staticRoot, rel);
      const rootNorm = path.normalize(staticRoot + path.sep);
      const fileNorm = path.normalize(filePath);
      if (!fileNorm.startsWith(rootNorm)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      fs.readFile(fileNorm, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.setHeader("Content-Type", mimeForExt(path.extname(fileNorm)));
        res.writeHead(200);
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
    server.on("error", reject);
  });
}

async function ensureRendererServer() {
  if (rendererHttpServer && rendererStaticPort) {
    return rendererStaticPort;
  }
  const staticRoot = path.join(__dirname, "renderer");
  const { server, port } = await startRendererHttpServer(staticRoot);
  rendererHttpServer = server;
  rendererStaticPort = port;
  return port;
}

function stopRendererServer() {
  if (rendererHttpServer) {
    try {
      rendererHttpServer.close();
    } catch {
      /* ignore */
    }
    rendererHttpServer = null;
    rendererStaticPort = null;
  }
}

function startBackend() {
  if (process.env.SVI_SKIP_BACKEND === "1") return;
  const root = path.join(__dirname, "..");
  const python = process.env.SVI_PYTHON || "python";
  const uvicornArgs = ["-m", "uvicorn", "local_api.main:app", "--host", API_HOST, "--port", API_PORT];
  // 开发时改 Python 后自动重载子进程（单进程起后端时用 npm run desktop:reload）
  if (process.env.SVI_UVICORN_RELOAD === "1") {
    uvicornArgs.push("--reload");
  }
  backendSpawnedByUs = true;
  backendProcess = spawn(python, uvicornArgs, { cwd: root, shell: true, stdio: "ignore", detached: false });
  backendProcess.on("exit", (code, signal) => {
    if (code !== 0 && code != null) {
      console.error(`[SVI] uvicorn 已退出 code=${code} signal=${signal || ""}（检查 Python 依赖与端口 ${API_PORT}）`);
    }
    backendProcess = null;
    backendSpawnedByUs = false;
  });
}

/** 若该端口已有 API（例如终端里先起了 uvicorn），则不再 spawn，避免 WinError 10048 端口占用 */
async function ensureBackendRunning() {
  if (process.env.SVI_SKIP_BACKEND === "1") return;
  try {
    await pingHealthOnce();
    console.log(`[SVI] 检测到 ${API_HOST}:${API_PORT} 已有 /health，跳过启动 uvicorn（避免与已有进程抢端口）`);
    return;
  } catch {
    /* 无人监听，下面启动 */
  }
  startBackend();
}

/** 轮询直到 FastAPI /health 可访问，避免窗口打开过快导致 fetch 全部 Failed to fetch */
function pingHealthOnce() {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${API_HOST}:${API_PORT}/health`, (res) => {
      res.resume();
      if (res.statusCode === 200) resolve();
      else reject(new Error(`HTTP ${res.statusCode}`));
    });
    req.on("error", reject);
    req.setTimeout(2000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

function waitForBackend(maxMs, intervalMs = 220) {
  const deadline = Date.now() + maxMs;
  return new Promise((resolve, reject) => {
    function next() {
      pingHealthOnce()
        .then(resolve)
        .catch(() => {
          if (Date.now() >= deadline) {
            reject(new Error(`${maxMs}ms 内无法连接 http://${API_HOST}:${API_PORT}/health`));
            return;
          }
          setTimeout(next, intervalMs);
        });
    }
    next();
  });
}

function stopBackend() {
  if (!backendSpawnedByUs) return;
  if (backendProcess && !backendProcess.killed) {
    try {
      backendProcess.kill();
    } catch {
      /* ignore */
    }
    backendProcess = null;
  }
  backendSpawnedByUs = false;
}

function stopTunnel() {
  if (tunnelProcess && !tunnelProcess.killed) {
    try {
      tunnelProcess.kill();
    } catch {
      /* ignore */
    }
  }
  tunnelProcess = null;
  tunnelPublicUrl = null;
}

function canExecute(cmd) {
  if (!cmd) return false;
  const s = String(cmd).trim();
  if (!s) return false;
  // If a path is provided (SVI_CLOUDFLARED_PATH), check file existence directly.
  if (s.includes("\\") || s.includes("/") || s.toLowerCase().endsWith(".exe")) {
    try {
      return fs.existsSync(s);
    } catch {
      return false;
    }
  }
  // Otherwise, resolve via PATH.
  try {
    const r = spawnSync("where", [s], { encoding: "utf-8" });
    return r.status === 0;
  } catch {
    return false;
  }
}

function startCloudflaredTunnel(localUrl) {
  return new Promise((resolve, reject) => {
    const exe = process.env.SVI_CLOUDFLARED_PATH || "cloudflared";
    const args = ["tunnel", "--url", localUrl, "--metrics", "127.0.0.1:0"];
    const p = spawn(exe, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let done = false;
    const lastLines = [];
    function keepLine(line) {
      const s = String(line || "").trimEnd();
      if (!s) return;
      lastLines.push(s);
      if (lastLines.length > 80) lastLines.shift();
    }

    function feed(chunk) {
      String(chunk)
        .split(/\r?\n/)
        .forEach((line) => {
          keepLine(line);
          const m = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
          if (m && !done) {
            done = true;
            resolve({ process: p, publicUrl: m[0] });
          }
        });
    }

    p.stdout.on("data", feed);
    p.stderr.on("data", feed);
    p.on("error", reject);
    p.on("exit", (code) => {
      if (!done) {
        const tail = lastLines.slice(-30).join("\n");
        reject(new Error(`cloudflared exited code=${code}\n\n${tail}`));
      }
    });
    setTimeout(() => {
      if (!done) {
        try {
          p.kill();
        } catch {
          /* ignore */
        }
        const tail = lastLines.slice(-30).join("\n");
        reject(new Error(`cloudflared tunnel timeout\n\n${tail}`));
      }
    }, 25000);
  });
}

async function postBackendPublicBaseUrl(baseUrl) {
  const payload = JSON.stringify({ base_url: baseUrl });
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: "POST",
        host: API_HOST,
        port: Number(API_PORT),
        path: "/config/public_base_url",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 5000,
      },
      (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else reject(new Error(`HTTP ${res.statusCode}`));
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function ensureTunnelAndSetBackendBaseUrl() {
  if (!AUTO_TUNNEL) return;
  if ((process.env.SVI_PUBLIC_BASE_URL || "").trim()) return;
  if (tunnelPublicUrl) return;

  const localUrl = `http://${API_HOST}:${API_PORT}`;
  const exe = process.env.SVI_CLOUDFLARED_PATH || "cloudflared";
  const hasCloudflared = canExecute(exe);
  if (!hasCloudflared) {
    dialog.showErrorBox(
      "Super Voice Input — 缺少自动公网隧道依赖",
      "豆包云端需要公网可访问的音频 URL。本应用可自动建立临时公网隧道，但你尚未安装 cloudflared。\n\n" +
        "请安装 Cloudflare Tunnel（cloudflared），确保命令 `cloudflared` 可用后重启应用。\n\n" +
        "安装完成后无需再手动配置 SVI_PUBLIC_BASE_URL。"
    );
    return;
  }

  try {
    stopTunnel();
    const { process: tp, publicUrl } = await startCloudflaredTunnel(localUrl);
    tunnelProcess = tp;
    tunnelPublicUrl = String(publicUrl).replace(/\/+$/, "");
    console.log(`[SVI] Auto tunnel ready: ${tunnelPublicUrl} -> ${localUrl}`);
    await postBackendPublicBaseUrl(tunnelPublicUrl);
  } catch (e) {
    console.error("[SVI] auto tunnel failed", e);
    dialog.showErrorBox(
      "Super Voice Input — 自动公网隧道失败",
      `无法为豆包建立公网隧道：${e && e.message ? e.message : String(e)}\n\n` +
        "你仍可手动设置 SVI_PUBLIC_BASE_URL（ngrok）或使用 DOUBAO_AUDIO_URL_PREFIX。"
    );
    stopTunnel();
  }
}

async function createOverlayWindow() {
  const port = await ensureRendererServer();
  const apiBaseArg = `--svi-api-base=http://${API_HOST}:${API_PORT}`;
  overlayWindow = new BrowserWindow({
    width: 360,
    height: 360,
    minWidth: 320,
    minHeight: 280,
    show: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    skipTaskbar: false,
    title: "超级语音输入 · 悬浮",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [apiBaseArg],
    },
  });
  overlayWindow.loadURL(`http://127.0.0.1:${port}/overlay.html`);
  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
  try {
    const { screen } = require("electron");
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    overlayWindow.setPosition(Math.max(40, sw - 380), 48);
  } catch {
    /* ignore */
  }
}

async function createWindow() {
  const port = await ensureRendererServer();
  const apiBaseArg = `--svi-api-base=http://${API_HOST}:${API_PORT}`;

  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [apiBaseArg],
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}/index.html`);
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function toggleWindow() {
  if (!mainWindow) {
    createWindow().catch((err) => console.error("[SVI] createWindow failed", err));
  } else if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
  }
}

app.on("second-instance", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
    overlayWindow.focus();
  }
});

/** macOS / 部分环境下窗口被全部关闭后的恢复；须在 whenReady 外注册 */
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((e) => console.error("[SVI] activate createWindow", e));
  }
});

function registerShortcut(accelerator, fn) {
  try {
    const ok = globalShortcut.register(accelerator, fn);
    if (!ok) {
      console.error(
        `[SVI] 快捷键未注册成功（可能被系统或其它软件占用）: ${accelerator}`
      );
    }
  } catch (e) {
    console.error(`[SVI] 快捷键注册异常 ${accelerator}`, e);
  }
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === "media" || permission === "microphone") {
      callback(true);
      return;
    }
    // Chromium 偶发对 Clipboard API 发起权限询问；放行可减少渲染进程 navigator.clipboard 被拒（仍以主进程 IPC 为主）。
    if (permission && String(permission).toLowerCase().includes("clipboard")) {
      callback(true);
      return;
    }
    callback(false);
  });

  const skipSpawn = process.env.SVI_SKIP_BACKEND === "1";
  if (!skipSpawn) {
    await ensureBackendRunning();
  }

  const waitMs = skipSpawn ? 35000 : 55000;
  try {
    await waitForBackend(waitMs);
    await ensureTunnelAndSetBackendBaseUrl();
  } catch (err) {
    console.error("[SVI] 本地 API 未就绪:", err);
    dialog.showErrorBox(
      "Super Voice Input — 本地 API 不可用",
      `无法访问 http://${API_HOST}:${API_PORT}\n\n` +
        (skipSpawn
          ? `你已设置环境变量 SVI_SKIP_BACKEND=1，请先在本项目根目录手动启动：\n\npython -m uvicorn local_api.main:app --host ${API_HOST} --port ${API_PORT}\n\n`
          : `请在本项目根目录安装依赖并确认端口未被占用，可在终端执行：\n\npython -m uvicorn local_api.main:app --host ${API_HOST} --port ${API_PORT}\n\n查看具体报错。\n\n`) +
        `详情：${err && err.message ? err.message : String(err)}`
    );
  }

  const tinyPng = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
  );
  tray = new Tray(tinyPng);
  tray.setToolTip("Super Voice Input");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示 / 隐藏 主面板", click: () => toggleWindow() },
      {
        label: "显示悬浮窗",
        click: () => {
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.show();
            overlayWindow.focus();
          } else {
            createOverlayWindow().catch((e) => console.error(e));
          }
        },
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          app.isQuitting = true;
          stopBackend();
          stopRendererServer();
          stopTunnel();
          app.quit();
        },
      },
    ])
  );
  tray.on("click", () => toggleWindow());

  registerShortcut("CommandOrControl+Shift+V", () => toggleWindow());

  registerShortcut("CommandOrControl+Alt+Space", async () => {
    try {
      if (!overlayWindow || overlayWindow.isDestroyed()) {
        await createOverlayWindow();
      }
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send("svi-hotkey-record-toggle");
        if (!overlayWindow.isVisible()) overlayWindow.show();
      }
    } catch (e) {
      console.error("[SVI] overlay shortcut", e);
    }
  });
  registerShortcut("CommandOrControl+Alt+Enter", async () => {
    try {
      if (!overlayWindow || overlayWindow.isDestroyed()) {
        await createOverlayWindow();
      }
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send("svi-hotkey-finalize");
        if (!overlayWindow.isVisible()) overlayWindow.show();
      }
    } catch (e) {
      console.error("[SVI] overlay finalize shortcut", e);
    }
  });

  createWindow().catch((err) => console.error("[SVI] createWindow failed", err));
  if (SHOW_OVERLAY_ON_START) {
    createOverlayWindow().catch((err) => console.error("[SVI] createOverlayWindow failed", err));
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopBackend();
  stopRendererServer();
  stopTunnel();
});
