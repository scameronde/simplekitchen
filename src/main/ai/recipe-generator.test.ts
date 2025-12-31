/**
 * @module recipe-generator.test
 * Unit tests for AI recipe generator with mocked OpenAI SDK.
 * Tests successful generation, error handling, and prompt construction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RecipeGenerationCriteria } from '../../shared/types/ai.js';

// Type for mocked OpenAI constructor with error classes
interface MockOpenAIConstructor {
  (): {
    chat: {
      completions: {
        parse: ReturnType<typeof vi.fn>;
      };
    };
  };
  RateLimitError: new (message: string) => Error & {
    headers?: { get?: (key: string) => string | null };
  };
  AuthenticationError: new (message: string) => Error;
  APIConnectionError: new (message: string) => Error;
  APIConnectionTimeoutError: new (message: string) => Error;
}

// Hoist mock functions BEFORE vi.mock() to prevent real OpenAI SDK from being imported
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

// Mock OpenAI SDK - completely prevents real SDK from being instantiated
vi.mock('openai', () => {
  // Define error classes INSIDE the factory to avoid hoisting issues
  class MockRateLimitError extends Error {
    headers?: { get?: (key: string) => string | null };
    constructor(message: string) {
      super(message);
      this.name = 'RateLimitError';
    }
  }

  class MockAuthenticationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthenticationError';
    }
  }

  class MockAPIConnectionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'APIConnectionError';
    }
  }

  class MockAPIConnectionTimeoutError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'APIConnectionTimeoutError';
    }
  }

  // Attach error classes as static properties
  (mockOpenAI as unknown as MockOpenAIConstructor).RateLimitError = MockRateLimitError;
  (mockOpenAI as unknown as MockOpenAIConstructor).AuthenticationError = MockAuthenticationError;
  (mockOpenAI as unknown as MockOpenAIConstructor).APIConnectionError = MockAPIConnectionError;
  (mockOpenAI as unknown as MockOpenAIConstructor).APIConnectionTimeoutError =
    MockAPIConnectionTimeoutError;

  return { default: mockOpenAI };
});

// Mock openai/helpers/zod to prevent schema validation by real SDK
vi.mock('openai/helpers/zod', () => ({
  zodResponseFormat: vi.fn((_schema, name) => ({
    type: 'json_schema',
    name,
  })),
}));

// Import AFTER mocks are set up
const { generateRecipe } = await import('./recipe-generator.js');
const OpenAI = (await import('openai')).default;

describe('Recipe Generator', () => {
  // Use the hoisted mock directly
  const mockParse = hoistedMockParse;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set dummy API key to allow tests to reach mocked OpenAI client
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  describe('Successful Generation', () => {
    it('should generate recipe successfully with minimal criteria', async () => {
      const mockRecipe = {
        title: 'AI-Generated Pasta',
        cookingTimeMinutes: 35,
        prepTimeMinutes: 10,
        cookwareType: 'one-pot' as const,
        servings: 2,
        dietaryTags: ['vegetarian'] as const,
        seasonality: ['any'] as const,
        instructions: 'Cook pasta according to package directions. Add sauce and serve.',
        ingredients: [
          {
            name: 'pasta',
            quantity: 200,
            unit: 'g',
            dietaryProperties: ['contains-gluten'] as const,
            optional: false,
            orderIndex: 0,
          },
          {
            name: 'olive oil',
            quantity: 2,
            unit: 'tbsp',
            dietaryProperties: ['none'] as const,
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
      };

      const result = await generateRecipe(criteria);

      expect(result.success).toBe(true);
      expect(result.recipe).toBeDefined();
      expect(result.recipe?.title).toBe('AI-Generated Pasta');
      expect(result.recipe?.sourceType).toBe('ai-generated');
      expect(result.recipe?.sourceReference).toContain('OpenAI gpt-4o-mini');
      expect(result.recipe?.ingredients).toHaveLength(2);
    });

    it('should generate recipe with full criteria', async () => {
      const mockRecipe = {
        title: 'Gluten-Free Thai Curry',
        cookingTimeMinutes: 40,
        prepTimeMinutes: 15,
        cookwareType: 'one-pot' as const,
        servings: 2,
        dietaryTags: ['gluten-free', 'lactose-free'] as const,
        seasonality: ['summer', 'fall'] as const,
        instructions: 'Detailed curry instructions...',
        ingredients: [
          {
            name: 'chicken breast',
            quantity: 300,
            unit: 'g',
            dietaryProperties: ['contains-meat'] as const,
            optional: false,
            orderIndex: 0,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      const criteria: RecipeGenerationCriteria = {
        cuisine: 'Thai',
        mainIngredient: 'chicken',
        dietaryTags: ['gluten-free', 'lactose-free'],
        seasonality: ['summer', 'fall'],
        cookwareType: 'one-pot',
        flavorProfile: 'spicy',
        skillLevel: 'intermediate',
      };

      const result = await generateRecipe(criteria);

      expect(result.success).toBe(true);
      expect(result.recipe).toBeDefined();
      expect(mockParse).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          temperature: 0.8,
          max_tokens: 2000,
        })
      );
    });

    it('should include prepTimeMinutes when provided', async () => {
      const mockRecipe = {
        title: 'Quick Salad',
        cookingTimeMinutes: 30,
        prepTimeMinutes: 20,
        cookwareType: 'one-pan' as const,
        servings: 2,
        dietaryTags: ['vegan'] as const,
        seasonality: ['spring'] as const,
        ingredients: [
          {
            name: 'lettuce',
            quantity: 1,
            unit: 'head',
            dietaryProperties: ['none'] as const,
            optional: false,
            orderIndex: 0,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      const result = await generateRecipe({ dietaryTags: ['vegan'] });

      expect(result.success).toBe(true);
      expect(result.recipe?.prepTimeMinutes).toBe(20);
    });

    it('should handle optional prepTimeMinutes when not provided', async () => {
      const mockRecipe = {
        title: 'Simple Dish',
        cookingTimeMinutes: 35,
        cookwareType: 'oven' as const,
        servings: 2,
        dietaryTags: [] as const,
        seasonality: ['any'] as const,
        ingredients: [
          {
            name: 'potato',
            quantity: 2,
            unit: 'whole',
            dietaryProperties: ['none'] as const,
            optional: false,
            orderIndex: 0,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      const result = await generateRecipe({ dietaryTags: [] });

      expect(result.success).toBe(true);
      expect(result.recipe?.prepTimeMinutes).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limit error with retry-after header', async () => {
      const error = new (OpenAI as unknown as MockOpenAIConstructor).RateLimitError(
        'Rate limit exceeded'
      );
      error.headers = {
        get: (key: string) => (key === 'retry-after' ? '120' : null),
      };

      mockParse.mockRejectedValue(error);

      const result = await generateRecipe({ dietaryTags: [] });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('rate-limit');
      expect(result.error?.message).toBe('Rate limit exceeded. Please wait before trying again.');
      expect(result.error?.retryAfter).toBe(120);
    });

    it('should handle rate limit error without retry-after header', async () => {
      const error = new (OpenAI as unknown as MockOpenAIConstructor).RateLimitError(
        'Rate limit exceeded'
      );
      error.headers = {
        get: () => null,
      };

      mockParse.mockRejectedValue(error);

      const result = await generateRecipe({ dietaryTags: ['vegetarian'] });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('rate-limit');
      expect(result.error?.retryAfter).toBe(60); // Default value
    });

    it('should handle authentication error', async () => {
      const error = new (OpenAI as unknown as MockOpenAIConstructor).AuthenticationError(
        'Invalid API key'
      );
      mockParse.mockRejectedValue(error);

      const result = await generateRecipe({ dietaryTags: ['vegan'] });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('auth');
      expect(result.error?.message).toBe('Invalid OpenAI API key. Check configuration.');
    });

    it('should handle network error', async () => {
      const error = new (OpenAI as unknown as MockOpenAIConstructor).APIConnectionError(
        'Network unavailable'
      );
      mockParse.mockRejectedValue(error);

      const result = await generateRecipe({ dietaryTags: ['gluten-free'] });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('network');
      expect(result.error?.message).toBe('Network error. Check internet connection.');
    });

    it('should handle timeout error', async () => {
      const error = new (OpenAI as unknown as MockOpenAIConstructor).APIConnectionTimeoutError(
        'Request timed out'
      );
      mockParse.mockRejectedValue(error);

      const result = await generateRecipe({ dietaryTags: ['lactose-free'] });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('timeout');
      expect(result.error?.message).toBe('Request timed out. Please try again.');
    });

    it('should handle unknown error with Error instance', async () => {
      const error = new Error('Something unexpected happened');
      mockParse.mockRejectedValue(error);

      const result = await generateRecipe({ dietaryTags: [] });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('unknown');
      expect(result.error?.message).toBe('Something unexpected happened');
    });

    it('should handle unknown error with non-Error object', async () => {
      mockParse.mockRejectedValue('String error');

      const result = await generateRecipe({ dietaryTags: [] });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('unknown');
      expect(result.error?.message).toBe('Unknown error');
    });
  });

  describe('Refusal Handling', () => {
    it('should handle AI refusal', async () => {
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

      const result = await generateRecipe({
        dietaryTags: [],
        mainIngredient: 'inappropriate ingredient',
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('refusal');
      expect(result.error?.message).toBe('AI refused to generate recipe');
      expect(result.error?.details).toBe('I cannot generate a recipe with those requirements');
    });
  });

  describe('Prompt Construction', () => {
    it('should construct prompt with cuisine', async () => {
      const mockRecipe = {
        title: 'Italian Pasta',
        cookingTimeMinutes: 35,
        cookwareType: 'one-pot' as const,
        servings: 2,
        dietaryTags: [] as const,
        seasonality: ['any'] as const,
        ingredients: [
          {
            name: 'pasta',
            quantity: 200,
            unit: 'g',
            dietaryProperties: ['contains-gluten'] as const,
            optional: false,
            orderIndex: 0,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      await generateRecipe({
        cuisine: 'Italian',
        dietaryTags: [],
      });

      const callArgs = mockParse.mock.calls[0]?.[0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('Cuisine: Italian');
    });

    it('should construct prompt with main ingredient', async () => {
      const mockRecipe = {
        title: 'Chicken Recipe',
        cookingTimeMinutes: 40,
        cookwareType: 'one-pan' as const,
        servings: 2,
        dietaryTags: [] as const,
        seasonality: ['any'] as const,
        ingredients: [
          {
            name: 'chicken',
            quantity: 300,
            unit: 'g',
            dietaryProperties: ['contains-meat'] as const,
            optional: false,
            orderIndex: 0,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      await generateRecipe({
        mainIngredient: 'chicken',
        dietaryTags: [],
      });

      const callArgs = mockParse.mock.calls[0]?.[0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('Main Ingredient: chicken');
    });

    it('should construct prompt with dietary tags', async () => {
      const mockRecipe = {
        title: 'Vegan Recipe',
        cookingTimeMinutes: 35,
        cookwareType: 'oven' as const,
        servings: 2,
        dietaryTags: ['vegan', 'gluten-free'] as const,
        seasonality: ['any'] as const,
        ingredients: [
          {
            name: 'tofu',
            quantity: 200,
            unit: 'g',
            dietaryProperties: ['none'] as const,
            optional: false,
            orderIndex: 0,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      await generateRecipe({
        dietaryTags: ['vegan', 'gluten-free'],
      });

      const callArgs = mockParse.mock.calls[0]?.[0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('Dietary Tags: vegan, gluten-free (MUST comply)');
      expect(userMessage.content).toContain('Be vegan and gluten-free');
    });

    it('should construct prompt with seasonality', async () => {
      const mockRecipe = {
        title: 'Summer Recipe',
        cookingTimeMinutes: 30,
        cookwareType: 'one-pan' as const,
        servings: 2,
        dietaryTags: [] as const,
        seasonality: ['summer'] as const,
        ingredients: [
          {
            name: 'tomato',
            quantity: 3,
            unit: 'whole',
            dietaryProperties: ['none'] as const,
            optional: false,
            orderIndex: 0,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      await generateRecipe({
        dietaryTags: [],
        seasonality: ['summer'],
      });

      const callArgs = mockParse.mock.calls[0]?.[0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('Seasonality: summer');
    });

    it('should construct prompt with cookware type', async () => {
      const mockRecipe = {
        title: 'One-Pot Recipe',
        cookingTimeMinutes: 35,
        cookwareType: 'one-pot' as const,
        servings: 2,
        dietaryTags: [] as const,
        seasonality: ['any'] as const,
        ingredients: [
          {
            name: 'rice',
            quantity: 1,
            unit: 'cup',
            dietaryProperties: ['none'] as const,
            optional: false,
            orderIndex: 0,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      await generateRecipe({
        dietaryTags: [],
        cookwareType: 'one-pot',
      });

      const callArgs = mockParse.mock.calls[0]?.[0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('Cookware Type: one-pot');
      expect(userMessage.content).toContain('Use only one-pot');
    });

    it('should construct prompt with flavor profile', async () => {
      const mockRecipe = {
        title: 'Spicy Dish',
        cookingTimeMinutes: 35,
        cookwareType: 'one-pan' as const,
        servings: 2,
        dietaryTags: [] as const,
        seasonality: ['any'] as const,
        ingredients: [
          {
            name: 'chili',
            quantity: 2,
            unit: 'whole',
            dietaryProperties: ['none'] as const,
            optional: false,
            orderIndex: 0,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      await generateRecipe({
        dietaryTags: [],
        flavorProfile: 'spicy',
      });

      const callArgs = mockParse.mock.calls[0]?.[0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('Flavor Profile: spicy');
    });

    it('should construct prompt with skill level', async () => {
      const mockRecipe = {
        title: 'Beginner Recipe',
        cookingTimeMinutes: 30,
        cookwareType: 'one-pot' as const,
        servings: 2,
        dietaryTags: [] as const,
        seasonality: ['any'] as const,
        ingredients: [
          {
            name: 'egg',
            quantity: 2,
            unit: 'whole',
            dietaryProperties: ['contains-eggs'] as const,
            optional: false,
            orderIndex: 0,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      await generateRecipe({
        dietaryTags: [],
        skillLevel: 'beginner',
      });

      const callArgs = mockParse.mock.calls[0]?.[0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('Skill Level: beginner');
    });

    it('should always include system prompt', async () => {
      const mockRecipe = {
        title: 'Test Recipe',
        cookingTimeMinutes: 35,
        cookwareType: 'oven' as const,
        servings: 2,
        dietaryTags: [] as const,
        seasonality: ['any'] as const,
        ingredients: [
          {
            name: 'ingredient',
            quantity: 1,
            unit: 'cup',
            dietaryProperties: ['none'] as const,
            optional: false,
            orderIndex: 0,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      await generateRecipe({ dietaryTags: [] });

      const callArgs = mockParse.mock.calls[0]?.[0];
      const systemMessage = callArgs.messages.find((m: { role: string }) => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toContain('You are a professional chef');
      expect(systemMessage.content).toContain('CRITICAL CONSTRAINTS');
      expect(systemMessage.content).toContain('30-45 minutes');
      expect(systemMessage.content).toContain('exactly 2 portions');
    });
  });

  describe('Edge Cases', () => {
    it('should handle no response from API', async () => {
      mockParse.mockResolvedValue({
        choices: [{ message: {} }],
      });

      const result = await generateRecipe({ dietaryTags: [] });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('unknown');
      expect(result.error?.message).toBe('No response from AI');
    });

    it('should handle empty choices array', async () => {
      mockParse.mockResolvedValue({
        choices: [],
      });

      const result = await generateRecipe({ dietaryTags: [] });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('unknown');
      expect(result.error?.message).toBe('No response from AI');
    });

    it('should preserve all ingredient properties', async () => {
      const mockRecipe = {
        title: 'Complex Recipe',
        cookingTimeMinutes: 40,
        cookwareType: 'one-pot' as const,
        servings: 2,
        dietaryTags: [] as const,
        seasonality: ['any'] as const,
        ingredients: [
          {
            name: 'flour',
            quantity: 2.5,
            unit: 'cup',
            dietaryProperties: ['contains-gluten'] as const,
            optional: true,
            orderIndex: 0,
          },
          {
            name: 'milk',
            quantity: 1,
            unit: 'cup',
            dietaryProperties: ['contains-lactose'] as const,
            optional: false,
            orderIndex: 1,
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockRecipe } }],
      });

      const result = await generateRecipe({ dietaryTags: [] });

      expect(result.success).toBe(true);
      expect(result.recipe?.ingredients).toHaveLength(2);
      expect(result.recipe?.ingredients[0]).toEqual({
        name: 'flour',
        quantity: 2.5,
        unit: 'cup',
        dietaryProperties: ['contains-gluten'],
        optional: true,
        orderIndex: 0,
      });
      expect(result.recipe?.ingredients[1]).toEqual({
        name: 'milk',
        quantity: 1,
        unit: 'cup',
        dietaryProperties: ['contains-lactose'],
        optional: false,
        orderIndex: 1,
      });
    });
  });
});
