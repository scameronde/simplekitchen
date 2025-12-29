import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('AI Recipe Generation Workflow', () => {
  test('successfully generates and saves a recipe', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Mock the generateRecipe API to avoid real API calls
    await window.evaluate(() => {
      (window as any).electron.recipeAPI.generateRecipe = async () => {
        return {
          success: true,
          recipe: {
            title: 'AI Generated Thai Basil Chicken',
            cookingTimeMinutes: 25,
            prepTimeMinutes: 10,
            cookwareType: 'one-pan',
            servings: 2,
            dietaryTags: ['gluten-free', 'dairy-free'],
            seasonality: ['any'],
            sourceType: 'ai-generated',
            ingredients: [
              {
                name: 'chicken breast',
                quantity: 300,
                unit: 'g',
                optional: false,
              },
              {
                name: 'thai basil',
                quantity: 1,
                unit: 'cup',
                optional: false,
              },
              {
                name: 'soy sauce',
                quantity: 2,
                unit: 'tbsp',
                optional: false,
              },
            ],
            instructions: 'Stir-fry chicken, add basil and sauce, serve hot.',
          },
        };
      };
    });

    // Navigate to AI generation page via 'Generate Recipe' button
    await window.click('text=Generate Recipe');

    // Verify criteria form is visible
    await expect(window.locator('h1:has-text("Generate Recipe with AI")')).toBeVisible();

    // Fill criteria form
    await window.fill('input[placeholder="e.g., Italian, Thai, Mexican"]', 'Thai');
    await window.fill('input[placeholder="e.g., chicken, tofu, pasta"]', 'chicken');

    // Select dietary tags
    await window.click('text=Gluten Free');
    await window.click('text=Dairy Free');

    // Select seasonality - check "any"
    await window.click('text=Any Season');

    // Select cookware type
    await window.check('input[type="radio"][value="one-pan"]');

    // Fill flavor profile
    await window.fill('input[placeholder="e.g., spicy, savory, comfort food"]', 'savory');

    // Select skill level
    await window.selectOption('select', 'beginner');

    // Click Generate Recipe button
    await window.click('button:has-text("Generate Recipe")');

    // Verify loading state briefly appears (may be too fast to catch in test)

    // Verify review mode appears
    await expect(window.locator('h1:has-text("Review Generated Recipe")')).toBeVisible({
      timeout: 5000,
    });

    // Verify generated recipe data is displayed
    await expect(window.locator('#input-recipe-title')).toHaveValue(
      'AI Generated Thai Basil Chicken'
    );
    await expect(window.locator('#input-cooking-time-\\(minutes\\)')).toHaveValue('25');

    // Edit recipe fields (optional test)
    await window.fill('#input-recipe-title', 'My Thai Basil Chicken');

    // Save recipe
    await window.click('button:has-text("Save Recipe")');

    // Verify success message appears
    await expect(window.locator('text=Recipe saved successfully!')).toBeVisible({ timeout: 5000 });

    await electronApp.close();
  });

  test('displays error when rate limited', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Mock rate limit error
    await window.evaluate(() => {
      (window as any).electron.recipeAPI.generateRecipe = async () => {
        return {
          success: false,
          error: {
            type: 'rate-limit',
            message: 'Rate limit exceeded',
            details: 'You have exceeded your API quota',
            retryAfter: 60,
          },
        };
      };
    });

    // Navigate to AI generation page
    await window.click('text=Generate Recipe');

    // Fill minimal criteria and generate
    await window.fill('input[placeholder="e.g., chicken, tofu, pasta"]', 'pasta');
    await window.click('button:has-text("Generate Recipe")');

    // Verify error message displays
    await expect(window.locator('text=Rate limit exceeded')).toBeVisible({ timeout: 5000 });

    // Verify error details display
    await expect(window.locator('text=You have exceeded your API quota')).toBeVisible();

    // Verify retry-after message shows
    await expect(window.locator('text=/Please retry after.*60.*seconds/')).toBeVisible();

    await electronApp.close();
  });

  test('displays generic error when generation fails', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Mock network error
    await window.evaluate(() => {
      (window as any).electron.recipeAPI.generateRecipe = async () => {
        return {
          success: false,
          error: {
            type: 'network',
            message: 'Network connection failed',
            details: 'Could not reach the API server',
          },
        };
      };
    });

    // Navigate to AI generation page
    await window.click('text=Generate Recipe');

    // Fill criteria and generate
    await window.fill('input[placeholder="e.g., Italian, Thai, Mexican"]', 'Italian');
    await window.click('button:has-text("Generate Recipe")');

    // Verify error message displays
    await expect(window.locator('text=Network connection failed')).toBeVisible({ timeout: 5000 });
    await expect(window.locator('text=Could not reach the API server')).toBeVisible();

    await electronApp.close();
  });

  test('allows regenerating recipe from review mode', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Mock successful generation
    await window.evaluate(() => {
      (window as any).electron.recipeAPI.generateRecipe = async () => {
        return {
          success: true,
          recipe: {
            title: 'Generated Recipe',
            cookingTimeMinutes: 30,
            prepTimeMinutes: 15,
            cookwareType: 'one-pot',
            servings: 2,
            dietaryTags: ['vegetarian'],
            seasonality: ['any'],
            sourceType: 'ai-generated',
            ingredients: [
              {
                name: 'vegetables',
                quantity: 200,
                unit: 'g',
                optional: false,
              },
            ],
            instructions: 'Cook vegetables.',
          },
        };
      };
    });

    // Navigate to AI generation page
    await window.click('text=Generate Recipe');

    // Fill minimal criteria and generate
    await window.fill('input[placeholder="e.g., chicken, tofu, pasta"]', 'vegetables');
    await window.click('button:has-text("Generate Recipe")');

    // Wait for review mode
    await expect(window.locator('h1:has-text("Review Generated Recipe")')).toBeVisible({
      timeout: 5000,
    });

    // Click Regenerate button
    await window.click('button:has-text("Regenerate")');

    // Verify back to criteria mode
    await expect(window.locator('h1:has-text("Generate Recipe with AI")')).toBeVisible();

    // Verify criteria form is empty or resetted
    await expect(window.locator('button:has-text("Generate Recipe")')).toBeVisible();

    await electronApp.close();
  });
});
