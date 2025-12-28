import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeForm } from './RecipeForm';

describe('RecipeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.electron.recipeAPI.create as Mock) = vi.fn();
  });

  it('renders all form sections', () => {
    render(<RecipeForm />);
    expect(screen.getByLabelText(/recipe title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cooking time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cookware type/i)).toBeInTheDocument();
    expect(screen.getByText(/dietary tags/i)).toBeInTheDocument();
    expect(screen.getByText(/seasonality/i)).toBeInTheDocument();
    expect(screen.getByText(/ingredients/i)).toBeInTheDocument();
  });

  it('submits valid recipe successfully', async () => {
    const user = userEvent.setup();
    (window.electron.recipeAPI.create as Mock).mockResolvedValue({
      success: true,
      recipe: { id: '123', title: 'Test Recipe' },
    });

    render(<RecipeForm />);

    await user.type(screen.getByLabelText(/recipe title/i), 'Test Pasta');
    await user.type(screen.getByLabelText(/cooking time/i), '35');
    await user.selectOptions(screen.getByLabelText(/cookware type/i), 'one-pot');

    const ingredientInputs = screen.getAllByPlaceholderText(/name/i);
    await user.type(ingredientInputs[0]!, 'pasta');
    await user.type(screen.getByPlaceholderText(/qty/i), '200');
    await user.type(screen.getByPlaceholderText(/unit/i), 'g');

    await user.click(screen.getByText(/save recipe/i));

    await waitFor(() => {
      expect(screen.getByText(/recipe added successfully/i)).toBeInTheDocument();
    });

    expect(window.electron.recipeAPI.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Pasta',
        cookingTimeMinutes: 35,
        cookwareType: 'one-pot',
      })
    );
  });

  it('displays validation errors on failure', async () => {
    const user = userEvent.setup();
    (window.electron.recipeAPI.create as Mock).mockResolvedValue({
      success: false,
      errors: [{ field: 'cookingTimeMinutes', message: 'Must be between 30-45 minutes' }],
    });

    render(<RecipeForm />);

    // Fill in required fields with invalid data
    await user.type(screen.getByLabelText(/recipe title/i), 'Test Recipe');
    await user.type(screen.getByLabelText(/cooking time/i), '60'); // Invalid: exceeds 45 minutes
    await user.selectOptions(screen.getByLabelText(/cookware type/i), 'one-pot');

    // Fill in ingredient (required)
    const ingredientInputs = screen.getAllByPlaceholderText(/name/i);
    await user.type(ingredientInputs[0]!, 'test ingredient');
    await user.type(screen.getByPlaceholderText(/qty/i), '100');
    await user.type(screen.getByPlaceholderText(/unit/i), 'g');

    await user.click(screen.getByText(/save recipe/i));

    await waitFor(() => {
      expect(screen.getByText(/please fix the following/i)).toBeInTheDocument();
      expect(screen.getByText(/must be between 30-45 minutes/i)).toBeInTheDocument();
    });
  });

  it('adds and removes ingredients dynamically', async () => {
    const user = userEvent.setup();
    render(<RecipeForm />);

    expect(screen.getAllByPlaceholderText(/name/i)).toHaveLength(1);

    await user.click(screen.getByText(/add ingredient/i));
    expect(screen.getAllByPlaceholderText(/name/i)).toHaveLength(2);

    const removeButtons = screen.getAllByTitle(/remove ingredient/i);
    await user.click(removeButtons[0]!);
    expect(screen.getAllByPlaceholderText(/name/i)).toHaveLength(1);
  });

  it('toggles dietary tags', async () => {
    const user = userEvent.setup();
    render(<RecipeForm />);

    const veganCheckbox = screen.getByLabelText(/vegan/i);
    expect(veganCheckbox).not.toBeChecked();

    await user.click(veganCheckbox);
    expect(veganCheckbox).toBeChecked();

    await user.click(veganCheckbox);
    expect(veganCheckbox).not.toBeChecked();
  });
});
