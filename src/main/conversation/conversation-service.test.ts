/**
 * @module conversation-service.test
 * Unit tests for conversation service with mocked OpenAI SDK.
 * Tests conversation turn processing, context extraction, state transitions, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
