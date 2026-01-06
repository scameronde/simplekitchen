import { contextBridge, ipcRenderer } from 'electron';
import type { CreateRecipeInput, RecipeFilter } from '../shared/types/recipe.js';
import type { RecipeGenerationCriteria } from '../shared/types/ai.js';
import { isUnitTest } from './utils/test-env.js';

/**
 * Store original IPC handlers for reference when mocks are reset.
 * These call the actual Electron IPC handlers directly.
 */
const __originalAPI__ = {
  create: (input: CreateRecipeInput) => ipcRenderer.invoke('recipe:create', input),
  getAll: () => ipcRenderer.invoke('recipe:getAll'),
  getById: (id: string) => ipcRenderer.invoke('recipe:getById', id),
  filter: (filter: RecipeFilter) => ipcRenderer.invoke('recipe:filter', filter),
  generateRecipe: (criteria: RecipeGenerationCriteria) =>
    ipcRenderer.invoke('recipe:generate', criteria),
  importRecipe: (url: string) => ipcRenderer.invoke('recipe:import', url),
  conversationAPI: {
    startSession: (): Promise<{ success: boolean; sessionId?: string; error?: string }> =>
      ipcRenderer.invoke('conversation:start'),
    sendMessage: (
      sessionId: string,
      message: string
    ): Promise<{ success: boolean; aiMessage?: string; timestamp?: Date; error?: string }> =>
      ipcRenderer.invoke('conversation:sendMessage', sessionId, message),
    abandonSession: (sessionId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('conversation:abandon', sessionId),
  },
};

/**
 * Create mock API with mockable functions that can be overridden by test harness.
 * Defaults to calling original IPC handlers unless explicitly mocked.
 * Each property is a function that test code can replace with custom implementations.
 */
const __mockAPI__ = {
  create: (input: CreateRecipeInput) => __originalAPI__.create(input),
  getAll: () => __originalAPI__.getAll(),
  getById: (id: string) => __originalAPI__.getById(id),
  filter: (filter: RecipeFilter) => __originalAPI__.filter(filter),
  generateRecipe: (criteria: RecipeGenerationCriteria) => __originalAPI__.generateRecipe(criteria),
  importRecipe: (url: string) => __originalAPI__.importRecipe(url),
  conversationAPI: {
    startSession: () => __originalAPI__.conversationAPI.startSession(),
    sendMessage: (sessionId: string, message: string) =>
      __originalAPI__.conversationAPI.sendMessage(sessionId, message),
    abandonSession: (sessionId: string) =>
      __originalAPI__.conversationAPI.abandonSession(sessionId),
  },
};

// Determine which API to expose based on environment
const recipeAPI = isUnitTest() ? __mockAPI__ : __originalAPI__;
const conversationAPI = isUnitTest()
  ? __mockAPI__.conversationAPI
  : __originalAPI__.conversationAPI;

// Expose safe APIs to renderer process
// NEVER expose entire ipcRenderer or Node.js APIs directly
const electronAPI = {
  // Example API - actual recipe APIs will be added in Phase 3
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  recipeAPI,
  conversationAPI,
};

contextBridge.exposeInMainWorld('electron', electronAPI);

/**
 * In test environment, also expose test infrastructure APIs to allow test harness
 * to override mock functions and access original IPC handlers for verification.
 */
if (isUnitTest()) {
  contextBridge.exposeInMainWorld('__testAPI__', {
    /**
     * Original IPC API for reference during test setup.
     * Tests can use this to verify default behavior or reset mocks.
     */
    __originalAPI__,
    /**
     * Mock API object for test harness to override.
     * Each method is a function that defaults to calling the original handler.
     * Tests can reassign these function properties to provide custom implementations.
     * Example: window.__testAPI__.__mockAPI__.create = async (input) => ({ success: true, recipe: mockRecipe });
     */
    __mockAPI__,
  });
}
