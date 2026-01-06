/**
 * @module conversation-service.test
 * Unit tests for conversation service with mocked OpenAI SDK.
 * Tests conversation turn processing, context extraction, state transitions, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import type { ConversationSession } from '../../shared/types/conversation.js';
import type { DietaryProfile } from '../../shared/types/recipe.js';

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
const mockGetSession = vi.fn();
const mockUpdateSessionMessages = vi.fn();
vi.mock('./session-manager.js', () => ({
  getSession: mockGetSession,
  updateSessionMessages: mockUpdateSessionMessages,
}));

// Mock dietary-profile DAL
const mockGetDietaryProfile = vi.fn();
vi.mock('../database/dal/dietary-profile.js', () => ({
  getDietaryProfile: mockGetDietaryProfile,
}));

// Import AFTER mocks are set up
const { processConversationTurn } = await import('./conversation-service.js');
const { buildConversationPrompt } = await import('./prompts.js');

describe('processConversationTurn', () => {
  const mockParse = hoistedMockParse;
  const sessionId = 'test-session-id';

  beforeEach(() => {
    vi.clearAllMocks();
    // Set dummy API key to allow tests to reach mocked OpenAI client
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should extract energy level from user response', async () => {
    // Mock session with empty userContext
    const mockSession: ConversationSession = {
      sessionId,
      messages: [],
      userContext: {},
      suggestedRecipes: [],
      rejectedRecipes: [],
      state: 'gathering',
      turnCount: 0,
      refinementCount: 0,
      turnsInCurrentState: 0,
      createdAt: new Date(),
      lastActivity: new Date(),
    };
    mockGetSession.mockReturnValue(mockSession);

    // Mock dietary profile
    const mockDietaryProfile: DietaryProfile = {
      id: 1,
      hardRestrictions: [],
      preferences: [],
      explicitInclusions: [],
      explicitExclusions: [],
      updatedAt: new Date(),
    };
    mockGetDietaryProfile.mockResolvedValue(mockDietaryProfile);

    // Mock OpenAI response
    mockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              aiMessage: 'Got it! How much time do you have?',
              extractedContext: { energyLevel: 'low' },
              shouldTransition: false,
            },
          },
        },
      ],
    });

    const result = await processConversationTurn(sessionId, "I'm pretty tired");

    expect(result.extractedContext.energyLevel).toBe('low');
    expect(result.shouldTransition).toBe(false);
    expect(result.aiMessage).toBe('Got it! How much time do you have?');

    // Expect updateSessionMessages called twice (user + AI)
    expect(mockUpdateSessionMessages).toHaveBeenCalledTimes(2);
    expect(mockUpdateSessionMessages).toHaveBeenNthCalledWith(1, sessionId, {
      role: 'user',
      content: "I'm pretty tired",
      timestamp: expect.any(Date),
    });
    expect(mockUpdateSessionMessages).toHaveBeenNthCalledWith(2, sessionId, {
      role: 'assistant',
      content: 'Got it! How much time do you have?',
      timestamp: expect.any(Date),
    });
  });

  it('should transition to suggesting when context complete', async () => {
    // Mock session with existing userContext
    const mockSession: ConversationSession = {
      sessionId,
      messages: [
        {
          role: 'user',
          content: "I'm pretty tired",
          timestamp: new Date(),
        },
        {
          role: 'assistant',
          content: 'Got it! How much time do you have?',
          timestamp: new Date(),
        },
      ],
      userContext: { energyLevel: 'low' },
      suggestedRecipes: [],
      rejectedRecipes: [],
      state: 'gathering',
      turnCount: 2,
      refinementCount: 0,
      turnsInCurrentState: 0,
      createdAt: new Date(),
      lastActivity: new Date(),
    };
    mockGetSession.mockReturnValue(mockSession);

    // Mock dietary profile
    const mockDietaryProfile: DietaryProfile = {
      id: 1,
      hardRestrictions: [],
      preferences: [],
      explicitInclusions: [],
      explicitExclusions: [],
      updatedAt: new Date(),
    };
    mockGetDietaryProfile.mockResolvedValue(mockDietaryProfile);

    // Mock OpenAI response indicating transition should happen
    mockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              aiMessage: 'Perfect! Let me find some recipes.',
              extractedContext: { availableTime: 30 },
              shouldTransition: true,
            },
          },
        },
      ],
    });

    const result = await processConversationTurn(sessionId, 'About 30 minutes');

    expect(result.shouldTransition).toBe(true);
    expect(result.extractedContext.availableTime).toBe(30);
    expect(result.aiMessage).toBe('Perfect! Let me find some recipes.');

    // Verify both messages were added
    expect(mockUpdateSessionMessages).toHaveBeenCalledTimes(2);
  });

  it('should handle AI service failure gracefully', async () => {
    // Mock session
    const mockSession: ConversationSession = {
      sessionId,
      messages: [],
      userContext: {},
      suggestedRecipes: [],
      rejectedRecipes: [],
      state: 'gathering',
      turnCount: 0,
      refinementCount: 0,
      turnsInCurrentState: 0,
      createdAt: new Date(),
      lastActivity: new Date(),
    };
    mockGetSession.mockReturnValue(mockSession);

    // Mock dietary profile
    const mockDietaryProfile: DietaryProfile = {
      id: 1,
      hardRestrictions: [],
      preferences: [],
      explicitInclusions: [],
      explicitExclusions: [],
      updatedAt: new Date(),
    };
    mockGetDietaryProfile.mockResolvedValue(mockDietaryProfile);

    // Mock OpenAI to throw error
    mockParse.mockRejectedValue(new Error('OpenAI API error'));

    const result = await processConversationTurn(sessionId, 'Hello');

    // Should return fallback response
    expect(result.shouldTransition).toBe(true);
    expect(result.aiMessage).toBe(
      "Sorry, I'm having trouble right now. Let's move forward with default settings."
    );
    expect(result.extractedContext).toEqual({});
    expect(result.reasoning).toBe('AI service unavailable');

    // User message should still be added, but not AI message (since it failed)
    expect(mockUpdateSessionMessages).toHaveBeenCalledTimes(1);
    expect(mockUpdateSessionMessages).toHaveBeenCalledWith(sessionId, {
      role: 'user',
      content: 'Hello',
      timestamp: expect.any(Date),
    });
  });
});

describe('buildConversationPrompt', () => {
  it('should include dietary restrictions in prompt', () => {
    // Mock session with empty messages
    const mockSession: ConversationSession = {
      sessionId: 'test-session',
      messages: [],
      userContext: {},
      suggestedRecipes: [],
      rejectedRecipes: [],
      state: 'gathering',
      turnCount: 0,
      refinementCount: 0,
      turnsInCurrentState: 0,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    // Mock dietary profile with hardRestrictions
    const mockDietaryProfile: DietaryProfile = {
      id: 1,
      hardRestrictions: ['gluten-free'],
      preferences: [],
      explicitInclusions: [],
      explicitExclusions: [],
      updatedAt: new Date(),
    };

    const prompt = buildConversationPrompt(mockSession, mockDietaryProfile);

    expect(prompt).toContain('gluten-free');
    expect(prompt).toContain("User's Dietary Restrictions");
  });

  it('should include last 5 messages in prompt', () => {
    // Mock session with 7 messages
    const mockSession: ConversationSession = {
      sessionId: 'test-session',
      messages: [
        { role: 'user', content: 'Message 1', timestamp: new Date() },
        { role: 'assistant', content: 'Message 2', timestamp: new Date() },
        { role: 'user', content: 'Message 3', timestamp: new Date() },
        { role: 'assistant', content: 'Message 4', timestamp: new Date() },
        { role: 'user', content: 'Message 5', timestamp: new Date() },
        { role: 'assistant', content: 'Message 6', timestamp: new Date() },
        { role: 'user', content: 'Message 7', timestamp: new Date() },
      ],
      userContext: {},
      suggestedRecipes: [],
      rejectedRecipes: [],
      state: 'gathering',
      turnCount: 7,
      refinementCount: 0,
      turnsInCurrentState: 0,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    // Mock dietary profile
    const mockDietaryProfile: DietaryProfile = {
      id: 1,
      hardRestrictions: [],
      preferences: [],
      explicitInclusions: [],
      explicitExclusions: [],
      updatedAt: new Date(),
    };

    const prompt = buildConversationPrompt(mockSession, mockDietaryProfile);

    // Should include last 5 messages (3-7), not all 7
    expect(prompt).toContain('Message 3');
    expect(prompt).toContain('Message 4');
    expect(prompt).toContain('Message 5');
    expect(prompt).toContain('Message 6');
    expect(prompt).toContain('Message 7');

    // Should NOT include the first 2 messages
    expect(prompt).not.toContain('Message 1');
    expect(prompt).not.toContain('Message 2');
  });
});

describe('transitionToSuggesting', () => {
  // Import real modules for integration testing
  let realSessionManager: typeof import('./session-manager.js');
  let realTransitionToSuggesting: typeof import('./conversation-service.js').transitionToSuggesting;
  let realCreateRecipe: typeof import('../database/dal/recipes.js').createRecipe;
  let runMigrations: typeof import('../database/index.js').runMigrations;
  let closeDatabase: typeof import('../database/index.js').closeDatabase;

  beforeEach(async () => {
    // Reset module cache to ensure all modules share the same state
    vi.resetModules();

    // Unmock session-manager and dietary-profile for integration tests
    vi.doUnmock('./session-manager.js');
    vi.doUnmock('../database/dal/dietary-profile.js');
    vi.doUnmock('../database/dal/recipes.js');
    vi.doUnmock('../database/index.js');

    // Dynamically import real modules
    realSessionManager = await import('./session-manager.js');
    const conversationService = await import('./conversation-service.js');
    realTransitionToSuggesting = conversationService.transitionToSuggesting;
    const recipesDAL = await import('../database/dal/recipes.js');
    realCreateRecipe = recipesDAL.createRecipe;
    const dbModule = await import('../database/index.js');
    runMigrations = dbModule.runMigrations;
    closeDatabase = dbModule.closeDatabase;

    // Set up real database (migration creates dietary profile automatically)
    runMigrations();

    // Set dummy API key for OpenAI client
    process.env.OPENAI_API_KEY = 'test-api-key';

    // Create test recipes in database
    await realCreateRecipe({
      title: 'Quick Pasta',
      cookingTimeMinutes: 20,
      prepTimeMinutes: 5,
      cookwareType: 'one-pot',
      servings: 2,
      dietaryTags: ['vegetarian'],
      seasonality: ['any'],
      sourceType: 'manual',
      instructions: 'Cook pasta, add sauce',
      ingredients: [
        {
          name: 'pasta',
          quantity: 200,
          unit: 'g',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
      ],
    });

    await realCreateRecipe({
      title: 'Simple Salad',
      cookingTimeMinutes: 10,
      prepTimeMinutes: 5,
      cookwareType: 'one-pot',
      servings: 2,
      dietaryTags: ['vegan', 'gluten-free'],
      seasonality: ['any'],
      sourceType: 'manual',
      instructions: 'Mix ingredients',
      ingredients: [
        {
          name: 'lettuce',
          quantity: 100,
          unit: 'g',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
      ],
    });

    await realCreateRecipe({
      title: 'Fast Stir Fry',
      cookingTimeMinutes: 25,
      prepTimeMinutes: 10,
      cookwareType: 'one-pan',
      servings: 2,
      dietaryTags: ['gluten-free'],
      seasonality: ['any'],
      sourceType: 'manual',
      instructions: 'Stir fry vegetables',
      ingredients: [
        {
          name: 'vegetables',
          quantity: 300,
          unit: 'g',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
      ],
    });

    // Note: Dietary profile is created automatically by migration

    // Mock OpenAI parse to return 3 ranked recipes
    hoistedMockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              suggestions: [
                {
                  recipeId: 'recipe-1',
                  relevanceScore: 95,
                  reasoning: 'Perfect for low energy, quick cook time',
                  matchedFactors: ['energy-level', 'cooking-time'],
                },
                {
                  recipeId: 'recipe-2',
                  relevanceScore: 85,
                  reasoning: 'No cooking required, very easy',
                  matchedFactors: ['energy-level'],
                },
                {
                  recipeId: 'recipe-3',
                  relevanceScore: 75,
                  reasoning: 'Quick and nutritious',
                  matchedFactors: ['cooking-time'],
                },
              ],
            },
          },
        },
      ],
    });
  });

  afterAll(() => {
    closeDatabase();
  });

  it('should successfully transition from gathering to suggesting with valid context', async () => {
    // Create session with complete context
    const sessionId = await realSessionManager.createSession();
    realSessionManager.updateUserContext(sessionId, {
      energyLevel: 'low',
      availableTime: 30,
    });

    // Call transitionToSuggesting
    const result = await realTransitionToSuggesting(sessionId);

    // Verify success
    expect(result.success).toBe(true);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions?.suggestions).toHaveLength(3);
    expect(result.aiMessage).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should return error when energyLevel is missing', async () => {
    // Create session with incomplete context (missing energyLevel)
    const sessionId = await realSessionManager.createSession();
    realSessionManager.updateUserContext(sessionId, {
      availableTime: 30,
    });

    // Call transitionToSuggesting
    const result = await realTransitionToSuggesting(sessionId);

    // Verify error
    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing required context (energyLevel and availableTime)');
    expect(result.suggestions).toBeUndefined();
  });

  it('should return error when availableTime is missing', async () => {
    // Create session with incomplete context (missing availableTime)
    const sessionId = await realSessionManager.createSession();
    realSessionManager.updateUserContext(sessionId, {
      energyLevel: 'high',
    });

    // Call transitionToSuggesting
    const result = await realTransitionToSuggesting(sessionId);

    // Verify error
    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing required context (energyLevel and availableTime)');
    expect(result.suggestions).toBeUndefined();
  });

  it('should update session state to suggesting', async () => {
    // Create session with complete context
    const sessionId = await realSessionManager.createSession();
    realSessionManager.updateUserContext(sessionId, {
      energyLevel: 'medium',
      availableTime: 45,
    });

    // Verify initial state is 'gathering'
    const sessionBefore = realSessionManager.getSession(sessionId);
    expect(sessionBefore?.state).toBe('gathering');

    // Call transitionToSuggesting
    await realTransitionToSuggesting(sessionId);

    // Verify state changed to 'suggesting'
    const sessionAfter = realSessionManager.getSession(sessionId);
    expect(sessionAfter?.state).toBe('suggesting');
  });

  it('should track suggested recipe IDs in session', async () => {
    // Create session with complete context
    const sessionId = await realSessionManager.createSession();
    realSessionManager.updateUserContext(sessionId, {
      energyLevel: 'low',
      availableTime: 20,
    });

    // Verify initial suggestedRecipes is empty
    const sessionBefore = realSessionManager.getSession(sessionId);
    expect(sessionBefore?.suggestedRecipes).toHaveLength(0);

    // Call transitionToSuggesting
    const result = await realTransitionToSuggesting(sessionId);

    // Verify suggested recipe IDs are tracked in session
    const sessionAfter = realSessionManager.getSession(sessionId);
    expect(sessionAfter?.suggestedRecipes).toHaveLength(3);
    expect(sessionAfter?.suggestedRecipes).toEqual(['recipe-1', 'recipe-2', 'recipe-3']);

    // Also verify in result
    expect(result.suggestions?.suggestions).toHaveLength(3);
    expect(result.suggestions?.suggestions[0]?.recipeId).toBe('recipe-1');
    expect(result.suggestions?.suggestions[1]?.recipeId).toBe('recipe-2');
    expect(result.suggestions?.suggestions[2]?.recipeId).toBe('recipe-3');
  });

  it('should return AI message and suggestions in result', async () => {
    // Create session with complete context
    const sessionId = await realSessionManager.createSession();
    realSessionManager.updateUserContext(sessionId, {
      energyLevel: 'high',
      availableTime: 60,
    });

    // Call transitionToSuggesting
    const result = await realTransitionToSuggesting(sessionId);

    // Verify result structure
    expect(result.success).toBe(true);
    expect(result.aiMessage).toBe(
      "Great! Based on your context, here are some recipes I think you'll love:"
    );
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions?.suggestions).toHaveLength(3);

    // Verify suggestions have required fields
    const firstSuggestion = result.suggestions?.suggestions[0];
    expect(firstSuggestion?.recipeId).toBe('recipe-1');
    expect(firstSuggestion?.relevanceScore).toBe(95);
    expect(firstSuggestion?.reasoning).toBe('Perfect for low energy, quick cook time');
  });
});

describe('processRefinement Integration', () => {
  // Import real modules for integration testing
  let realSessionManager: typeof import('./session-manager.js');
  let realProcessRefinement: typeof import('./conversation-service.js').processRefinement;
  let realCreateRecipe: typeof import('../database/dal/recipes.js').createRecipe;
  let runMigrations: typeof import('../database/index.js').runMigrations;
  let closeDatabase: typeof import('../database/index.js').closeDatabase;

  beforeEach(async () => {
    // Reset module cache to ensure all modules share the same state
    vi.resetModules();

    // Unmock session-manager and dietary-profile for integration tests
    vi.doUnmock('./session-manager.js');
    vi.doUnmock('../database/dal/dietary-profile.js');
    vi.doUnmock('../database/dal/recipes.js');
    vi.doUnmock('../database/index.js');

    // Dynamically import real modules
    realSessionManager = await import('./session-manager.js');
    const conversationService = await import('./conversation-service.js');
    realProcessRefinement = conversationService.processRefinement;
    const recipesDAL = await import('../database/dal/recipes.js');
    realCreateRecipe = recipesDAL.createRecipe;
    const dbModule = await import('../database/index.js');
    runMigrations = dbModule.runMigrations;
    closeDatabase = dbModule.closeDatabase;

    // Set up real database (migration creates dietary profile automatically)
    runMigrations();

    // Set dummy API key for OpenAI client
    process.env.OPENAI_API_KEY = 'test-api-key';

    // Create test recipes in database
    await realCreateRecipe({
      title: 'Quick Pasta',
      cookingTimeMinutes: 20,
      prepTimeMinutes: 5,
      cookwareType: 'one-pot',
      servings: 2,
      dietaryTags: ['vegetarian'],
      seasonality: ['any'],
      sourceType: 'manual',
      instructions: 'Cook pasta, add sauce',
      ingredients: [
        {
          name: 'pasta',
          quantity: 200,
          unit: 'g',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
      ],
    });

    await realCreateRecipe({
      title: 'Simple Salad',
      cookingTimeMinutes: 10,
      prepTimeMinutes: 5,
      cookwareType: 'one-pot',
      servings: 2,
      dietaryTags: ['vegan', 'gluten-free'],
      seasonality: ['any'],
      sourceType: 'manual',
      instructions: 'Mix ingredients',
      ingredients: [
        {
          name: 'lettuce',
          quantity: 100,
          unit: 'g',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
      ],
    });

    await realCreateRecipe({
      title: 'Fast Stir Fry',
      cookingTimeMinutes: 25,
      prepTimeMinutes: 10,
      cookwareType: 'one-pan',
      servings: 2,
      dietaryTags: ['gluten-free'],
      seasonality: ['any'],
      sourceType: 'manual',
      instructions: 'Stir fry vegetables',
      ingredients: [
        {
          name: 'vegetables',
          quantity: 300,
          unit: 'g',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
      ],
    });

    await realCreateRecipe({
      title: 'Easy Soup',
      cookingTimeMinutes: 15,
      prepTimeMinutes: 5,
      cookwareType: 'one-pot',
      servings: 2,
      dietaryTags: ['vegan'],
      seasonality: ['any'],
      sourceType: 'manual',
      instructions: 'Heat and serve',
      ingredients: [
        {
          name: 'broth',
          quantity: 500,
          unit: 'ml',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
      ],
    });

    // Mock OpenAI parse to return ranked recipes
    hoistedMockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              suggestions: [
                {
                  recipeId: 'recipe-2',
                  relevanceScore: 90,
                  reasoning: 'Fresh alternative, very easy',
                  matchedFactors: ['energy-level'],
                },
                {
                  recipeId: 'recipe-3',
                  relevanceScore: 80,
                  reasoning: 'Quick and nutritious',
                  matchedFactors: ['cooking-time'],
                },
                {
                  recipeId: 'recipe-4',
                  relevanceScore: 75,
                  reasoning: 'Simple and comforting',
                  matchedFactors: ['energy-level'],
                },
              ],
            },
          },
        },
      ],
    });
  });

  afterAll(() => {
    closeDatabase();
  });

  it('should successfully refine with rejected recipes', async () => {
    // Create session with complete context
    const sessionId = await realSessionManager.createSession();
    realSessionManager.updateUserContext(sessionId, {
      energyLevel: 'low',
      availableTime: 30,
    });
    realSessionManager.updateSessionState(sessionId, 'suggesting');
    realSessionManager.addRejectedRecipe(sessionId, 'recipe-1', 'Too complex');

    // Call processRefinement
    const result = await realProcessRefinement(sessionId);

    // Verify success
    expect(result.success).toBe(true);
    expect(result.suggestions).toBeDefined();
    expect(result.aiMessage).toContain('different options');
  });

  it('should return escalation message after 3+ refinements', async () => {
    // Create session with complete context
    const sessionId = await realSessionManager.createSession();
    realSessionManager.updateUserContext(sessionId, {
      energyLevel: 'low',
      availableTime: 30,
    });
    realSessionManager.updateSessionState(sessionId, 'suggesting');

    // Add 4 rejected recipes to trigger escalation (refinementCount > 3)
    realSessionManager.addRejectedRecipe(sessionId, 'recipe-1', 'Not interested');
    realSessionManager.addRejectedRecipe(sessionId, 'recipe-2', 'Not interested');
    realSessionManager.addRejectedRecipe(sessionId, 'recipe-3', 'Not interested');
    realSessionManager.addRejectedRecipe(sessionId, 'recipe-4', 'Not interested');

    // Call processRefinement
    const result = await realProcessRefinement(sessionId);

    // Verify escalation response
    expect(result.success).toBe(true);
    expect(result.suggestions).toBeUndefined();
    expect(result.aiMessage).toContain('different approach');
    expect(result.aiMessage).toContain('Browse by Category');
  });

  it('should return error if not in suggesting or refining state', async () => {
    // Create session (default state is 'gathering')
    const sessionId = await realSessionManager.createSession();

    // Call processRefinement
    const result = await realProcessRefinement(sessionId);

    // Verify error
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot refine from state');
  });

  it('should transition state from suggesting to refining', async () => {
    // Create session with complete context
    const sessionId = await realSessionManager.createSession();
    realSessionManager.updateUserContext(sessionId, {
      energyLevel: 'low',
      availableTime: 30,
    });
    realSessionManager.updateSessionState(sessionId, 'suggesting');
    realSessionManager.addRejectedRecipe(sessionId, 'recipe-1', 'Not what I want');

    // Mock OpenAI to return suggestions
    hoistedMockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              suggestions: [
                {
                  recipeId: 'recipe-2',
                  relevanceScore: 90,
                  reasoning: 'Different option',
                  matchedFactors: ['energy-level'],
                },
              ],
            },
          },
        },
      ],
    });

    // Call processRefinement
    await realProcessRefinement(sessionId);

    // Verify state changed to 'refining'
    const session = realSessionManager.getSession(sessionId);
    expect(session?.state).toBe('refining');
  });
});
