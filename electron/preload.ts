// Expose safe APIs to renderer via contextBridge if needed
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
});
