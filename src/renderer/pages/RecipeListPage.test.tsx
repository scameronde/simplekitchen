import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeListPage } from './RecipeListPage';
import type { Recipe } from '../../shared/types/recipe';

const mockRecipes: Recipe[] = [
  {
    id: '1',
    title: 'Test Recipe 1',
    cookingTimeMinutes: 30,
    prepTimeMinutes: 10,
    totalTimeMinutes: 40,
    cookwareType: 'one-pan',
    servings: 2,
    dietaryTags: ['gluten-free'],
    seasonality: ['any'],
    sourceType: 'manual',
    sourceReference: null,
    instructions: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ingredients: [],
  },
  {
    id: '2',
    title: 'Test Recipe 2',
    cookingTimeMinutes: 40,
    prepTimeMinutes: 15,
    totalTimeMinutes: 55,
    cookwareType: 'oven',
    servings: 2,
    dietaryTags: ['lactose-free'],
    seasonality: ['summer'],
    sourceType: 'manual',
    sourceReference: null,
    instructions: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ingredients: [],
  },
];

describe('RecipeListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.electron.recipeAPI
    window.electron = {
      platform: 'test',
      versions: { node: '', chrome: '', electron: '' },
      recipeAPI: {
        create: vi.fn(),
        getAll: vi.fn().mockResolvedValue({ success: true, recipe: mockRecipes }),
        getById: vi.fn(),
        filter: vi.fn().mockResolvedValue({ success: true, recipe: mockRecipes }),
        generateRecipe: vi.fn(),
        importRecipe: vi.fn(),
      },
      conversationAPI: {
        startSession: vi.fn(),
        sendMessage: vi.fn(),
        getSuggestions: vi.fn(),
        rejectRecipe: vi.fn(),
        refine: vi.fn(),
        abandonSession: vi.fn(),
      },
    };
  });

  it('loads and displays recipes on mount', async () => {
    const onRecipeClick = vi.fn();
    render(<RecipeListPage onRecipeClick={onRecipeClick} />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      expect(screen.getByText('Test Recipe 2')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', async () => {
    const onRecipeClick = vi.fn();
    render(<RecipeListPage onRecipeClick={onRecipeClick} />);

    expect(screen.getByText('Loading recipes...')).toBeInTheDocument();

    // Wait for the loading state to resolve
    await waitFor(() => {
      expect(screen.queryByText('Loading recipes...')).not.toBeInTheDocument();
    });
  });

  it('displays error state on failure', async () => {
    window.electron.recipeAPI.getAll = vi.fn().mockResolvedValue({
      success: false,
      errors: [{ field: 'database', message: 'Database error' }],
    });

    const onRecipeClick = vi.fn();
    render(<RecipeListPage onRecipeClick={onRecipeClick} />);

    await waitFor(() => {
      expect(screen.getByText('Database error')).toBeInTheDocument();
    });
  });

  it('calls onRecipeClick when recipe card is clicked', async () => {
    const onRecipeClick = vi.fn();
    const user = userEvent.setup();
    render(<RecipeListPage onRecipeClick={onRecipeClick} />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Test Recipe 1'));
    expect(onRecipeClick).toHaveBeenCalledWith('1');
  });

  it('applies filters when Apply Filters is clicked', async () => {
    const onRecipeClick = vi.fn();
    const user = userEvent.setup();
    render(<RecipeListPage onRecipeClick={onRecipeClick} />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    // Click Apply Filters button
    const applyButton = screen.getByText('Apply Filters');
    await user.click(applyButton);

    await waitFor(() => {
      expect(window.electron.recipeAPI.filter).toHaveBeenCalled();
    });
  });
});
