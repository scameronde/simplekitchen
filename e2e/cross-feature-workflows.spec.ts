import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('Cross-Feature Workflows', () => {
  test('AI generate → edit → save workflow', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        E2E_TEST: 'true',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Step 1: Navigate to AI generation page
    await window.click('text=Generate Recipe');

    // Verify we're on the AI generation page
    await expect(window.locator('h1:has-text("Generate Recipe with AI")')).toBeVisible();

    // Step 2: Generate a recipe with AI
    // Fill minimal criteria to trigger AI generation (mock handler will respond)
    await window.fill('input[placeholder="e.g., chicken, tofu, pasta"]', 'pasta');
    await window.fill('input[placeholder="e.g., Italian, Thai, Mexican"]', 'Italian');

    // Click Generate Recipe button (submit button)
    await window.click('button[type="submit"]:has-text("Generate Recipe")');

    // Step 3: Review generated recipe - wait for review mode
    await expect(window.locator('h1:has-text("Review Generated Recipe")')).toBeVisible({
      timeout: 5000,
    });

    // Verify generated recipe data is displayed
    const titleField = window.locator('#input-recipe-title');
    await expect(titleField).toBeVisible();
    const generatedTitle = await titleField.inputValue();
    expect(generatedTitle).toBeTruthy(); // Should have a generated title

    // Step 4: Edit the recipe - change cooking time from default to 40 minutes
    const cookingTimeField = window.locator('#input-cooking-time-\\(minutes\\)');
    await expect(cookingTimeField).toBeVisible();

    // Get the original cooking time to verify it changes
    const originalCookingTime = await cookingTimeField.inputValue();

    // Change cooking time to 40 minutes
    await cookingTimeField.fill('40');
    await expect(cookingTimeField).toHaveValue('40');

    // Step 5: Add a new ingredient - click Add Ingredient button
    await window.click('button:has-text("Add Ingredient")');

    // Wait for the new ingredient row to appear
    // The mock AI handler generates recipes with ingredients, so we need to find the last ingredient row
    // Get all ingredient name inputs and target the last one
    const ingredientNameInputs = window.locator('input[placeholder="Name"]');
    const ingredientCount = await ingredientNameInputs.count();
    const lastIngredientIndex = ingredientCount - 1;

    // Fill the new ingredient (last row)
    const lastIngredientName = ingredientNameInputs.nth(lastIngredientIndex);
    const lastIngredientQty = window.locator('input[placeholder="Qty"]').nth(lastIngredientIndex);
    const lastIngredientUnit = window.locator('input[placeholder="Unit"]').nth(lastIngredientIndex);

    await lastIngredientName.fill('parmesan cheese');
    await lastIngredientQty.fill('50');
    await lastIngredientUnit.fill('g');

    // Verify the ingredient was added
    await expect(lastIngredientName).toHaveValue('parmesan cheese');
    await expect(lastIngredientQty).toHaveValue('50');
    await expect(lastIngredientUnit).toHaveValue('g');

    // Step 6: Save the edited recipe
    await window.click('button:has-text("Save Recipe")');

    // Verify success message appears
    await expect(window.locator('text=Recipe saved successfully!')).toBeVisible({ timeout: 5000 });

    // Wait for auto-redirect back to criteria mode (2 second delay in component)
    await window.waitForTimeout(2500);

    // Step 7: Navigate to recipe list to verify recipe was saved
    await window.click('text=View Recipes');

    // Verify we're on the recipe list page
    await expect(window.locator('h1:has-text("My Recipes")')).toBeVisible();

    // Step 8: Verify recipe appears in list with the generated title
    // Use .first() since there may be multiple recipes from previous tests
    await expect(window.locator(`text=${generatedTitle}`).first()).toBeVisible({ timeout: 5000 });

    // Step 9: Open recipe detail page by clicking on the recipe
    await window.locator(`text=${generatedTitle}`).first().click();

    // Verify detail page loads with correct title
    await expect(window.locator(`h1:has-text("${generatedTitle}")`)).toBeVisible();

    // Step 10: Verify all edits persisted correctly
    // Check that cooking time is 40 minutes
    await expect(window.locator('text=40 minutes')).toBeVisible();

    // Check that the new ingredient (parmesan cheese) is present
    await expect(window.locator('text=parmesan cheese')).toBeVisible();
    await expect(window.locator('text=50 g')).toBeVisible();

    // Note: When editing an AI-generated recipe, the sourceType changes to 'manual'
    // and sourceReference is not preserved. This is current expected behavior.
    // The recipe is successfully edited and saved with all modifications.

    await electronApp.close();
  });

  test('AI generate → regenerate → edit → save workflow', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        E2E_TEST: 'true',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Navigate to AI generation page
    await window.click('text=Generate Recipe');

    // Generate initial recipe
    await window.fill('input[placeholder="e.g., chicken, tofu, pasta"]', 'vegetables');
    await window.click('button[type="submit"]:has-text("Generate Recipe")');

    // Wait for review mode
    await expect(window.locator('h1:has-text("Review Generated Recipe")')).toBeVisible({
      timeout: 5000,
    });

    // Click Regenerate to go back to criteria mode
    await window.click('button:has-text("Regenerate")');

    // Verify back to criteria mode
    await expect(window.locator('h1:has-text("Generate Recipe with AI")')).toBeVisible();

    // Generate a new recipe with different criteria
    await window.fill('input[placeholder="e.g., chicken, tofu, pasta"]', 'chicken');
    await window.fill('input[placeholder="e.g., Italian, Thai, Mexican"]', 'Thai');
    await window.click('button[type="submit"]:has-text("Generate Recipe")');

    // Wait for review mode again
    await expect(window.locator('h1:has-text("Review Generated Recipe")')).toBeVisible({
      timeout: 5000,
    });

    // Get the new generated title
    const titleField = window.locator('#input-recipe-title');
    const newTitle = await titleField.inputValue();

    // Edit cooking time
    await window.locator('#input-cooking-time-\\(minutes\\)').fill('45');

    // Save recipe
    await window.click('button:has-text("Save Recipe")');

    // Verify success
    await expect(window.locator('text=Recipe saved successfully!')).toBeVisible({ timeout: 5000 });

    // Wait for redirect
    await window.waitForTimeout(2500);

    // Navigate to list and verify the recipe
    await window.click('text=View Recipes');
    await expect(window.locator(`text=${newTitle}`).first()).toBeVisible({ timeout: 5000 });

    // Open detail and verify cooking time
    await window.locator(`text=${newTitle}`).first().click();
    await expect(window.locator('text=45 minutes')).toBeVisible();

    await electronApp.close();
  });
});
