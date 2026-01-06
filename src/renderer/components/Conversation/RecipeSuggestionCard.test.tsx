import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeSuggestionCard } from './RecipeSuggestionCard';
import type { Recipe } from '../../../shared/types/recipe';

describe('RecipeSuggestionCard', () => {
  // Mock recipe data with all required Recipe type fields
  const mockRecipe: Recipe = {
    id: 'recipe-123',
    title: 'Quick Vegetable Stir-Fry',
    cookingTimeMinutes: 20,
    prepTimeMinutes: 10,
    totalTimeMinutes: 30,
    cookwareType: 'one-pan',
    servings: 2,
    dietaryTags: ['vegetarian', 'vegan'],
    seasonality: ['spring', 'summer'],
    sourceType: 'ai-generated',
    sourceReference: null,
    instructions: 'Stir-fry vegetables until tender.',
    ingredients: [
      {
        id: 'ing-1',
        recipeId: 'recipe-123',
        name: 'bell peppers',
        quantity: 2,
        unit: 'whole',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 0,
      },
      {
        id: 'ing-2',
        recipeId: 'recipe-123',
        name: 'broccoli',
        quantity: 200,
        unit: 'g',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 1,
      },
      {
        id: 'ing-3',
        recipeId: 'recipe-123',
        name: 'soy sauce',
        quantity: 2,
        unit: 'tbsp',
        dietaryProperties: ['contains-gluten'],
        optional: false,
        orderIndex: 2,
      },
      {
        id: 'ing-4',
        recipeId: 'recipe-123',
        name: 'garlic',
        quantity: 3,
        unit: 'cloves',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 3,
      },
      {
        id: 'ing-5',
        recipeId: 'recipe-123',
        name: 'ginger',
        quantity: 1,
        unit: 'tbsp',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 4,
      },
      {
        id: 'ing-6',
        recipeId: 'recipe-123',
        name: 'sesame oil',
        quantity: 1,
        unit: 'tsp',
        dietaryProperties: ['none'],
        optional: true,
        orderIndex: 5,
      },
    ],
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
  };

  const mockReasoning =
    'This recipe is perfect for your low energy level and available time. It requires minimal prep and uses one pan for easy cleanup.';

  const mockMatchedFactors = ['quick', 'low-energy', 'one-pan'];

  const mockOnSelect = vi.fn();
  const mockOnReject = vi.fn();

  it('renders recipe title, time, cookware, and ingredients', () => {
    render(
      <RecipeSuggestionCard
        recipe={mockRecipe}
        reasoning={mockReasoning}
        matchedFactors={mockMatchedFactors}
        onSelect={mockOnSelect}
        onReject={mockOnReject}
      />
    );

    // Check title
    expect(screen.getByText('Quick Vegetable Stir-Fry')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Quick Vegetable Stir-Fry');

    // Check time
    expect(screen.getByText(/🕐 30 min/)).toBeInTheDocument();

    // Check cookware
    expect(screen.getByText(/🍳 One Pan/)).toBeInTheDocument();

    // Check ingredients (first 5)
    expect(screen.getByText(/Key ingredients:/)).toBeInTheDocument();
    expect(
      screen.getByText(/bell peppers, broccoli, soy sauce, garlic, ginger\.\.\./)
    ).toBeInTheDocument();
  });

  it('renders reasoning text', () => {
    render(
      <RecipeSuggestionCard
        recipe={mockRecipe}
        reasoning={mockReasoning}
        matchedFactors={mockMatchedFactors}
        onSelect={mockOnSelect}
        onReject={mockOnReject}
      />
    );

    expect(
      screen.getByText(
        'This recipe is perfect for your low energy level and available time. It requires minimal prep and uses one pan for easy cleanup.'
      )
    ).toBeInTheDocument();
  });

  it('renders matched factors as pills', () => {
    render(
      <RecipeSuggestionCard
        recipe={mockRecipe}
        reasoning={mockReasoning}
        matchedFactors={mockMatchedFactors}
        onSelect={mockOnSelect}
        onReject={mockOnReject}
      />
    );

    expect(screen.getByText(/Matched factors:/)).toBeInTheDocument();
    expect(screen.getByText('quick')).toBeInTheDocument();
    expect(screen.getByText('low-energy')).toBeInTheDocument();
    expect(screen.getByText('one-pan')).toBeInTheDocument();
  });

  it('calls onSelect when Select button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RecipeSuggestionCard
        recipe={mockRecipe}
        reasoning={mockReasoning}
        matchedFactors={mockMatchedFactors}
        onSelect={mockOnSelect}
        onReject={mockOnReject}
      />
    );

    const selectButton = screen.getByText('Select this recipe');
    await user.click(selectButton);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('calls onReject when Not this one button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RecipeSuggestionCard
        recipe={mockRecipe}
        reasoning={mockReasoning}
        matchedFactors={mockMatchedFactors}
        onSelect={mockOnSelect}
        onReject={mockOnReject}
      />
    );

    const rejectButton = screen.getByText('Not this one');
    await user.click(rejectButton);

    expect(mockOnReject).toHaveBeenCalledTimes(1);
  });

  it('has proper ARIA labels for accessibility', () => {
    render(
      <RecipeSuggestionCard
        recipe={mockRecipe}
        reasoning={mockReasoning}
        matchedFactors={mockMatchedFactors}
        onSelect={mockOnSelect}
        onReject={mockOnReject}
      />
    );

    // Check card has testid
    expect(screen.getByTestId('recipe-suggestion-card')).toBeInTheDocument();

    // Check reasoning has role="note" and aria-label
    const reasoningNote = screen.getByRole('note', { name: 'AI reasoning for suggestion' });
    expect(reasoningNote).toBeInTheDocument();

    // Check buttons have proper aria-labels
    expect(screen.getByLabelText('Select recipe: Quick Vegetable Stir-Fry')).toBeInTheDocument();
    expect(screen.getByLabelText('Reject recipe: Quick Vegetable Stir-Fry')).toBeInTheDocument();
  });

  it('handles recipe with exactly 5 ingredients without ellipsis', () => {
    const recipeWith5Ingredients: Recipe = {
      ...mockRecipe,
      ingredients: mockRecipe.ingredients.slice(0, 5),
    };

    render(
      <RecipeSuggestionCard
        recipe={recipeWith5Ingredients}
        reasoning={mockReasoning}
        matchedFactors={mockMatchedFactors}
        onSelect={mockOnSelect}
        onReject={mockOnReject}
      />
    );

    // Should NOT have ellipsis when exactly 5 ingredients
    // Text is split across <span> and text nodes, so we check the container
    const ingredientDiv = screen.getByText(/Key ingredients:/).parentElement;
    expect(ingredientDiv?.textContent).toBe(
      'Key ingredients: bell peppers, broccoli, soy sauce, garlic, ginger'
    );
  });

  it('handles recipe with less than 5 ingredients', () => {
    const recipeWith3Ingredients: Recipe = {
      ...mockRecipe,
      ingredients: mockRecipe.ingredients.slice(0, 3),
    };

    render(
      <RecipeSuggestionCard
        recipe={recipeWith3Ingredients}
        reasoning={mockReasoning}
        matchedFactors={mockMatchedFactors}
        onSelect={mockOnSelect}
        onReject={mockOnReject}
      />
    );

    // Text is split across <span> and text nodes, so we check the container
    const ingredientDiv = screen.getByText(/Key ingredients:/).parentElement;
    expect(ingredientDiv?.textContent).toBe('Key ingredients: bell peppers, broccoli, soy sauce');
  });

  it('renders different cookware types with correct emojis', () => {
    const { rerender } = render(
      <RecipeSuggestionCard
        recipe={{ ...mockRecipe, cookwareType: 'one-pot' }}
        reasoning={mockReasoning}
        matchedFactors={mockMatchedFactors}
        onSelect={mockOnSelect}
        onReject={mockOnReject}
      />
    );

    expect(screen.getByText(/🍲 One Pot/)).toBeInTheDocument();

    rerender(
      <RecipeSuggestionCard
        recipe={{ ...mockRecipe, cookwareType: 'oven' }}
        reasoning={mockReasoning}
        matchedFactors={mockMatchedFactors}
        onSelect={mockOnSelect}
        onReject={mockOnReject}
      />
    );

    expect(screen.getByText(/🔥 Oven/)).toBeInTheDocument();
  });

  it('does not render matched factors section when empty', () => {
    render(
      <RecipeSuggestionCard
        recipe={mockRecipe}
        reasoning={mockReasoning}
        matchedFactors={[]}
        onSelect={mockOnSelect}
        onReject={mockOnReject}
      />
    );

    expect(screen.queryByText(/Matched factors:/)).not.toBeInTheDocument();
  });

  it('handles recipe with no ingredients gracefully', () => {
    const recipeWithNoIngredients: Recipe = {
      ...mockRecipe,
      ingredients: [],
    };

    render(
      <RecipeSuggestionCard
        recipe={recipeWithNoIngredients}
        reasoning={mockReasoning}
        matchedFactors={mockMatchedFactors}
        onSelect={mockOnSelect}
        onReject={mockOnReject}
      />
    );

    // Should not render ingredients section when none present
    expect(screen.queryByText(/Key ingredients:/)).not.toBeInTheDocument();
  });
});
