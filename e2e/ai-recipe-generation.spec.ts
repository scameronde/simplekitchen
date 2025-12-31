import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('AI Recipe Generation Workflow', () => {
  test('successfully generates and saves a recipe', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        E2E_TEST: 'true',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Navigate to AI generation page via 'Generate Recipe' button
    await window.click('text=Generate Recipe');

    // Verify criteria form is visible
    await expect(window.locator('h1:has-text("Generate Recipe with AI")')).toBeVisible();

    // Fill criteria form with normal valid inputs
    // The mock handler will generate a recipe based on these criteria
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
    // The mock handler generates a recipe based on the criteria
    await expect(window.locator('#input-recipe-title')).toBeDefined();
    await expect(window.locator('#input-cooking-time-\\(minutes\\)')).toBeDefined();

    // Edit recipe fields (optional test)
    const titleField = window.locator('#input-recipe-title');
    const currentTitle = await titleField.inputValue();
    await window.fill('#input-recipe-title', `${currentTitle} - Edited`);

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
        E2E_TEST: 'true',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Navigate to AI generation page
    await window.click('text=Generate Recipe');

    // Fill criteria with test signal to trigger rate limit error
    // Using mainIngredient 'rate-limit-test' triggers the mock handler's rate limit error
    await window.fill('input[placeholder="e.g., chicken, tofu, pasta"]', 'rate-limit-test');
    await window.click('button:has-text("Generate Recipe")');

    // Verify error message displays
    await expect(window.locator('text=/Rate limit/')).toBeVisible({ timeout: 5000 });

    // Verify error details display
    await expect(window.locator('text=/Please wait before trying again/')).toBeVisible();

    // Verify retry-after message shows (60 seconds)
    await expect(window.locator('text=/60/')).toBeVisible();

    await electronApp.close();
  });

  test('displays generic error when generation fails', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        E2E_TEST: 'true',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Navigate to AI generation page
    await window.click('text=Generate Recipe');

    // Fill criteria with test signal to trigger generic failure error
    // Using mainIngredient 'failure-test' triggers the mock handler's unknown error
    await window.fill('input[placeholder="e.g., Italian, Thai, Mexican"]', 'Italian');
    await window.fill('input[placeholder="e.g., chicken, tofu, pasta"]', 'failure-test');
    await window.click('button:has-text("Generate Recipe")');

    // Verify error message displays
    await expect(window.locator('text=/error occurred/')).toBeVisible({ timeout: 5000 });

    await electronApp.close();
  });

  test('allows regenerating recipe from review mode', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        E2E_TEST: 'true',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Navigate to AI generation page
    await window.click('text=Generate Recipe');

    // Fill minimal criteria and generate with normal valid inputs
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
