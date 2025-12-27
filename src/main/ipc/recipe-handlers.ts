import { ipcMain } from 'electron';
import { createRecipe } from '../database/dal/recipes.js';
import type { CreateRecipeInput } from '../../shared/types/recipe.js';

export function registerRecipeHandlers(): void {
  ipcMain.handle('recipe:create', async (_event, input: CreateRecipeInput) => {
    try {
      const recipe = await createRecipe(input);
      return { success: true, recipe };
    } catch (error) {
      // Parse validation errors from error message
      if (error instanceof Error && error.message.startsWith('Recipe validation failed:')) {
        const lines = error.message.split('\n');
        const errors = lines
          .slice(1)
          .map(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
              const field = line.substring(0, colonIndex).trim();
              const message = line.substring(colonIndex + 1).trim();
              return { field, message };
            }
            return { field: 'general', message: line.trim() };
          })
          .filter(err => err.message.length > 0);

        return { success: false, errors };
      }

      // Generic error handling
      return {
        success: false,
        errors: [
          { field: 'general', message: error instanceof Error ? error.message : 'Unknown error' },
        ],
      };
    }
  });
}
