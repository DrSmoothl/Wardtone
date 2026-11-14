import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
  nativeTheme,
} from "electron";
import { Worker } from "node:worker_threads";
import path from "node:path";
import * as fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { ApiResult, AppState } from "../shared/model";
import { themeCatalog } from "../shared/themes";

if (!app.isPackaged && process.env.WARDTONE_DATA)
  app.setPath("userData", process.env.WARDTONE_DATA);
let window: BrowserWindow, backend: Worker;
const requests = new Map<
  string,
  { resolve: (value: ApiResult) => void; reject: (error: Error) => void }
>();
let backendError: Error | undefined;
let quitting = false;
let closeApproved = false,
  rendererReady = false;
function requestClose() {
  window.webContents.send("wardtone:close-request");
  void recordMain("info", "window", "window.close-requested", {}).catch(
    (error) => {
      console.error("window.close-requested log failed", error);
      window.webContents.send("wardtone:log", {
        time: new Date().toISOString(),
        level: "error",
        operation: "window",
        event: "desktop.error",
        detail: String(error),
      });
    },
  );
}
async function recordMain(
  level: "info" | "error",
  operation: string,
  event: string,
  detail: unknown,
) {
  const dir = path.join(app.getPath("userData"), "logs");
  await fs.mkdir(dir, { recursive: true });
  const line = {
    time: new Date().toISOString(),
    level,
    operation,
    event,
    detail,
  };
  await fs.appendFile(
    path.join(dir, "main.jsonl"),
    JSON.stringify(line) + "\n",
    { mode: 0o600 },
  );
  if (window && !window.isDestroyed())
    window.webContents.send("wardtone:log", line);
}
function call(action: string, input?: unknown): Promise<ApiResult> {
  if (backendError) return Promise.reject(backendError);
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    requests.set(id, { resolve, reject });
    backend.postMessage({ id, action, input });
  });
}
const publicActions = new Set([
  "state",
  "config.save",
  "config.repair",
  "discover.local",
  "discover.devices",
  "discover.adb",
  "location.select",
  "scan",
  "preview.clip",
  "preview.entry",
  "audio.encode",
  "pack.new",
  "pack.save",
  "plan",
  "apply",
  "restore",
  "logs",
]);
async function runAction(action: string, input: unknown): Promise<ApiResult> {
  if (action === "window.ready") {
    rendererReady = true;
    return { ok: true, data: null };
  }
  if (action === "window.confirmClose") {
    await recordMain("info", "window", "window.close-approved", {});
    closeApproved = true;
    setImmediate(() => app.quit());
    return { ok: true, data: null };
  }
  if (action === "pick.folder") {
    const result = await dialog.showOpenDialog(window, {
      title: "选择游戏安装目录或 Bundles 文件夹",
      properties: ["openDirectory"],
    });
    if (result.canceled) return { ok: true, data: [] };
    return call("discover.folder", result.filePaths[0]);
  }
  if (action === "pick.audio") {
    const multiple =
      (input as { multiple?: boolean } | undefined)?.multiple === true;
    const result = await dialog.showOpenDialog(window, {
      title: "选择替换音频",
      properties: multiple ? ["openFile", "multiSelections"] : ["openFile"],
      filters: [
        {
          name: "音频",
          extensions: ["wav", "mp3", "ogg", "flac", "m4a", "aac"],
        },
      ],
    });
    if (result.canceled) return { ok: true, data: [] };
    const files = [];
    for (const file of result.filePaths) {
      if ((await fs.stat(file)).size > 64 * 1024 * 1024)
        throw new Error("音频文件超过 64 MB");
      files.push({
        name: path.basename(file),
        bytes: new Uint8Array(await fs.readFile(file)),
      });
    }
    return { ok: true, data: files };
  }
  if (action === "pack.import") {
    const result = await dialog.showOpenDialog(window, {
      title: "添加分享语音包",
      properties: ["openFile"],
      filters: [{ name: "戍声语音包", extensions: ["ssvoice"] }],
    });
    if (result.canceled) return { ok: true, data: null };
    return call("pack.importFile", result.filePaths[0]);
  }
  if (action === "pack.importBundle") {
    if (typeof input !== "string") throw new Error("请选择目标资源包");
    const result = await dialog.showOpenDialog(window, {
      title: "导入已有游戏语音包",
      properties: ["openFile"],
      filters: [{ name: "Unity 资源包", extensions: ["ab"] }],
    });
    if (result.canceled) return { ok: true, data: [] };
    return call("pack.importBundle", {
      file: result.filePaths[0],
      target: input,
    });
  }
  if (action === "pack.export" || action === "diagnostics") {
    const result = await call(action, input);
    if (!result.ok) return result;
    const name =
      action === "diagnostics"
        ? "戍声诊断-" + new Date().toISOString().slice(0, 10) + ".zip"
        : "语音包.ssvoice";
    const saved = await dialog.showSaveDialog(window, {
      title: action === "diagnostics" ? "导出诊断" : "导出语音包",
      defaultPath: name,
      filters: [
        {
          name: action === "diagnostics" ? "诊断记录" : "戍声语音包",
          extensions: [action === "diagnostics" ? "zip" : "ssvoice"],
        },
      ],
    });
    if (saved.canceled || !saved.filePath) return { ok: true, data: null };
    await fs.writeFile(saved.filePath, Buffer.from(result.data as Uint8Array));
    return { ok: true, data: saved.filePath };
  }
  if (action === "open.data") {
    const error = await shell.openPath(app.getPath("userData"));
    if (error) throw new Error(error);
    return { ok: true, data: null };
  }
  if (!publicActions.has(action)) throw new Error("不允许的界面操作");
  const result = await call(action, input);
  if (
    result.ok &&
    (action === "state" ||
      action === "config.save" ||
      action === "config.repair")
  ) {
    const config = (result.data as AppState).config;
    nativeTheme.themeSource = themeCatalog[config.theme].appearance;
    window.webContents.setZoomFactor(config.zoom);
  }
  return result;
}
async function start() {
  await app.whenReady();
  const icon = path.join(app.getAppPath(), "resources", "icon.png");
  if (process.platform === "darwin") app.dock?.setIcon(icon);
  backend = new Worker(path.join(__dirname, "backend.cjs"), {
    workerData: {
      dataPath: app.getPath("userData"),
      codebooksPath: path.join(
        app.getAppPath(),
        "resources",
        "vorbis-codebooks.json",
      ),
      version: app.getVersion(),
    },
  });
  backend.on("message", (message) => {
    if (message.type === "log") {
      if (window && !window.isDestroyed())
        window.webContents.send("wardtone:log", message.line);
      return;
    }
    if (message.type === "response") {
      const pending = requests.get(message.id);
      requests.delete(message.id);
      pending?.resolve(message.result);
    }
  });
  const failed = (error: Error) => {
    if (backendError || quitting) return;
    backendError = error;
    void recordMain("error", "backend", "backend.stopped", {
      message: error.message,
      stack: error.stack,
    }).catch((logError) =>
      dialog.showErrorBox("日志写入失败", String(logError)),
    );
    for (const pending of requests.values()) pending.reject(error);
    requests.clear();
    if (window && !window.isDestroyed())
      window.webContents.send("wardtone:log", {
        time: new Date().toISOString(),
        level: "error",
        operation: "backend",
        event: "backend.stopped",
        detail: error.message,
      });
  };
  backend.on("error", failed);
  backend.on("exit", (code) => {
    if (!quitting) failed(new Error("资源服务异常退出：" + code));
  });
  window = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 940,
    minHeight: 650,
    title: "Wardtone · 戍声",
    icon,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#181a20" : "#f8f9fc",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.once("ready-to-show", () => window.show());
  window.on("close", (event) => {
    if (!closeApproved && rendererReady && !window.webContents.isCrashed()) {
      event.preventDefault();
      requestClose();
    }
  });
  app.on("before-quit", (event) => {
    if (
      !closeApproved &&
      rendererReady &&
      window &&
      !window.isDestroyed() &&
      !window.webContents.isCrashed()
    ) {
      event.preventDefault();
      requestClose();
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  window.webContents.session.setPermissionCheckHandler(() => false);
  ipcMain.handle(
    "wardtone:invoke",
    async (event, action: unknown, input: unknown): Promise<ApiResult> => {
      if (
        event.sender.id !== window.webContents.id ||
        event.senderFrame !== window.webContents.mainFrame ||
        typeof action !== "string"
      )
        throw new Error("IPC 来源无效");
      try {
        return await runAction(action, input);
      } catch (error) {
        const operation = randomUUID();
        let details =
          error instanceof Error
            ? (error.stack ?? error.message)
            : String(error);
        try {
          await recordMain("error", operation, "main.operation.failed", {
            action,
            details,
          });
        } catch (logError) {
          details += "\n日志写入失败：" + String(logError);
        }
        return {
          ok: false,
          error: {
            message: error instanceof Error ? error.message : String(error),
            operation,
            details,
          },
        };
      }
    },
  );
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "戍声",
        submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }],
      },
      {
        label: "编辑",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      { label: "窗口", submenu: [{ role: "minimize" }, { role: "close" }] },
    ]),
  );
  const development = !app.isPackaged
    ? process.env.WARDTONE_DEV_URL
    : undefined;
  if (development) {
    if (development !== "http://127.0.0.1:5193")
      throw new Error("开发地址无效");
    await window.loadURL(development);
  } else
    await window.loadURL(
      pathToFileURL(path.join(__dirname, "../renderer/index.html")).href,
    );
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      window.restore();
      window.show();
      window.focus();
    }
  });
  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => {
    quitting = true;
    if (backend) void backend.terminate();
  });
  start().catch((error) => {
    dialog.showErrorBox(
      "戍声启动失败",
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    app.exit(1);
  });
}
