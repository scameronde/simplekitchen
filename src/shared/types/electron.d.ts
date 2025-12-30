// Type definitions for Electron APIs exposed via contextBridge

import type { Recipe, CreateRecipeInput, RecipeFilter } from './recipe';
import type { RecipeGenerationCriteria, RecipeGenerationResult } from './ai';

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
    getAll: () => Promise<{
      success: boolean;
      recipe?: Recipe[];
      errors?: Array<{ field: string; message: string }>;
    }>;
    getById: (id: string) => Promise<{
      success: boolean;
      recipe?: Recipe;
      errors?: Array<{ field: string; message: string }>;
    }>;
    filter: (filter: RecipeFilter) => Promise<{
      success: boolean;
      recipe?: Recipe[];
      errors?: Array<{ field: string; message: string }>;
    }>;
    generateRecipe: (criteria: RecipeGenerationCriteria) => Promise<RecipeGenerationResult>;
    importRecipe: (url: string) => Promise<{
      success: boolean;
      recipe?: CreateRecipeInput;
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
