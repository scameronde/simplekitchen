/**
 * @module recipe-import-handlers.test
 * Integration tests for IPC recipe import handler
 * Tests handler registration, validation, error handling, and timeout protection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CreateRecipeInput } from '../../shared/types/recipe.js';
import type { SchemaOrgRecipe } from '../../shared/types/schema-org.js';

// Mock functions
const mockExtractSchemaOrgRecipe = vi.fn();
const mockSchemaOrgToRecipeInput = vi.fn();

// Mock modules before importing the handler
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('../web/recipe-importer.js', () => ({
  extractSchemaOrgRecipe: mockExtractSchemaOrgRecipe,
}));

vi.mock('../web/schema-org-adapter.js', () => ({
  schemaOrgToRecipeInput: mockSchemaOrgToRecipeInput,
}));

// Test data
const validSchemaOrgRecipe: SchemaOrgRecipe = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Pasta Carbonara',
  cookTime: 'PT30M',
  prepTime: 'PT15M',
  recipeYield: '4 servings',
  recipeIngredient: ['400g pasta', '200g bacon', '4 eggs', '100g parmesan'],
  recipeInstructions: 'Cook pasta, fry bacon, mix with eggs and cheese.',
};

const validCreateRecipeInput: CreateRecipeInput = {
  title: 'Pasta Carbonara',
  cookingTimeMinutes: 30,
  prepTimeMinutes: 15,
  cookwareType: 'one-pot',
  servings: 4,
  dietaryTags: [],
  seasonality: ['any'],
  sourceType: 'web-imported',
  sourceReference: 'https://example.com/recipe/carbonara',
  instructions: 'Cook pasta, fry bacon, mix with eggs and cheese.',
  ingredients: [
    {
      name: 'pasta',
      quantity: 400,
      unit: 'g',
      dietaryProperties: [],
      optional: false,
      orderIndex: 0,
    },
    {
      name: 'bacon',
      quantity: 200,
      unit: 'g',
      dietaryProperties: [],
      optional: false,
      orderIndex: 1,
    },
    { name: 'eggs', quantity: 4, unit: '', dietaryProperties: [], optional: false, orderIndex: 2 },
    {
      name: 'parmesan',
      quantity: 100,
      unit: 'g',
      dietaryProperties: [],
      optional: false,
      orderIndex: 3,
    },
  ],
};

const createValidEvent = () => ({
  senderFrame: {
    url: 'file:///',
  },
});

type IpcHandler = (
  event: unknown,
  url: unknown
) => Promise<{
  success: boolean;
  recipe?: CreateRecipeInput;
  errors?: Array<{ field: string; message: string }>;
}>;

describe('Recipe Import IPC Handler', () => {
  let handlerFn: IpcHandler | undefined;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Set up default mock implementations
    mockExtractSchemaOrgRecipe.mockResolvedValue(validSchemaOrgRecipe);
    mockSchemaOrgToRecipeInput.mockReturnValue(validCreateRecipeInput);

    // Import electron to get the mocked ipcMain
    const { ipcMain } = await import('electron');

    // Capture the handler function when handle is called
    vi.mocked(ipcMain.handle).mockImplementation((channel, fn) => {
      if (channel === 'recipe:import') {
        handlerFn = fn as IpcHandler;
      }
    });

    // Import and register handlers after mocks are set up
    const { registerRecipeImportHandlers } = await import('./recipe-import-handlers.js');
    registerRecipeImportHandlers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Successful import', () => {
    it('should return success with parsed recipe input', async () => {
      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, 'https://example.com/recipe/carbonara');

      expect(result.success).toBe(true);
      expect(result.recipe).toEqual(validCreateRecipeInput);
      expect(result.errors).toBeUndefined();
    });

    it('should call extractSchemaOrgRecipe with correct URL', async () => {
      const event = createValidEvent();
      const testUrl = 'https://www.allrecipes.com/recipe/12345/cookies/';

      if (!handlerFn) throw new Error('handlerFn not initialized');
      await handlerFn(event, testUrl);

      expect(mockExtractSchemaOrgRecipe).toHaveBeenCalledWith(testUrl);
    });

    it('should call schemaOrgToRecipeInput with extracted recipe and URL', async () => {
      const event = createValidEvent();
      const testUrl = 'https://example.com/recipe';

      if (!handlerFn) throw new Error('handlerFn not initialized');
      await handlerFn(event, testUrl);

      expect(mockSchemaOrgToRecipeInput).toHaveBeenCalledWith(validSchemaOrgRecipe, testUrl);
    });
  });

  describe('Import failure - No Schema.org markup', () => {
    it('should return error when no recipe markup found', async () => {
      mockExtractSchemaOrgRecipe.mockRejectedValue(
        new Error('No Schema.org recipe markup found on this page')
      );

      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, 'https://example.com/page');

      expect(result.success).toBe(false);
      expect(result.recipe).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors).toContainEqual({
        field: 'general',
        message: 'No Schema.org recipe markup found on this page',
      });
    });

    it('should not call schemaOrgToRecipeInput if extraction fails', async () => {
      mockExtractSchemaOrgRecipe.mockRejectedValue(
        new Error('No Schema.org recipe markup found on this page')
      );

      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      await handlerFn(event, 'https://example.com/page');

      expect(mockSchemaOrgToRecipeInput).not.toHaveBeenCalled();
    });
  });

  describe('Import failure - Network/Fetch errors', () => {
    it('should return error for network timeout', async () => {
      mockExtractSchemaOrgRecipe.mockRejectedValue(
        new Error('Recipe fetch timed out after 15 seconds')
      );

      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, 'https://example.com/recipe');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toBe('Failed to fetch recipe from URL');
    });

    it('should return error for generic fetch failure', async () => {
      mockExtractSchemaOrgRecipe.mockRejectedValue(new Error('Network error'));

      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, 'https://example.com/recipe');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.field).toBe('general');
      expect(result.errors?.[0]?.message).toBe('Failed to fetch recipe from URL');
    });
  });

  describe('Invalid URL validation', () => {
    it('should return error for URL without protocol', async () => {
      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, 'example.com/recipe');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContainEqual({
        field: 'url',
        message: 'Invalid URL format. Must start with http:// or https://',
      });
      expect(mockExtractSchemaOrgRecipe).not.toHaveBeenCalled();
    });

    it('should return error for empty URL string', async () => {
      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, '');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toBe('URL must be a non-empty string');
    });

    it('should return error for non-string URL', async () => {
      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, null);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should return error for whitespace-only URL', async () => {
      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, '   ');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toBe('URL must be a non-empty string');
    });

    it('should accept HTTP URLs', async () => {
      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      await handlerFn(event, 'http://example.com/recipe');

      expect(mockExtractSchemaOrgRecipe).toHaveBeenCalled();
    });

    it('should accept HTTPS URLs', async () => {
      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      await handlerFn(event, 'https://example.com/recipe');

      expect(mockExtractSchemaOrgRecipe).toHaveBeenCalled();
    });
  });

  describe('Sender validation', () => {
    it('should return error when senderFrame is missing', async () => {
      const invalidEvent = {};

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(invalidEvent, 'https://example.com/recipe');

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'general',
        message: 'Unauthorized',
      });
      expect(mockExtractSchemaOrgRecipe).not.toHaveBeenCalled();
    });

    it('should return error when sender is from invalid protocol', async () => {
      const invalidEvent = {
        senderFrame: {
          url: 'http://malicious.com/',
        },
      };

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(invalidEvent, 'https://example.com/recipe');

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'general',
        message: 'Unauthorized',
      });
    });

    it('should allow requests from file: protocol', async () => {
      const validEvent = {
        senderFrame: {
          url: 'file:///',
        },
      };

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(validEvent, 'https://example.com/recipe');

      expect(result.success).toBe(true);
      expect(mockExtractSchemaOrgRecipe).toHaveBeenCalled();
    });

    it('should allow requests from localhost', async () => {
      const validEvent = {
        senderFrame: {
          url: 'http://localhost:3000',
        },
      };

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(validEvent, 'https://example.com/recipe');

      expect(result.success).toBe(true);
      expect(mockExtractSchemaOrgRecipe).toHaveBeenCalled();
    });
  });

  describe('Conversion errors', () => {
    it('should return error when recipe is missing required fields', async () => {
      mockSchemaOrgToRecipeInput.mockImplementation(() => {
        throw new Error('Recipe name is required');
      });

      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, 'https://example.com/recipe');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toContain('required');
    });

    it('should return error for invalid recipe data', async () => {
      mockSchemaOrgToRecipeInput.mockImplementation(() => {
        throw new Error('Invalid data format');
      });

      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, 'https://example.com/recipe');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle generic conversion error', async () => {
      mockSchemaOrgToRecipeInput.mockImplementation(() => {
        throw new Error('Conversion failed');
      });

      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, 'https://example.com/recipe');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toBe('Conversion failed');
    });
  });

  describe('Timeout protection', () => {
    it('should fail gracefully after 20 second timeout', async () => {
      vi.useFakeTimers();

      mockExtractSchemaOrgRecipe.mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves - timeout will fire
          })
      );

      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const promise = handlerFn(event, 'https://example.com/recipe');

      // Advance time by 20 seconds to trigger the timeout
      vi.advanceTimersByTime(20000);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toContain('timed out');

      vi.useRealTimers();
    });

    it('should cancel operation when timeout occurs', async () => {
      vi.useFakeTimers();

      mockExtractSchemaOrgRecipe.mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves
          })
      );

      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const promise = handlerFn(event, 'https://example.com/recipe');

      // Advance time by 20 seconds
      vi.advanceTimersByTime(20000);

      const result = await promise;

      expect(result.success).toBe(false);

      vi.useRealTimers();
    });

    it('should handle successful import within timeout', async () => {
      vi.useFakeTimers();

      mockExtractSchemaOrgRecipe.mockImplementation(
        async () =>
          new Promise(resolve => {
            setTimeout(() => resolve(validSchemaOrgRecipe), 5000);
          })
      );

      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const promise = handlerFn(event, 'https://example.com/recipe');

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.recipe).toEqual(validCreateRecipeInput);

      vi.useRealTimers();
    });
  });

  describe('Error response structure', () => {
    it('should always return structured response with success and errors/recipe', async () => {
      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const successResult = await handlerFn(event, 'https://example.com/recipe');

      expect(successResult).toHaveProperty('success');
      expect(typeof successResult.success).toBe('boolean');
      if (successResult.success) {
        expect(successResult).toHaveProperty('recipe');
      } else {
        expect(successResult).toHaveProperty('errors');
      }
    });

    it('should include field and message in error objects', async () => {
      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, 'invalid-url');

      expect(result.success).toBe(false);
      if (result.errors) {
        result.errors.forEach(error => {
          expect(error).toHaveProperty('field');
          expect(error).toHaveProperty('message');
          expect(typeof error.field).toBe('string');
          expect(typeof error.message).toBe('string');
        });
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined URL', async () => {
      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, undefined);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle very long URL', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000);
      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, longUrl);

      expect(result.success).toBe(true);
      expect(mockExtractSchemaOrgRecipe).toHaveBeenCalledWith(longUrl);
    });

    it('should handle URL with query parameters', async () => {
      const urlWithParams = 'https://example.com/recipe?id=123&lang=en-US';
      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, urlWithParams);

      expect(result.success).toBe(true);
      expect(mockExtractSchemaOrgRecipe).toHaveBeenCalledWith(urlWithParams);
    });

    it('should handle URL with fragment', async () => {
      const urlWithFragment = 'https://example.com/recipe#section';
      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, urlWithFragment);

      expect(result.success).toBe(true);
    });

    it('should not throw uncaught exceptions', async () => {
      mockExtractSchemaOrgRecipe.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const event = createValidEvent();

      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, 'https://example.com/recipe');

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Handler registration', () => {
    it('should register handler on recipe:import channel', async () => {
      const { ipcMain } = await import('electron');

      expect(vi.mocked(ipcMain.handle)).toHaveBeenCalledWith('recipe:import', expect.any(Function));
    });
  });
});
