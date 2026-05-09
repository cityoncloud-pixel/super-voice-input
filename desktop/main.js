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
} = require("electron");
const http = require("http");
const fs = require("fs");
const url = require("url");
const { spawn } = require("child_process");

const API_PORT = process.env.SVI_API_PORT || "8000";
const API_HOST = process.env.SVI_API_HOST || "127.0.0.1";

let mainWindow = null;
let tray = null;
let backendProcess = null;
/** 仅为 true 时表示 uvicorn 由本进程 spawn，退出时才 kill，避免关掉用户手动起的占口服务 */
let backendSpawnedByUs = false;

/** 本地 HTTP 静态服务：页面必须用 http(s) 来源，否则 Chromium 视 file:// 为非安全上下文，getUserMedia 会被拒绝 */
let rendererHttpServer = null;
let rendererStaticPort = null;

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
  backendSpawnedByUs = true;
  backendProcess = spawn(
    python,
    ["-m", "uvicorn", "local_api.main:app", "--host", API_HOST, "--port", API_PORT],
    { cwd: root, shell: true, stdio: "ignore", detached: false }
  );
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

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === "media" || permission === "microphone") {
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
      { label: "显示 / 隐藏", click: () => toggleWindow() },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          app.isQuitting = true;
          stopBackend();
          stopRendererServer();
          app.quit();
        },
      },
    ])
  );
  tray.on("click", () => toggleWindow());

  globalShortcut.register("CommandOrControl+Shift+V", () => toggleWindow());

  createWindow().catch((err) => console.error("[SVI] createWindow failed", err));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((e) => console.error(e));
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopBackend();
  stopRendererServer();
});
