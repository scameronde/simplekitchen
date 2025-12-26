import { contextBridge } from 'electron';

// Expose safe APIs to renderer process
// NEVER expose entire ipcRenderer or Node.js APIs directly
contextBridge.exposeInMainWorld('electron', {
  // Example API - actual recipe APIs will be added in Phase 3
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // Placeholder for future IPC channels (Phase 3+)
  // recipeAPI: {
  //   getAll: () => ipcRenderer.invoke('recipe:getAll'),
  //   save: (recipe: Recipe) => ipcRenderer.invoke('recipe:save', recipe),
  // },
});

// Type definition for window.electron (to be moved to shared/types in next step)
export type ElectronAPI = {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
};
