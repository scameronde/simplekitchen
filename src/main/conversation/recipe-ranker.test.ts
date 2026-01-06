/**
 * @module recipe-ranker.test
 * Unit tests for AI recipe ranking service with mocked dependencies.
 * Tests successful ranking, error handling, filtering, and context matching.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ConversationSession } from '../../shared/types/conversation.js';
import type { DietaryProfile, Recipe } from '../../shared/types/recipe.js';

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

// Hoist mock functions BEFORE vi.mock() to prevent real modules from being imported
const {
  mockParse: hoistedMockParse,
  mockOpenAI,
  mockGetSession,
  mockGetDietaryProfile,
  mockGetRecipes,
} = vi.hoisted(() => {
  const mockParse = vi.fn();
  const mockOpenAI = vi.fn(() => ({
    chat: {
      completions: {
        parse: mockParse,
      },
    },
  }));
  const mockGetSession = vi.fn();
  const mockGetDietaryProfile = vi.fn();
  const mockGetRecipes = vi.fn();

  return {
    mockParse,
    mockOpenAI,
    mockGetSession,
    mockGetDietaryProfile,
    mockGetRecipes,
  };
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

// Mock session-manager
vi.mock('./session-manager.js', () => ({
  getSession: mockGetSession,
}));

// Mock dietary-profile DAL
vi.mock('../database/dal/dietary-profile.js', () => ({
  getDietaryProfile: mockGetDietaryProfile,
}));

// Mock recipes DAL
vi.mock('../database/dal/recipes.js', () => ({
  getRecipes: mockGetRecipes,
}));

// Import AFTER mocks are set up
const { getRankedSuggestions } = await import('./recipe-ranker.js');
const OpenAI = (await import('openai')).default;

describe('Recipe Ranker', () => {
  // Use the hoisted mocks directly
  const mockParse = hoistedMockParse;

  // Sample test data
  const mockSessionId = 'test-session-123';
  const mockSession: ConversationSession = {
    sessionId: mockSessionId,
    messages: [],
    userContext: {
      energyLevel: 'low',
      availableTime: 30,
      mood: 'comforting',
      canShop: false,
    },
    suggestedRecipes: [],
    rejectedRecipes: [],
    state: 'suggesting',
    turnCount: 2,
    refinementCount: 0,
    turnsInCurrentState: 0,
    createdAt: new Date(),
    lastActivity: new Date(),
  };

  const mockDietaryProfile: DietaryProfile = {
    id: 1,
    hardRestrictions: ['vegetarian', 'gluten-free'],
    preferences: [],
    explicitInclusions: [],
    explicitExclusions: [],
    updatedAt: new Date(),
  };

  const mockRecipes: Recipe[] = [
    {
      id: 'recipe-001',
      title: 'Quick Veggie Stir-Fry',
      cookingTimeMinutes: 15,
      prepTimeMinutes: 10,
      totalTimeMinutes: 25,
      cookwareType: 'one-pan',
      servings: 2,
      dietaryTags: ['vegetarian', 'gluten-free'],
      seasonality: ['any'],
      sourceType: 'manual',
      sourceReference: null,
      instructions: 'Stir-fry vegetables in oil.',
      ingredients: [
        {
          id: 'ing-001',
          recipeId: 'recipe-001',
          name: 'bell peppers',
          quantity: 2,
          unit: 'whole',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'recipe-002',
      title: 'One-Pot Pasta Primavera',
      cookingTimeMinutes: 25,
      prepTimeMinutes: 5,
      totalTimeMinutes: 30,
      cookwareType: 'one-pot',
      servings: 2,
      dietaryTags: ['vegetarian', 'gluten-free'],
      seasonality: ['spring', 'summer'],
      sourceType: 'manual',
      sourceReference: null,
      instructions: 'Cook pasta with vegetables.',
      ingredients: [
        {
          id: 'ing-002',
          recipeId: 'recipe-002',
          name: 'gluten-free pasta',
          quantity: 8,
          unit: 'oz',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'recipe-003',
      title: 'Roasted Vegetable Bowl',
      cookingTimeMinutes: 30,
      prepTimeMinutes: 15,
      totalTimeMinutes: 45,
      cookwareType: 'oven',
      servings: 2,
      dietaryTags: ['vegetarian', 'gluten-free', 'vegan'],
      seasonality: ['fall', 'winter'],
      sourceType: 'manual',
      sourceReference: null,
      instructions: 'Roast vegetables in oven.',
      ingredients: [
        {
          id: 'ing-003',
          recipeId: 'recipe-003',
          name: 'sweet potato',
          quantity: 2,
          unit: 'whole',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Set dummy API key to allow tests to reach mocked OpenAI client
    process.env.OPENAI_API_KEY = 'test-api-key';

    // Default mock implementations
    mockGetSession.mockReturnValue(mockSession);
    mockGetDietaryProfile.mockResolvedValue(mockDietaryProfile);
    mockGetRecipes.mockResolvedValue(mockRecipes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful Ranking', () => {
    it('should successfully rank recipes with valid context', async () => {
      const mockSuggestions = {
        suggestions: [
          {
            recipeId: 'recipe-001',
            relevanceScore: 95,
            reasoning:
              'Perfect match for low energy and quick cooking. One-pan recipe with minimal prep.',
            matchedFactors: ['quick', 'low-energy', 'one-pan'],
          },
          {
            recipeId: 'recipe-002',
            relevanceScore: 85,
            reasoning: 'Good match with one-pot convenience and fits time constraints perfectly.',
            matchedFactors: ['one-pot', 'comforting', 'seasonal'],
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockSuggestions } }],
      });

      const result = await getRankedSuggestions(mockSessionId);

      expect(result).toEqual(mockSuggestions);
      expect(mockGetSession).toHaveBeenCalledWith(mockSessionId);
      expect(mockGetDietaryProfile).toHaveBeenCalled();
      expect(mockGetRecipes).toHaveBeenCalledWith({
        dietaryTags: ['vegetarian', 'gluten-free'],
        cookingTimeMax: 30,
      });
      expect(mockParse).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 1000,
        })
      );
    });

    it('should handle session with no dietary restrictions', async () => {
      const noDietaryProfile: DietaryProfile = {
        id: 1,
        hardRestrictions: [],
        preferences: [],
        explicitInclusions: [],
        explicitExclusions: [],
        updatedAt: new Date(),
      };

      mockGetDietaryProfile.mockResolvedValue(noDietaryProfile);

      const mockSuggestions = {
        suggestions: [
          {
            recipeId: 'recipe-001',
            relevanceScore: 90,
            reasoning: 'Quick and easy recipe for low energy.',
            matchedFactors: ['quick', 'low-energy'],
          },
          {
            recipeId: 'recipe-002',
            relevanceScore: 80,
            reasoning: 'One-pot convenience for tired evening.',
            matchedFactors: ['one-pot', 'comforting'],
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockSuggestions } }],
      });

      const result = await getRankedSuggestions(mockSessionId);

      expect(result).toEqual(mockSuggestions);
      expect(mockGetRecipes).toHaveBeenCalledWith({
        dietaryTags: undefined,
        cookingTimeMax: 30,
      });
    });

    it('should handle session with no available time constraint', async () => {
      const sessionNoTime: ConversationSession = {
        ...mockSession,
        userContext: {
          energyLevel: 'high',
          mood: 'adventurous',
        },
      };

      mockGetSession.mockReturnValue(sessionNoTime);

      const mockSuggestions = {
        suggestions: [
          {
            recipeId: 'recipe-001',
            relevanceScore: 85,
            reasoning: 'Complex recipe suitable for high energy level.',
            matchedFactors: ['high-energy', 'adventurous'],
          },
          {
            recipeId: 'recipe-003',
            relevanceScore: 75,
            reasoning: 'Interesting roasted vegetables for adventurous mood.',
            matchedFactors: ['adventurous', 'seasonal'],
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockSuggestions } }],
      });

      const result = await getRankedSuggestions(mockSessionId);

      expect(result).toEqual(mockSuggestions);
      expect(mockGetRecipes).toHaveBeenCalledWith({
        dietaryTags: ['vegetarian', 'gluten-free'],
        cookingTimeMax: undefined,
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when session not found', async () => {
      mockGetSession.mockReturnValue(null);

      await expect(getRankedSuggestions(mockSessionId)).rejects.toThrow(
        `Session ${mockSessionId} not found`
      );

      expect(mockGetDietaryProfile).not.toHaveBeenCalled();
      expect(mockGetRecipes).not.toHaveBeenCalled();
    });

    it('should throw error when fewer than 2 recipes available', async () => {
      mockGetRecipes.mockResolvedValue([mockRecipes[0]!]);

      await expect(getRankedSuggestions(mockSessionId)).rejects.toThrow(
        'Insufficient recipes found. Need at least 2 recipes but found 1'
      );

      expect(mockParse).not.toHaveBeenCalled();
    });

    it('should throw error when no recipes available', async () => {
      mockGetRecipes.mockResolvedValue([]);

      await expect(getRankedSuggestions(mockSessionId)).rejects.toThrow(
        'Insufficient recipes found. Need at least 2 recipes but found 0'
      );

      expect(mockParse).not.toHaveBeenCalled();
    });

    it('should handle OpenAI authentication error', async () => {
      const error = new (OpenAI as unknown as MockOpenAIConstructor).AuthenticationError(
        'Invalid API key'
      );
      mockParse.mockRejectedValue(error);

      await expect(getRankedSuggestions(mockSessionId)).rejects.toThrow('Invalid API key');
    });

    it('should handle OpenAI network error', async () => {
      const error = new (OpenAI as unknown as MockOpenAIConstructor).APIConnectionError(
        'Network unavailable'
      );
      mockParse.mockRejectedValue(error);

      await expect(getRankedSuggestions(mockSessionId)).rejects.toThrow('Network unavailable');
    });

    it('should handle OpenAI timeout error', async () => {
      const error = new (OpenAI as unknown as MockOpenAIConstructor).APIConnectionTimeoutError(
        'Request timed out'
      );
      mockParse.mockRejectedValue(error);

      await expect(getRankedSuggestions(mockSessionId)).rejects.toThrow('Request timed out');
    });

    it('should handle OpenAI rate limit error', async () => {
      const error = new (OpenAI as unknown as MockOpenAIConstructor).RateLimitError(
        'Rate limit exceeded'
      );
      error.headers = {
        get: (key: string) => (key === 'retry-after' ? '60' : null),
      };
      mockParse.mockRejectedValue(error);

      await expect(getRankedSuggestions(mockSessionId)).rejects.toThrow('Rate limit exceeded');
    });

    it('should throw error when no response from AI', async () => {
      mockParse.mockResolvedValue({
        choices: [{ message: {} }],
      });

      await expect(getRankedSuggestions(mockSessionId)).rejects.toThrow(
        'No response from AI ranking service'
      );
    });

    it('should throw error when empty choices array', async () => {
      mockParse.mockResolvedValue({
        choices: [],
      });

      await expect(getRankedSuggestions(mockSessionId)).rejects.toThrow(
        'No response from AI ranking service'
      );
    });
  });

  describe('Recipe Filtering and Context', () => {
    it('should enforce dietary constraints in filter', async () => {
      const strictDietaryProfile: DietaryProfile = {
        id: 1,
        hardRestrictions: ['vegan', 'gluten-free', 'lactose-free'],
        preferences: [],
        explicitInclusions: [],
        explicitExclusions: [],
        updatedAt: new Date(),
      };

      mockGetDietaryProfile.mockResolvedValue(strictDietaryProfile);

      const mockSuggestions = {
        suggestions: [
          {
            recipeId: 'recipe-003',
            relevanceScore: 90,
            reasoning: 'Vegan and gluten-free roasted vegetables.',
            matchedFactors: ['vegan', 'gluten-free'],
          },
          {
            recipeId: 'recipe-001',
            relevanceScore: 75,
            reasoning: 'Quick vegetarian option.',
            matchedFactors: ['vegetarian', 'quick'],
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockSuggestions } }],
      });

      await getRankedSuggestions(mockSessionId);

      expect(mockGetRecipes).toHaveBeenCalledWith({
        dietaryTags: ['vegan', 'gluten-free', 'lactose-free'],
        cookingTimeMax: 30,
      });
    });

    it('should limit candidates to 20 recipes', async () => {
      // Create 25 mock recipes
      const manyRecipes: Recipe[] = Array.from({ length: 25 }, (_, i) => ({
        id: `recipe-${String(i).padStart(3, '0')}`,
        title: `Recipe ${i + 1}`,
        cookingTimeMinutes: 20,
        prepTimeMinutes: 10,
        totalTimeMinutes: 30,
        cookwareType: 'one-pot' as const,
        servings: 2,
        dietaryTags: ['vegetarian'],
        seasonality: ['any'],
        sourceType: 'manual' as const,
        sourceReference: null,
        instructions: 'Cook it.',
        ingredients: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockGetRecipes.mockResolvedValue(manyRecipes);

      const mockSuggestions = {
        suggestions: [
          {
            recipeId: 'recipe-000',
            relevanceScore: 90,
            reasoning: 'First recipe matches well.',
            matchedFactors: ['quick'],
          },
          {
            recipeId: 'recipe-001',
            relevanceScore: 85,
            reasoning: 'Second recipe also good.',
            matchedFactors: ['quick'],
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockSuggestions } }],
      });

      await getRankedSuggestions(mockSessionId);

      // Verify OpenAI was called (which means the prompt was built)
      expect(mockParse).toHaveBeenCalled();

      // Check the prompt contains exactly 20 recipes (by examining the call)
      const callArgs = mockParse.mock.calls[0]?.[0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('Rank ALL 20 recipes');
    });

    it('should include already-suggested recipes in context', async () => {
      const sessionWithHistory: ConversationSession = {
        ...mockSession,
        suggestedRecipes: ['recipe-001', 'recipe-002'],
      };

      mockGetSession.mockReturnValue(sessionWithHistory);

      const mockSuggestions = {
        suggestions: [
          {
            recipeId: 'recipe-003',
            relevanceScore: 95,
            reasoning: 'Fresh suggestion not shown before.',
            matchedFactors: ['seasonal', 'comforting'],
          },
          {
            recipeId: 'recipe-001',
            relevanceScore: 70,
            reasoning: 'Already suggested but still matches.',
            matchedFactors: ['quick'],
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockSuggestions } }],
      });

      await getRankedSuggestions(mockSessionId);

      // Verify the prompt includes already-suggested section
      const callArgs = mockParse.mock.calls[0]?.[0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('Already Suggested in This Session');
      expect(userMessage.content).toContain('recipe-001');
      expect(userMessage.content).toContain('recipe-002');
    });

    it('should pass user context to ranking prompt', async () => {
      const richSession: ConversationSession = {
        ...mockSession,
        userContext: {
          energyLevel: 'high',
          availableTime: 60,
          mood: 'adventurous',
          canShop: true,
        },
      };

      mockGetSession.mockReturnValue(richSession);

      const mockSuggestions = {
        suggestions: [
          {
            recipeId: 'recipe-003',
            relevanceScore: 95,
            reasoning: 'Complex recipe perfect for high energy and adventurous mood.',
            matchedFactors: ['high-energy', 'adventurous', 'complex'],
          },
          {
            recipeId: 'recipe-001',
            relevanceScore: 80,
            reasoning: 'Quick option as backup.',
            matchedFactors: ['quick'],
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockSuggestions } }],
      });

      await getRankedSuggestions(mockSessionId);

      // Verify prompt contains all context fields
      const callArgs = mockParse.mock.calls[0]?.[0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('Energy Level: high');
      expect(userMessage.content).toContain('Available Time: 60 minutes');
      expect(userMessage.content).toContain('Mood/Cravings: adventurous');
      expect(userMessage.content).toContain('Can Shop: yes');
    });
  });

  describe('Prompt Construction', () => {
    it('should include system prompt in API call', async () => {
      const mockSuggestions = {
        suggestions: [
          {
            recipeId: 'recipe-001',
            relevanceScore: 90,
            reasoning: 'Good match.',
            matchedFactors: ['quick'],
          },
          {
            recipeId: 'recipe-002',
            relevanceScore: 85,
            reasoning: 'Also good.',
            matchedFactors: ['comforting'],
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockSuggestions } }],
      });

      await getRankedSuggestions(mockSessionId);

      const callArgs = mockParse.mock.calls[0]?.[0];
      const systemMessage = callArgs.messages.find((m: { role: string }) => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toContain('recipe recommendation expert');
      expect(systemMessage.content).toContain('Ranking Criteria');
    });

    it('should include dietary profile in prompt', async () => {
      const mockSuggestions = {
        suggestions: [
          {
            recipeId: 'recipe-001',
            relevanceScore: 90,
            reasoning: 'Matches dietary restrictions.',
            matchedFactors: ['vegetarian', 'gluten-free'],
          },
          {
            recipeId: 'recipe-002',
            relevanceScore: 85,
            reasoning: 'Also matches restrictions.',
            matchedFactors: ['vegetarian', 'gluten-free'],
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockSuggestions } }],
      });

      await getRankedSuggestions(mockSessionId);

      const callArgs = mockParse.mock.calls[0]?.[0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('Dietary Profile');
      expect(userMessage.content).toContain('vegetarian, gluten-free');
    });

    it('should include recipe candidate details in prompt', async () => {
      const mockSuggestions = {
        suggestions: [
          {
            recipeId: 'recipe-001',
            relevanceScore: 90,
            reasoning: 'Perfect match.',
            matchedFactors: ['quick', 'low-energy'],
          },
          {
            recipeId: 'recipe-002',
            relevanceScore: 85,
            reasoning: 'Good option.',
            matchedFactors: ['comforting'],
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockSuggestions } }],
      });

      await getRankedSuggestions(mockSessionId);

      const callArgs = mockParse.mock.calls[0]?.[0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('Candidate Recipes');
      expect(userMessage.content).toContain('recipe-001');
      expect(userMessage.content).toContain('Quick Veggie Stir-Fry');
      expect(userMessage.content).toContain('recipe-002');
      expect(userMessage.content).toContain('One-Pot Pasta Primavera');
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly 2 recipes (minimum)', async () => {
      mockGetRecipes.mockResolvedValue(mockRecipes.slice(0, 2));

      const mockSuggestions = {
        suggestions: [
          {
            recipeId: 'recipe-001',
            relevanceScore: 90,
            reasoning: 'Best match.',
            matchedFactors: ['quick'],
          },
          {
            recipeId: 'recipe-002',
            relevanceScore: 80,
            reasoning: 'Second best.',
            matchedFactors: ['comforting'],
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockSuggestions } }],
      });

      const result = await getRankedSuggestions(mockSessionId);

      expect(result).toEqual(mockSuggestions);
      expect(result.suggestions).toHaveLength(2);
    });

    it('should handle missing optional context fields', async () => {
      const minimalSession: ConversationSession = {
        ...mockSession,
        userContext: {},
        suggestedRecipes: [],
      };

      mockGetSession.mockReturnValue(minimalSession);

      const mockSuggestions = {
        suggestions: [
          {
            recipeId: 'recipe-001',
            relevanceScore: 80,
            reasoning: 'General recommendation.',
            matchedFactors: ['quick'],
          },
          {
            recipeId: 'recipe-002',
            relevanceScore: 75,
            reasoning: 'Also suitable.',
            matchedFactors: ['easy'],
          },
        ],
      };

      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: mockSuggestions } }],
      });

      const result = await getRankedSuggestions(mockSessionId);

      expect(result).toEqual(mockSuggestions);

      // Verify prompt handles missing context gracefully
      const callArgs = mockParse.mock.calls[0]?.[0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('not specified');
    });
  });
});
