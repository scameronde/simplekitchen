import { ipcMain } from 'electron';
import type { WebFrameMain } from 'electron/main';
import { generateRecipe } from '../ai/recipe-generator.js';
import { validateRecipe } from '../validation/validator.js';
import type { RecipeGenerationCriteria } from '../../shared/types/ai.js';

/**
 * Validates the sender of an IPC message for security.
 * Only allows requests from file: protocol or localhost.
 *
 * @param frame - The WebFrameMain that sent the IPC message
 * @returns true if sender is authorized, false otherwise
 */
function validateSender(frame: WebFrameMain): boolean {
  const url = new URL(frame.url);
  return url.protocol === 'file:' || url.hostname === 'localhost';
}

/**
 * Registers IPC handlers for AI-powered recipe generation.
 * Handles recipe:generate channel with security validation and
 * belt-and-suspenders validation of generated recipes.
 */
export function registerRecipeAIHandlers(): void {
  ipcMain.handle('recipe:generate', async (event, criteria: RecipeGenerationCriteria) => {
    // Security check
    if (!event.senderFrame || !validateSender(event.senderFrame)) {
      return {
        success: false,
        error: { type: 'auth', message: 'Unauthorized IPC sender' },
      };
    }

    // Generate recipe via OpenAI
    const result = await generateRecipe(criteria);

    if (!result.success) {
      return result; // Return error as-is
    }

    // Belt-and-suspenders: Validate generated recipe
    // (Should always pass with good prompts, but catches edge cases)
    const validation = await validateRecipe(result.recipe!);

    if (!validation.valid) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'Generated recipe failed validation',
          details: validation.errors.map(e => `${e.field}: ${e.message}`).join('\n'),
        },
      };
    }

    return result;
  });
}
