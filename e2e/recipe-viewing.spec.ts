import { test, expect } from '@playwright/test';
import { _electron as electron, Page } from 'playwright';

// Helper function to create a test recipe
async function createTestRecipe(window: Page) {
  // Fill recipe form
  await window.fill('#input-recipe-title', 'E2E Test Recipe');
  await window.fill('#input-cooking-time-\\(minutes\\)', '35');
  await window.selectOption('#select-cookware-type', 'one-pan');

  // Fill ingredient
  await window.fill('input[placeholder="Name"]', 'rice');
  await window.fill('input[placeholder="Qty"]', '200');
  await window.fill('input[placeholder="Unit"]', 'g');

  // Select seasonality - check "any"
  await window.click('text=Any Season');

  // Submit
  await window.click('button:has-text("Save Recipe")');

  // Wait for success message
  await expect(window.locator('text=Recipe added successfully!')).toBeVisible({ timeout: 5000 });
}

test.describe('Recipe Viewing and Filtering', () => {
  test('navigates to recipe list and displays recipes', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Create a test recipe
    await createTestRecipe(window);

    // Navigate to View Recipes
    await window.click('text=View Recipes');

    // Verify recipe list page loads
    await expect(window.locator('h1:has-text("My Recipes")')).toBeVisible();

    // Verify test recipe is displayed (use .first() since there may be multiple recipes from previous tests)
    await expect(window.locator('text=E2E Test Recipe').first()).toBeVisible();

    await electronApp.close();
  });

  test('filters recipes by total time', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Create a test recipe
    await createTestRecipe(window);

    // Navigate to View Recipes
    await window.click('text=View Recipes');

    // Adjust time range sliders
    const minSlider = window.locator('input[type="range"]').first();
    await minSlider.fill('40');

    // Apply filters
    await window.click('button:has-text("Apply Filters")');

    // Verify recipe is filtered out (total time 35 < 40)
    await expect(window.locator('text=E2E Test Recipe')).not.toBeVisible();

    await electronApp.close();
  });

  test('filters recipes by cookware type', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Create a test recipe
    await createTestRecipe(window);

    // Navigate to View Recipes
    await window.click('text=View Recipes');

    // Select only "oven" cookware
    await window.check('label:has-text("oven")');

    // Apply filters
    await window.click('button:has-text("Apply Filters")');

    // Verify recipe is filtered out (cookware is one-pan, not oven)
    await expect(window.locator('text=E2E Test Recipe')).not.toBeVisible();

    await electronApp.close();
  });

  test('clears filters and shows all recipes', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Create a test recipe
    await createTestRecipe(window);

    // Navigate to View Recipes
    await window.click('text=View Recipes');

    // Apply a filter
    await window.check('label:has-text("oven")');
    await window.click('button:has-text("Apply Filters")');

    // Clear filters
    await window.click('button:has-text("Clear Filters")');

    // Verify recipe is visible again (use .first() since there may be multiple recipes from previous tests)
    await expect(window.locator('text=E2E Test Recipe').first()).toBeVisible();

    await electronApp.close();
  });

  test('navigates to recipe detail page', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Create a test recipe
    await createTestRecipe(window);

    // Navigate to View Recipes
    await window.click('text=View Recipes');

    // Click on recipe card (use .first() since there may be multiple recipes from previous tests)
    await window.locator('text=E2E Test Recipe').first().click();

    // Verify detail page loads
    await expect(window.locator('h1:has-text("E2E Test Recipe")')).toBeVisible();
    await expect(window.locator('text=rice')).toBeVisible();
    await expect(window.locator('text=200 g')).toBeVisible();

    await electronApp.close();
  });

  test('navigates back from detail page to list', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Create a test recipe
    await createTestRecipe(window);

    // Navigate to View Recipes
    await window.click('text=View Recipes');
    await window.locator('text=E2E Test Recipe').first().click();

    // Click back button
    await window.click('button:has-text("Back to Recipes")');

    // Verify back on list page
    await expect(window.locator('h1:has-text("My Recipes")')).toBeVisible();

    await electronApp.close();
  });
});
