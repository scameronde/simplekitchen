// Type definitions for Electron APIs exposed via contextBridge

import type { Recipe, CreateRecipeInput } from './recipe';

export interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };

  recipeAPI: {
    create: (input: CreateRecipeInput) => Promise<{
      success: boolean;
      recipe?: Recipe;
      errors?: Array<{ field: string; message: string }>;
    }>;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
