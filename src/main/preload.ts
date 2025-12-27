import { contextBridge, ipcRenderer } from 'electron';
import type { CreateRecipeInput } from '../shared/types/recipe.js';

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

  recipeAPI: {
    create: (input: CreateRecipeInput) => ipcRenderer.invoke('recipe:create', input),
  },
});
