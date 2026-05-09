const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const API_PORT = process.env.SVI_API_PORT || "8000";
const API_HOST = process.env.SVI_API_HOST || "127.0.0.1";

let mainWindow = null;
let tray = null;
let backendProcess = null;

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function toggleWindow() {
  if (!mainWindow) createWindow();
  else if (mainWindow.isVisible()) mainWindow.hide();
  else mainWindow.show();
}

app.whenReady().then(() => {
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
          app.quit();
        },
      },
    ])
  );
  tray.on("click", () => toggleWindow());

  globalShortcut.register("CommandOrControl+Shift+V", () => toggleWindow());

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopBackend();
});
