import { contextBridge, ipcRenderer } from 'electron';
import type { CreateRecipeInput, RecipeFilter } from '../shared/types/recipe.js';
import type { RecipeGenerationCriteria } from '../shared/types/ai.js';

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
    getAll: () => ipcRenderer.invoke('recipe:getAll'),
    getById: (id: string) => ipcRenderer.invoke('recipe:getById', id),
    filter: (filter: RecipeFilter) => ipcRenderer.invoke('recipe:filter', filter),
    generateRecipe: (criteria: RecipeGenerationCriteria) =>
      ipcRenderer.invoke('recipe:generate', criteria),
  },
});
