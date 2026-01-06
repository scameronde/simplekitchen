// Type definitions for Electron APIs exposed via contextBridge

import type { Recipe, CreateRecipeInput, RecipeFilter } from './recipe';
import type { RecipeGenerationCriteria, RecipeGenerationResult } from './ai';

// Conversation API types
export interface ConversationAPI {
  startSession: () => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  sendMessage: (
    sessionId: string,
    message: string
  ) => Promise<{ success: boolean; aiMessage?: string; timestamp?: Date; error?: string }>;
  abandonSession: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
}

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

  conversationAPI: ConversationAPI;
}

/**
 * Test infrastructure API exposed in test environments only.
 * Allows test harness to override mocks and access original IPC handlers.
 */
export interface TestAPI {
  /**
   * Original IPC handlers that directly call Electron IPC.
   * Tests can use this for verification or to reset mocks.
   */
  __originalAPI__: {
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
    conversationAPI: ConversationAPI;
  };
  /**
   * Mock API object for test harness to override.
   * Each method defaults to calling the original handler but can be reassigned.
   * Tests can replace individual methods with custom implementations.
   */
  __mockAPI__: {
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
    conversationAPI: ConversationAPI;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
    /**
     * Test infrastructure API available only in test environments.
     * Allows test harness to mock and verify API calls.
     */
    __testAPI__?: TestAPI;
  }
}

export {};
