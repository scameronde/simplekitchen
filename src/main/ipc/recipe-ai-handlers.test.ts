/**
 * @module recipe-ai-handlers.test
 * Integration tests for AI recipe generation IPC handlers.
 * Tests security validation, OpenAI integration, and belt-and-suspenders validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RecipeGenerationCriteria, RecipeGenerationResult } from '../../shared/types/ai.js';
import type { CreateRecipeInput } from '../../shared/types/recipe.js';
import type { ValidationResult } from '../../shared/types/validation.js';

// Hoist mock functions for OpenAI SDK
const { mockParse: hoistedMockParse, mockOpenAI } = vi.hoisted(() => {
  const mockParse = vi.fn();
  const mockOpenAI = vi.fn(() => ({
    chat: {
      completions: {
        parse: mockParse,
      },
    },
  }));
  return { mockParse, mockOpenAI };
});

// Mock OpenAI SDK
vi.mock('openai', () => {
  class MockRateLimitError extends Error {
    headers?: { get?: (key: string) => string | null };
    constructor(message: string) {
      super(message);
      this.name = 'RateLimitError';
    }
  }

  (mockOpenAI as any).RateLimitError = MockRateLimitError;

  return { default: mockOpenAI };
});

// Mock openai/helpers/zod
vi.mock('openai/helpers/zod', () => ({
  zodResponseFormat: vi.fn((_schema, name) => ({
    type: 'json_schema',
    name,
  })),
}));

// Mock electron module
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => ':memory:'),
  },
}));

// Mock validation module
vi.mock('../validation/validator.js', () => ({
  validateRecipe: vi.fn(),
}));

// Mock database module (dietary profile)
vi.mock('../database/dal/dietary-profile.js', () => ({
  getDietaryProfile: vi.fn(() =>
    Promise.resolve({
      userId: 'test-user',
      requiredDietaryTags: [],
      maxCookingTime: 90,
      availableCookware: ['one-pot', 'one-pan', 'oven'],
    })
  ),
}));

type IpcHandlerResult = RecipeGenerationResult;
type IpcHandler = (
  event: { senderFrame?: { url: string } },
  criteria: RecipeGenerationCriteria
) => Promise<IpcHandlerResult>;

describe('Recipe AI IPC Handlers', () => {
  let handlerFn: IpcHandler | undefined;
  const mockParse = hoistedMockParse;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Import electron to get the mocked ipcMain
    const { ipcMain } = await import('electron');

    // Import validation mock
    const { validateRecipe } = await import('../validation/validator.js');

    // Default mock for validation: pass all recipes
    vi.mocked(validateRecipe).mockResolvedValue({
      valid: true,
      errors: [],
    });

    // Capture handler function when handle is called
    vi.mocked(ipcMain.handle).mockImplementation((channel, fn) => {
      if (channel === 'recipe:generate') handlerFn = fn as IpcHandler;
    });

    // Import and register handlers after mocks are set up
    const { registerRecipeAIHandlers } = await import('./recipe-ai-handlers.js');
    registerRecipeAIHandlers();
  });

  describe('Success Cases', () => {
    it('returns success when recipe is generated and validated', async () => {
      const mockRecipe: CreateRecipeInput = {
        title: 'AI-Generated Pasta',
        cookingTimeMinutes: 35,
        prepTimeMinutes: 10,
        cookwareType: 'one-pot',
        servings: 2,
        dietaryTags: ['vegetarian'],
        seasonality: ['any'],
        instructions: 'Cook pasta according to package directions. Add sauce and serve.',
        sourceType: 'ai-generated',
        sourceReference: 'OpenAI gpt-4o-mini',
        ingredients: [
          {
            name: 'pasta',
            quantity: 200,
            unit: 'g',
            dietaryProperties: ['contains-gluten'],
            optional: false,
            orderIndex: 0,
          },
          {
            name: 'olive oil',
            quantity: 2,
            unit: 'tbsp',
            dietaryProperties: ['none'],
            optional: false,
            orderIndex: 1,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      const criteria: RecipeGenerationCriteria = {
        dietaryTags: ['vegetarian'],
        cookwareType: 'one-pot',
      };

      const event = { senderFrame: { url: 'file:///app/index.html' } };
      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, criteria);

      expect(result.success).toBe(true);
      expect(result.recipe).toBeDefined();
      expect(result.recipe?.title).toBe('AI-Generated Pasta');
      expect(result.recipe?.sourceType).toBe('ai-generated');
    });

    it('accepts requests from localhost', async () => {
      const mockRecipe: CreateRecipeInput = {
        title: 'Test Recipe',
        cookingTimeMinutes: 30,
        cookwareType: 'one-pan',
        servings: 2,
        dietaryTags: [],
        seasonality: ['any'],
        sourceType: 'ai-generated',
        sourceReference: 'OpenAI gpt-4o-mini',
        ingredients: [
          {
            name: 'ingredient',
            quantity: 1,
            unit: 'cup',
            dietaryProperties: ['none'],
            optional: false,
            orderIndex: 0,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      const criteria: RecipeGenerationCriteria = {
        dietaryTags: [],
      };

      const event = { senderFrame: { url: 'http://localhost:3000' } };
      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, criteria);

      expect(result.success).toBe(true);
      expect(result.recipe).toBeDefined();
    });
  });

  describe('Security', () => {
    it('rejects requests without senderFrame', async () => {
      const criteria: RecipeGenerationCriteria = {
        dietaryTags: ['vegetarian'],
      };

      const event = {}; // No senderFrame
      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, criteria);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('auth');
      expect(result.error?.message).toBe('Unauthorized IPC sender');
      expect(mockParse).not.toHaveBeenCalled();
    });

    it('rejects requests from unauthorized origins', async () => {
      const criteria: RecipeGenerationCriteria = {
        dietaryTags: ['vegan'],
      };

      const event = { senderFrame: { url: 'https://evil.com' } };
      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, criteria);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('auth');
      expect(result.error?.message).toBe('Unauthorized IPC sender');
      expect(mockParse).not.toHaveBeenCalled();
    });

    it('rejects requests from http (non-localhost)', async () => {
      const criteria: RecipeGenerationCriteria = {
        dietaryTags: [],
      };

      const event = { senderFrame: { url: 'http://example.com' } };
      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, criteria);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('auth');
      expect(result.error?.message).toBe('Unauthorized IPC sender');
      expect(mockParse).not.toHaveBeenCalled();
    });
  });

  describe('Belt-and-Suspenders Validation', () => {
    it('rejects AI-generated recipes that fail validation', async () => {
      const mockRecipe: CreateRecipeInput = {
        title: 'Invalid Recipe',
        cookingTimeMinutes: 200, // Exceeds max time
        cookwareType: 'one-pot',
        servings: 2,
        dietaryTags: [],
        seasonality: ['any'],
        sourceType: 'ai-generated',
        sourceReference: 'OpenAI gpt-4o-mini',
        ingredients: [
          {
            name: 'ingredient',
            quantity: 1,
            unit: 'cup',
            dietaryProperties: ['none'],
            optional: false,
            orderIndex: 0,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      // Mock validation to fail
      const { validateRecipe } = await import('../validation/validator.js');
      const validationResult: ValidationResult = {
        valid: false,
        errors: [
          {
            field: 'cookingTimeMinutes',
            constraint: 'time-maximum',
            message: 'Cooking time exceeds maximum allowed time',
          },
        ],
      };
      vi.mocked(validateRecipe).mockResolvedValue(validationResult);

      const criteria: RecipeGenerationCriteria = {
        dietaryTags: [],
      };

      const event = { senderFrame: { url: 'file:///app/index.html' } };
      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, criteria);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
      expect(result.error?.message).toBe('Generated recipe failed validation');
      expect(result.error?.details).toContain('cookingTimeMinutes');
      expect(result.error?.details).toContain('Cooking time exceeds maximum allowed time');
    });

    it('handles multiple validation errors', async () => {
      const mockRecipe: CreateRecipeInput = {
        title: '',
        cookingTimeMinutes: 200,
        cookwareType: 'one-pot',
        servings: 10,
        dietaryTags: [],
        seasonality: ['any'],
        sourceType: 'ai-generated',
        sourceReference: 'OpenAI gpt-4o-mini',
        ingredients: [],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      // Mock validation with multiple errors
      const { validateRecipe } = await import('../validation/validator.js');
      const validationResult: ValidationResult = {
        valid: false,
        errors: [
          {
            field: 'title',
            constraint: 'required',
            message: 'Title is required',
          },
          {
            field: 'cookingTimeMinutes',
            constraint: 'time-maximum',
            message: 'Cooking time exceeds maximum',
          },
          {
            field: 'servings',
            constraint: 'servings-exact',
            message: 'Servings must be exactly 2',
          },
        ],
      };
      vi.mocked(validateRecipe).mockResolvedValue(validationResult);

      const criteria: RecipeGenerationCriteria = {
        dietaryTags: [],
      };

      const event = { senderFrame: { url: 'file:///app/index.html' } };
      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, criteria);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
      expect(result.error?.details).toContain('title: Title is required');
      expect(result.error?.details).toContain('cookingTimeMinutes: Cooking time exceeds maximum');
      expect(result.error?.details).toContain('servings: Servings must be exactly 2');
    });
  });

  describe('OpenAI Error Handling', () => {
    it('propagates rate limit errors from OpenAI', async () => {
      const OpenAI = (await import('openai')).default;
      const error = new (OpenAI as any).RateLimitError('Rate limit exceeded');
      error.headers = {
        get: (key: string) => (key === 'retry-after' ? '120' : null),
      };

      mockParse.mockRejectedValue(error);

      const criteria: RecipeGenerationCriteria = {
        dietaryTags: ['vegetarian'],
      };

      const event = { senderFrame: { url: 'file:///app/index.html' } };
      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, criteria);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('rate-limit');
      expect(result.error?.message).toBe('Rate limit exceeded. Please wait before trying again.');
      expect(result.error?.retryAfter).toBe(120);
    });

    it('propagates refusal errors from OpenAI', async () => {
      mockParse.mockResolvedValue({
        choices: [
          {
            message: {
              parsed: null,
              refusal: 'I cannot generate a recipe with those requirements',
            },
          },
        ],
      });

      const criteria: RecipeGenerationCriteria = {
        dietaryTags: [],
        mainIngredient: 'inappropriate ingredient',
      };

      const event = { senderFrame: { url: 'file:///app/index.html' } };
      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, criteria);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('refusal');
      expect(result.error?.message).toBe('AI refused to generate recipe');
      expect(result.error?.details).toBe('I cannot generate a recipe with those requirements');
    });
  });

  describe('IPC Result Structure', () => {
    it('returns structured result with success flag', async () => {
      const mockRecipe: CreateRecipeInput = {
        title: 'Test Recipe',
        cookingTimeMinutes: 35,
        cookwareType: 'one-pot',
        servings: 2,
        dietaryTags: [],
        seasonality: ['any'],
        sourceType: 'ai-generated',
        sourceReference: 'OpenAI gpt-4o-mini',
        ingredients: [
          {
            name: 'ingredient',
            quantity: 1,
            unit: 'cup',
            dietaryProperties: ['none'],
            optional: false,
            orderIndex: 0,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      const criteria: RecipeGenerationCriteria = {
        dietaryTags: [],
      };

      const event = { senderFrame: { url: 'file:///app/index.html' } };
      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, criteria);

      // Verify structure matches RecipeGenerationResult
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      if (result.success) {
        expect(result).toHaveProperty('recipe');
        expect(result.recipe).toBeDefined();
      } else {
        expect(result).toHaveProperty('error');
        expect(result.error).toBeDefined();
      }
    });

    it('returns structured error for failures', async () => {
      const criteria: RecipeGenerationCriteria = {
        dietaryTags: [],
      };

      const event = { senderFrame: { url: 'https://evil.com' } };
      if (!handlerFn) throw new Error('handlerFn not initialized');
      const result = await handlerFn(event, criteria);

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
      expect(result.error).toHaveProperty('type');
      expect(result.error).toHaveProperty('message');
      expect(typeof result.error?.type).toBe('string');
      expect(typeof result.error?.message).toBe('string');
    });
  });
});
