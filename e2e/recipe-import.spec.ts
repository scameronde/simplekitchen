import { test, expect } from '@playwright/test';
import { _electron as electron, Page } from 'playwright';
import type { ElectronAPI } from '../src/shared/types/electron';

// Type definition for window with Electron API in evaluate context
interface ElectronWindow extends Window {
  electron: ElectronAPI;
}

test.describe('Recipe Import Workflow', () => {
  test('successfully imports and saves a recipe', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Mock the importRecipe API to return a valid recipe
    await window.evaluate(() => {
      (window as unknown as ElectronWindow).electron.recipeAPI.importRecipe = async () => {
        return {
          success: true,
          recipe: {
            title: 'Imported Pasta Primavera',
            cookingTimeMinutes: 25,
            prepTimeMinutes: 10,
            cookwareType: 'one-pot' as const,
            servings: 2,
            dietaryTags: ['vegetarian' as const],
            seasonality: ['any' as const],
            sourceType: 'web-imported' as const,
            sourceReference: 'https://example.com/recipe/pasta',
            instructions: 'Cook pasta, add vegetables, toss with olive oil.',
            ingredients: [
              {
                name: 'pasta',
                quantity: 200,
                unit: 'g',
                dietaryProperties: ['none' as const],
                optional: false,
                orderIndex: 1,
              },
              {
                name: 'tomatoes',
                quantity: 300,
                unit: 'g',
                dietaryProperties: ['none' as const],
                optional: false,
                orderIndex: 2,
              },
              {
                name: 'olive oil',
                quantity: 2,
                unit: 'tbsp',
                dietaryProperties: ['none' as const],
                optional: false,
                orderIndex: 3,
              },
            ],
          },
        };
      };
    });

    // Navigate to Import Recipe page
    await window.click('text=Import Recipe');

    // Verify import page loads
    await expect(window.locator('h1:has-text("Import Recipe from Web")')).toBeVisible();

    // Enter URL
    const urlInput = window.locator('input[placeholder="https://www.example.com/recipe/..."]');
    await urlInput.fill('https://example.com/recipe/pasta');

    // Click Import Recipe button
    await window.click('button:has-text("Import Recipe")');

    // Verify review page appears
    await expect(window.locator('h1:has-text("Review Imported Recipe")')).toBeVisible({
      timeout: 5000,
    });

    // Verify recipe data is populated
    await expect(window.locator('#input-recipe-title')).toHaveValue('Imported Pasta Primavera');
    await expect(window.locator('#input-cooking-time-\\(minutes\\)')).toHaveValue('25');

    // Verify ingredients are populated
    await expect(window.locator('text=pasta').first()).toBeVisible();

    // Click Save Recipe
    await window.click('button:has-text("Save Recipe")');

    // Verify success message
    await expect(window.locator('text=Recipe saved successfully!')).toBeVisible({ timeout: 5000 });

    // Navigate to View Recipes to verify recipe appears in collection
    await window.click('text=View Recipes');

    // Verify recipe appears in list (use .first() in case there are multiple recipes)
    await expect(window.locator('text=Imported Pasta Primavera').first()).toBeVisible({
      timeout: 5000,
    });

    await electronApp.close();
  });

  test('displays error message for invalid URL import', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Mock importRecipe to return error
    await window.evaluate(() => {
      (window as unknown as ElectronWindow).electron.recipeAPI.importRecipe = async () => {
        return {
          success: false,
          errors: [
            {
              field: 'url',
              message: 'Invalid recipe URL or unsupported website format',
            },
          ],
        };
      };
    });

    // Navigate to Import Recipe page
    await window.click('text=Import Recipe');

    // Verify import page loads
    await expect(window.locator('h1:has-text("Import Recipe from Web")')).toBeVisible();

    // Enter invalid URL
    const urlInput = window.locator('input[placeholder="https://www.example.com/recipe/..."]');
    await urlInput.fill('https://invalid-url-format.xyz');

    // Click Import Recipe button
    await window.click('button:has-text("Import Recipe")');

    // Verify error message displays
    await expect(
      window.locator('text=Invalid recipe URL or unsupported website format')
    ).toBeVisible({ timeout: 5000 });

    await electronApp.close();
  });

  test('handles validation errors when saving imported recipe with violations', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Mock importRecipe to return recipe that will violate constraints
    await window.evaluate(() => {
      (window as unknown as ElectronWindow).electron.recipeAPI.importRecipe = async () => {
        return {
          success: true,
          recipe: {
            title: 'Rich Cream Pasta',
            cookingTimeMinutes: 50, // Exceeds 45-minute limit
            prepTimeMinutes: 15,
            cookwareType: 'one-pot' as const,
            servings: 2,
            dietaryTags: [],
            seasonality: ['any' as const],
            sourceType: 'web-imported' as const,
            sourceReference: 'https://example.com/recipe/cream-pasta',
            instructions: 'Cook pasta in cream sauce.',
            ingredients: [
              {
                name: 'pasta',
                quantity: 200,
                unit: 'g',
                dietaryProperties: ['none' as const],
                optional: false,
                orderIndex: 1,
              },
              {
                name: 'heavy cream',
                quantity: 200,
                unit: 'ml',
                dietaryProperties: ['contains-lactose' as const],
                optional: false,
                orderIndex: 2,
              },
              {
                name: 'butter',
                quantity: 100,
                unit: 'g',
                dietaryProperties: ['contains-lactose' as const],
                optional: false,
                orderIndex: 3,
              },
            ],
          },
        };
      };
    });

    // Navigate to Import Recipe page
    await window.click('text=Import Recipe');

    // Verify import page loads
    await expect(window.locator('h1:has-text("Import Recipe from Web")')).toBeVisible();

    // Enter URL
    const urlInput = window.locator('input[placeholder="https://www.example.com/recipe/..."]');
    await urlInput.fill('https://example.com/recipe/cream-pasta');

    // Click Import Recipe button
    await window.click('button:has-text("Import Recipe")');

    // Wait for review page
    await expect(window.locator('h1:has-text("Review Imported Recipe")')).toBeVisible({
      timeout: 5000,
    });

    // Try to save without fixing violations
    await window.click('button:has-text("Save Recipe")');

    // Verify validation errors appear
    await expect(window.locator('text=/Please fix the following/')).toBeVisible({ timeout: 5000 });

    // Fix the cooking time violation
    await window.fill('#input-cooking-time-\\(minutes\\)', '35');

    // Remove problematic ingredients (cream and butter) and replace with safe ones
    // Click on first ingredient name field and change it to 'olive oil'
    const ingredientNameInputs = window.locator('input[placeholder="Name"]');
    const ingredientCount = await ingredientNameInputs.count();

    // Keep pasta (already correct), change cream to olive oil, change butter to parmesan
    if (ingredientCount > 1) {
      // Change second ingredient (cream) to olive oil
      await ingredientNameInputs.nth(1).fill('olive oil');
    }

    if (ingredientCount > 2) {
      // Change third ingredient (butter) to garlic
      await ingredientNameInputs.nth(2).fill('garlic');
    }

    // Now try to save again
    await window.click('button:has-text("Save Recipe")');

    // Verify success message appears
    await expect(window.locator('text=Recipe saved successfully!')).toBeVisible({ timeout: 5000 });

    await electronApp.close();
  });

  test('cancels import and returns to import mode', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Mock importRecipe
    await window.evaluate(() => {
      (window as unknown as ElectronWindow).electron.recipeAPI.importRecipe = async () => {
        return {
          success: true,
          recipe: {
            title: 'Test Recipe',
            cookingTimeMinutes: 30,
            prepTimeMinutes: 10,
            cookwareType: 'one-pan' as const,
            servings: 2,
            dietaryTags: ['vegetarian' as const],
            seasonality: ['any' as const],
            sourceType: 'web-imported' as const,
            sourceReference: 'https://example.com/recipe/test',
            instructions: 'Test instructions.',
            ingredients: [
              {
                name: 'rice',
                quantity: 200,
                unit: 'g',
                dietaryProperties: ['none' as const],
                optional: false,
                orderIndex: 1,
              },
            ],
          },
        };
      };
    });

    // Navigate to Import Recipe page
    await window.click('text=Import Recipe');

    // Verify import page loads
    await expect(window.locator('h1:has-text("Import Recipe from Web")')).toBeVisible();

    // Enter URL and import
    const urlInput = window.locator('input[placeholder="https://www.example.com/recipe/..."]');
    await urlInput.fill('https://example.com/recipe/test');
    await window.click('button:has-text("Import Recipe")');

    // Wait for review page
    await expect(window.locator('h1:has-text("Review Imported Recipe")')).toBeVisible({
      timeout: 5000,
    });

    // Click Cancel button
    await window.click('button:has-text("Cancel")');

    // Verify back on import page
    await expect(window.locator('h1:has-text("Import Recipe from Web")')).toBeVisible();

    // Verify URL field is cleared
    await expect(
      window.locator('input[placeholder="https://www.example.com/recipe/..."]')
    ).toHaveValue('');

    await electronApp.close();
  });

  test('edits imported recipe data before saving', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Mock importRecipe
    await window.evaluate(() => {
      (window as unknown as ElectronWindow).electron.recipeAPI.importRecipe = async () => {
        return {
          success: true,
          recipe: {
            title: 'Original Recipe Title',
            cookingTimeMinutes: 30,
            prepTimeMinutes: 10,
            cookwareType: 'one-pot' as const,
            servings: 2,
            dietaryTags: [],
            seasonality: ['any' as const],
            sourceType: 'web-imported' as const,
            sourceReference: 'https://example.com/recipe/original',
            instructions: 'Original instructions.',
            ingredients: [
              {
                name: 'rice',
                quantity: 200,
                unit: 'g',
                dietaryProperties: ['none' as const],
                optional: false,
                orderIndex: 1,
              },
            ],
          },
        };
      };
    });

    // Navigate to Import Recipe page
    await window.click('text=Import Recipe');

    // Verify import page loads
    await expect(window.locator('h1:has-text("Import Recipe from Web")')).toBeVisible();

    // Enter URL and import
    const urlInput = window.locator('input[placeholder="https://www.example.com/recipe/..."]');
    await urlInput.fill('https://example.com/recipe/original');
    await window.click('button:has-text("Import Recipe")');

    // Wait for review page
    await expect(window.locator('h1:has-text("Review Imported Recipe")')).toBeVisible({
      timeout: 5000,
    });

    // Verify original data
    await expect(window.locator('#input-recipe-title')).toHaveValue('Original Recipe Title');

    // Edit the title
    await window.fill('#input-recipe-title', 'Modified Recipe Title');

    // Edit cooking time
    await window.fill('#input-cooking-time-\\(minutes\\)', '40');

    // Save the edited recipe
    await window.click('button:has-text("Save Recipe")');

    // Verify success message
    await expect(window.locator('text=Recipe saved successfully!')).toBeVisible({ timeout: 5000 });

    // Navigate to View Recipes to verify edited recipe appears with new title
    await window.click('text=View Recipes');

    // Verify edited recipe appears with new title
    await expect(window.locator('text=Modified Recipe Title').first()).toBeVisible({
      timeout: 5000,
    });

    await electronApp.close();
  });
});
