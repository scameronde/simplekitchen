import { ipcMain } from 'electron';
import type { WebFrameMain } from 'electron/main';
import type { CreateRecipeInput } from '../../shared/types/recipe.js';
import { extractSchemaOrgRecipe } from '../web/recipe-importer.js';
import { schemaOrgToRecipeInput } from '../web/schema-org-adapter.js';
import { isE2ETest } from '../utils/test-env.js';
import { mockImportRecipe } from './recipe-import-handlers.mock.js';

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
 * Validates URL format for web recipe import.
 * Must be a non-empty string starting with http:// or https://
 *
 * @param url - The URL to validate
 * @returns { valid: true } or { valid: false, message: string }
 */
function validateUrlFormat(url: unknown): { valid: true } | { valid: false; message: string } {
  if (typeof url !== 'string' || url.trim().length === 0) {
    return { valid: false, message: 'URL must be a non-empty string' };
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return {
      valid: false,
      message: 'Invalid URL format. Must start with http:// or https://',
    };
  }

  return { valid: true };
}

/**
 * Registers IPC handlers for web recipe import.
 * Handles recipe:import channel with security validation, URL fetching,
 * Schema.org parsing, and conversion to CreateRecipeInput format.
 *
 * The handler orchestrates:
 * 1. Sender validation (security check)
 * 2. URL format validation
 * 3. Schema.org recipe extraction from URL
 * 4. Conversion to CreateRecipeInput format
 * 5. Return parsed recipe for user review (NOT saved to database)
 *
 * Note: The handler does NOT validate or create the recipe. The renderer
 * process receives the parsed recipe, allows user to edit, then calls
 * recipe:create when the user confirms.
 */
export function registerRecipeImportHandlers(): void {
  ipcMain.handle('recipe:import', async (event, url: unknown) => {
    // Security validation: verify sender is from renderer process
    if (!event.senderFrame || !validateSender(event.senderFrame)) {
      return {
        success: false,
        errors: [{ field: 'general', message: 'Unauthorized' }],
      };
    }

    // Validate URL format
    const urlValidation = validateUrlFormat(url);
    if (!urlValidation.valid) {
      return {
        success: false,
        errors: [{ field: 'url', message: urlValidation.message }],
      };
    }

    // Implement timeout protection for entire operation (20 seconds total)
    const timeoutPromise = new Promise<{
      success: false;
      errors: Array<{ field: string; message: string }>;
    }>(resolve => {
      setTimeout(() => {
        resolve({
          success: false,
          errors: [{ field: 'general', message: 'Recipe import timed out. Please try again.' }],
        });
      }, 20000);
    });

    const importPromise = (async () => {
      try {
        // Use mock handler in E2E test environment, otherwise fetch from URL
        if (isE2ETest()) {
          console.log('Import handler using: MOCK');
          return await mockImportRecipe(url);
        }

        console.log('Import handler using: REAL');

        // Extract Schema.org recipe from URL
        let schemaRecipe;
        try {
          schemaRecipe = await extractSchemaOrgRecipe(url as string);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Map specific error messages
          if (errorMessage.includes('timed out')) {
            return {
              success: false,
              errors: [{ field: 'general', message: 'Failed to fetch recipe from URL' }],
            };
          }

          if (errorMessage.includes('No Schema.org recipe markup found')) {
            return {
              success: false,
              errors: [{ field: 'general', message: errorMessage }],
            };
          }

          if (errorMessage.includes('Invalid URL format')) {
            return {
              success: false,
              errors: [{ field: 'url', message: errorMessage }],
            };
          }

          // Generic network/fetch error
          return {
            success: false,
            errors: [{ field: 'general', message: 'Failed to fetch recipe from URL' }],
          };
        }

        // Convert Schema.org format to CreateRecipeInput
        let recipeInput: CreateRecipeInput;
        try {
          recipeInput = schemaOrgToRecipeInput(schemaRecipe, url as string);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Map specific conversion errors
          if (errorMessage.includes('is required')) {
            return {
              success: false,
              errors: [{ field: 'general', message: errorMessage }],
            };
          }

          if (errorMessage.includes('Invalid')) {
            return {
              success: false,
              errors: [{ field: 'general', message: 'Invalid recipe data format' }],
            };
          }

          // Generic parsing error
          return {
            success: false,
            errors: [{ field: 'general', message: errorMessage }],
          };
        }

        // Return parsed recipe for user review (NOT saved to database yet)
        return {
          success: true,
          recipe: recipeInput,
        };
      } catch (error) {
        // Catch-all for any unexpected errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          errors: [{ field: 'general', message: errorMessage }],
        };
      }
    })();

    // Race against timeout
    return Promise.race([importPromise, timeoutPromise]);
  });
}
