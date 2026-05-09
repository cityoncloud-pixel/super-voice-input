const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  session,
} = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");
const url = require("url");
const { spawn } = require("child_process");

const API_PORT = process.env.SVI_API_PORT || "8000";
const API_HOST = process.env.SVI_API_HOST || "127.0.0.1";

let mainWindow = null;
let tray = null;
let backendProcess = null;

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
  backendProcess = spawn(
    python,
    ["-m", "uvicorn", "local_api.main:app", "--host", API_HOST, "--port", API_PORT],
    { cwd: root, shell: true, stdio: "ignore", detached: false }
  );
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    try {
      backendProcess.kill();
    } catch {
      /* ignore */
    }
    backendProcess = null;
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

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === "media" || permission === "microphone") {
      callback(true);
      return;
    }
    callback(false);
  });

  startBackend();

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
