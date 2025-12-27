import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as recipeDAL from '../database/dal/recipes';
import type { Recipe, CreateRecipeInput } from '../../shared/types/recipe';

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

type IpcHandlerResult = { success: boolean; recipe?: Recipe; errors?: unknown[] };
type IpcHandler = (event: unknown, input: CreateRecipeInput) => Promise<IpcHandlerResult>;

describe('Recipe IPC Handlers', () => {
  let handlerFn: IpcHandler | undefined;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Import electron to get the mocked ipcMain
    const { ipcMain } = await import('electron');

    // Capture handler function when handle is called
    vi.mocked(ipcMain.handle).mockImplementation((channel, fn) => {
      if (channel === 'recipe:create') handlerFn = fn as IpcHandler;
    });

    // Import and register handlers after mocks are set up
    const { registerRecipeHandlers } = await import('./recipe-handlers');
    registerRecipeHandlers();
  });

  it('returns success when recipe is created', async () => {
    const mockRecipe = { id: '123', title: 'Test', cookingTimeMinutes: 35 };
    vi.mocked(recipeDAL.createRecipe).mockResolvedValue(mockRecipe as Recipe);

    const input: CreateRecipeInput = {
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

    if (!handlerFn) throw new Error('handlerFn not initialized');
    const result = await handlerFn(null, input);

    expect(result.success).toBe(true);
    expect(result.recipe).toEqual(mockRecipe);
  });

  it('returns errors when validation fails', async () => {
    vi.mocked(recipeDAL.createRecipe).mockRejectedValue(
      new Error('Recipe validation failed:\ntitle: Title is required')
    );

    const invalidInput = { title: '' } as CreateRecipeInput;
    if (!handlerFn) throw new Error('handlerFn not initialized');
    const result = await handlerFn(null, invalidInput);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
  });
});
