import { contextBridge, ipcRenderer } from "electron";
import type { ApiResult, DesktopApi, LogLine } from "../shared/model";
const api: DesktopApi = {
  async invoke<T>(action: string, input?: unknown): Promise<T> {
    const result: ApiResult<T> = await ipcRenderer.invoke(
      "wardtone:invoke",
      action,
      input,
    );
    if (!result.ok) {
      const error = new Error(result.error.message);
      Object.assign(error, {
        operation: result.error.operation,
        details: result.error.details,
      });
      throw error;
    }
    return result.data;
  },
  onCloseRequested(callback: () => void) {
    const listener = () => callback();
    ipcRenderer.on("wardtone:close-request", listener);
    return () => ipcRenderer.removeListener("wardtone:close-request", listener);
  },
  onProgress(callback: (line: LogLine) => void) {
    const listener = (_event: Electron.IpcRendererEvent, line: LogLine) =>
      callback(line);
    ipcRenderer.on("wardtone:log", listener);
    return () => ipcRenderer.removeListener("wardtone:log", listener);
  },
};
contextBridge.exposeInMainWorld("desktop", api);
