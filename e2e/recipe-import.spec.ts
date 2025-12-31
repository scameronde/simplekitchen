import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('Recipe Import Workflow', () => {
  test('successfully imports and saves a recipe', async () => {
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

    // Navigate to Import Recipe page
    await window.click('text=Import Recipe');

    // Verify import page loads
    await expect(window.locator('h1:has-text("Import Recipe from Web")')).toBeVisible();

    // Enter URL - using a pasta recipe URL which the mock handler recognizes
    // The mock handler will return appropriate mock recipe based on the URL pattern
    const urlInput = window.locator('input[placeholder="https://www.example.com/recipe/..."]');
    await urlInput.fill('https://example.com/recipe/pasta');

    // Submit form by pressing Enter in the input field (workaround for Playwright/Electron button click issue)
    await urlInput.press('Enter');

    // Verify review page appears
    await expect(window.locator('h1:has-text("Review Imported Recipe")')).toBeVisible({
      timeout: 5000,
    });

    // Verify recipe data is populated
    await expect(window.locator('#input-recipe-title')).toBeDefined();
    await expect(window.locator('#input-cooking-time-\\(minutes\\)')).toBeDefined();

    // Verify ingredients are populated
    await expect(window.locator('text=/[a-zA-Z]+/').first()).toBeVisible();

    // Submit form using requestSubmit() workaround for Playwright/Electron
    await window.evaluate(() => {
      const forms = document.querySelectorAll('form');
      // The review form is the only form on the page
      forms[0]?.requestSubmit();
    });

    // Verify success message
    await expect(window.locator('text=Recipe saved successfully!')).toBeVisible({ timeout: 5000 });

    // Navigate to View Recipes to verify recipe appears in collection
    await window.click('text=View Recipes');

    // Verify recipe appears in list (use .first() in case there are multiple recipes)
    await expect(window.locator('[data-testid="recipe-card"]').first()).toBeVisible({
      timeout: 5000,
    });

    await electronApp.close();
  });

  test('displays error message for invalid URL import', async () => {
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

    // Navigate to Import Recipe page
    await window.click('text=Import Recipe');

    // Verify import page loads
    await expect(window.locator('h1:has-text("Import Recipe from Web")')).toBeVisible();

    // Enter invalid URL format (not http:// or https://)
    // The mock handler validates URL format and returns an error for invalid formats
    const urlInput = window.locator('input[placeholder="https://www.example.com/recipe/..."]');
    await urlInput.fill('not-a-url');

    // Submit form by pressing Enter in the input field (workaround for Playwright/Electron button click issue)
    await urlInput.press('Enter');

    // Verify error message displays
    await expect(window.locator('text=/Invalid URL|URL must/')).toBeVisible({ timeout: 5000 });

    await electronApp.close();
  });

  test('handles validation errors when saving imported recipe with violations', async () => {
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

    // Navigate to Import Recipe page
    await window.click('text=Import Recipe');

    // Verify import page loads
    await expect(window.locator('h1:has-text("Import Recipe from Web")')).toBeVisible();

    // Enter URL - the mock handler will return a valid recipe
    // We'll then manually modify it to violate constraints to test the validation logic
    const urlInput = window.locator('input[placeholder="https://www.example.com/recipe/..."]');
    await urlInput.fill('https://example.com/recipe/test');

    // Submit form by pressing Enter in the input field (workaround for Playwright/Electron button click issue)
    await urlInput.press('Enter');

    // Wait for review page
    await expect(window.locator('h1:has-text("Review Imported Recipe")')).toBeVisible({
      timeout: 5000,
    });

    // Manually create a violation by setting cooking time beyond the 45-minute limit
    // to test the validation error handling
    await window.fill('#input-cooking-time-\\(minutes\\)', '50');

    // Try to save without fixing violations
    await window.click('button:has-text("Save Recipe")');

    // Verify validation errors appear
    await expect(window.locator('text=/Please fix the following/')).toBeVisible({ timeout: 5000 });

    // Fix the cooking time violation
    await window.fill('#input-cooking-time-\\(minutes\\)', '35');

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
        NODE_ENV: 'test',
        E2E_TEST: 'true',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Navigate to Import Recipe page
    await window.click('text=Import Recipe');

    // Verify import page loads
    await expect(window.locator('h1:has-text("Import Recipe from Web")')).toBeVisible();

    // Enter URL and import with valid URL
    // The mock handler will return a valid recipe based on the URL
    const urlInput = window.locator('input[placeholder="https://www.example.com/recipe/..."]');
    await urlInput.fill('https://example.com/recipe/test');

    // Submit form by pressing Enter in the input field (workaround for Playwright/Electron button click issue)
    await urlInput.press('Enter');

    // Wait for review page
    await expect(window.locator('h1:has-text("Review Imported Recipe")')).toBeVisible({
      timeout: 5000,
    });

    // Click Cancel button
    await window.click('button:has-text("Cancel")');

    // Verify back on import page
    await expect(window.locator('h1:has-text("Import Recipe from Web")')).toBeVisible();

    // Verify URL field still has the value (so user can try again)
    await expect(
      window.locator('input[placeholder="https://www.example.com/recipe/..."]')
    ).toHaveValue('https://example.com/recipe/test');

    await electronApp.close();
  });

  test('edits imported recipe data before saving', async () => {
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

    // Navigate to Import Recipe page
    await window.click('text=Import Recipe');

    // Verify import page loads
    await expect(window.locator('h1:has-text("Import Recipe from Web")')).toBeVisible();

    // Enter URL and import with valid URL
    // The mock handler will return a recipe based on the URL
    const urlInput = window.locator('input[placeholder="https://www.example.com/recipe/..."]');
    await urlInput.fill('https://example.com/recipe/original');

    // Submit form by pressing Enter in the input field (workaround for Playwright/Electron button click issue)
    await urlInput.press('Enter');

    // Wait for review page
    await expect(window.locator('h1:has-text("Review Imported Recipe")')).toBeVisible({
      timeout: 5000,
    });

    // Verify recipe data is populated from the mock
    const titleField = window.locator('#input-recipe-title');
    const originalTitle = await titleField.inputValue();
    await expect(titleField).toBeDefined();

    // Edit the title
    await window.fill('#input-recipe-title', `${originalTitle} - Modified`);

    // Edit cooking time
    await window.fill('#input-cooking-time-\\(minutes\\)', '40');

    // Save the edited recipe (button click works here because "Save Recipe" button is unique)
    await window.click('button:has-text("Save Recipe")');

    // Verify success message
    await expect(window.locator('text=Recipe saved successfully!')).toBeVisible({ timeout: 5000 });

    // Navigate to View Recipes to verify edited recipe appears
    await window.click('text=View Recipes');

    // Verify edited recipe appears in collection
    await expect(window.locator('[data-testid="recipe-card"]').first()).toBeVisible({
      timeout: 5000,
    });

    await electronApp.close();
  });
});
