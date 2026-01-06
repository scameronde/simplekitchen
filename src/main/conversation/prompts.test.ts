/**
 * @module prompts.test
 * Unit tests for prompt building functions.
 * Tests buildRefinementContext for refinement workflow context generation.
 */

import { describe, it, expect } from 'vitest';
import { buildRefinementContext } from './prompts.js';
import type { ConversationSession } from '../../shared/types/conversation.js';
import type { Recipe } from '../../shared/types/recipe.js';

describe('buildRefinementContext', () => {
  // Mock recipe data for tests
  const mockRecipes: Recipe[] = [
    {
      id: 'recipe-1',
      title: 'Chicken Pasta',
      cookingTimeMinutes: 30,
      prepTimeMinutes: 10,
      totalTimeMinutes: 40,
      cookwareType: 'one-pot',
      servings: 2,
      dietaryTags: [],
      seasonality: [],
      sourceType: 'manual',
      sourceReference: null,
      instructions: 'Cook pasta with chicken',
      ingredients: [
        {
          id: 'ing-1',
          recipeId: 'recipe-1',
          name: 'pasta',
          quantity: 200,
          unit: 'g',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
        {
          id: 'ing-2',
          recipeId: 'recipe-1',
          name: 'chicken',
          quantity: 300,
          unit: 'g',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 2,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'recipe-2',
      title: 'Beef Pasta',
      cookingTimeMinutes: 35,
      prepTimeMinutes: 15,
      totalTimeMinutes: 50,
      cookwareType: 'one-pan',
      servings: 2,
      dietaryTags: [],
      seasonality: [],
      sourceType: 'manual',
      sourceReference: null,
      instructions: 'Cook pasta with beef',
      ingredients: [
        {
          id: 'ing-3',
          recipeId: 'recipe-2',
          name: 'pasta',
          quantity: 200,
          unit: 'g',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
        {
          id: 'ing-4',
          recipeId: 'recipe-2',
          name: 'beef',
          quantity: 400,
          unit: 'g',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 2,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'recipe-3',
      title: 'Chicken Stir Fry',
      cookingTimeMinutes: 25,
      prepTimeMinutes: 10,
      totalTimeMinutes: 35,
      cookwareType: 'one-pan',
      servings: 2,
      dietaryTags: [],
      seasonality: [],
      sourceType: 'manual',
      sourceReference: null,
      instructions: 'Stir fry chicken and vegetables',
      ingredients: [
        {
          id: 'ing-5',
          recipeId: 'recipe-3',
          name: 'chicken',
          quantity: 300,
          unit: 'g',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 1,
        },
        {
          id: 'ing-6',
          recipeId: 'recipe-3',
          name: 'vegetables',
          quantity: 200,
          unit: 'g',
          dietaryProperties: ['none'],
          optional: false,
          orderIndex: 2,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it('should return empty string if no rejections', () => {
    // Create session with empty rejectedRecipes array
    const session: ConversationSession = {
      sessionId: 'test-session',
      messages: [],
      userContext: {},
      suggestedRecipes: [],
      rejectedRecipes: [],
      state: 'refining',
      turnCount: 0,
      refinementCount: 0,
      turnsInCurrentState: 0,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    const result = buildRefinementContext(session, mockRecipes);

    expect(result).toBe('');
  });

  it('should list rejected recipes with reasons', () => {
    // Create session with rejectedRecipes
    const session: ConversationSession = {
      sessionId: 'test-session',
      messages: [],
      userContext: {},
      suggestedRecipes: ['recipe-1', 'recipe-2'],
      rejectedRecipes: [
        { recipeId: 'recipe-1', reason: 'Missing ingredient' },
        { recipeId: 'recipe-2', reason: 'Not in the mood' },
      ],
      state: 'refining',
      turnCount: 0,
      refinementCount: 2,
      turnsInCurrentState: 0,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    const result = buildRefinementContext(session, mockRecipes);

    // Assert context contains recipe titles and reasons
    expect(result).toContain('Chicken Pasta');
    expect(result).toContain('Beef Pasta');
    expect(result).toContain('Missing ingredient');
    expect(result).toContain('Not in the mood');
  });

  it('should detect pattern when 2+ recipes share ingredient', () => {
    // Create session with rejectedRecipes for recipe-1 and recipe-2 (both contain pasta)
    const session: ConversationSession = {
      sessionId: 'test-session',
      messages: [],
      userContext: {},
      suggestedRecipes: ['recipe-1', 'recipe-2'],
      rejectedRecipes: [
        { recipeId: 'recipe-1', reason: 'Too heavy' },
        { recipeId: 'recipe-2', reason: 'Not feeling it' },
      ],
      state: 'refining',
      turnCount: 0,
      refinementCount: 2,
      turnsInCurrentState: 0,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    const result = buildRefinementContext(session, mockRecipes);

    // Assert context contains pattern detection and 'pasta'
    expect(result).toContain('Detected Patterns');
    expect(result).toContain('pasta');
  });

  it('should use different strategy for refinement count 1, 2, 3+', () => {
    // Base session with 1 rejection
    const baseSession: ConversationSession = {
      sessionId: 'test-session',
      messages: [],
      userContext: {},
      suggestedRecipes: ['recipe-1'],
      rejectedRecipes: [{ recipeId: 'recipe-1', reason: 'Too simple' }],
      state: 'refining',
      turnCount: 0,
      refinementCount: 1,
      turnsInCurrentState: 0,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    // Test with refinementCount: 1
    const result1 = buildRefinementContext(baseSession, mockRecipes);
    expect(result1).toContain('first refinement');

    // Test with refinementCount: 2
    const session2 = { ...baseSession, refinementCount: 2 };
    const result2 = buildRefinementContext(session2, mockRecipes);
    expect(result2).toContain('second refinement');

    // Test with refinementCount: 3
    const session3 = { ...baseSession, refinementCount: 3 };
    const result3 = buildRefinementContext(session3, mockRecipes);
    expect(result3).toContain('third or later');
  });
});
