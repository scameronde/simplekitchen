import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as recipeDAL from '../database/dal/recipes';

vi.mock('../database/dal/recipes');

// Mock electron module - must be inside factory function for hoisting
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => ':memory:'),
  },
}));

describe('Recipe IPC Handlers', () => {
  let handlerFn: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Import electron to get the mocked ipcMain
    const { ipcMain } = await import('electron');

    // Capture handler function when handle is called
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, fn: any) => {
      if (channel === 'recipe:create') handlerFn = fn;
    });

    // Import and register handlers after mocks are set up
    const { registerRecipeHandlers } = await import('./recipe-handlers');
    registerRecipeHandlers();
  });

  it('returns success when recipe is created', async () => {
    const mockRecipe = { id: '123', title: 'Test', cookingTimeMinutes: 35 };
    vi.mocked(recipeDAL.createRecipe).mockResolvedValue(mockRecipe as any);

    const input = {
      title: 'Test',
      cookingTimeMinutes: 35,
      cookwareType: 'one-pot',
      servings: 2,
      dietaryTags: [],
      seasonality: ['any'],
      sourceType: 'manual',
      ingredients: [
        {
          name: 'pasta',
          quantity: 200,
          unit: 'g',
          dietaryProperties: [],
          optional: false,
          orderIndex: 1,
        },
      ],
    };

    const result = await handlerFn(null, input);

    expect(result.success).toBe(true);
    expect(result.recipe).toEqual(mockRecipe);
  });

  it('returns errors when validation fails', async () => {
    vi.mocked(recipeDAL.createRecipe).mockRejectedValue(
      new Error('Recipe validation failed:\ntitle: Title is required')
    );

    const result = await handlerFn(null, { title: '' });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
