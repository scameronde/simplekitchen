import { test, expect } from '@playwright/test';
import { _electron as electron, Page } from 'playwright';
import { clearTestDatabase } from './helpers/test-database';

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
        E2E_TEST: 'true',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Clear database before test
    await clearTestDatabase(window);

    // Create a test recipe
    await createTestRecipe(window);

    // Navigate to View Recipes
    await window.click('text=View Recipes');

    // Verify recipe list page loads
    await expect(window.locator('h1:has-text("My Recipes")')).toBeVisible();

    // Verify test recipe is displayed
    await expect(window.locator('text=E2E Test Recipe')).toBeVisible();

    await electronApp.close();
  });

  test('filters recipes by total time', async () => {
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

    // Clear database before test
    await clearTestDatabase(window);

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
        E2E_TEST: 'true',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Clear database before test
    await clearTestDatabase(window);

    // Create a test recipe (one-pan)
    await createTestRecipe(window);

    // Navigate to View Recipes
    await window.click('text=View Recipes');

    // Select one-pot filter (which should hide our one-pan recipe)
    await window.click('text=One Pot');

    // Apply filters
    await window.click('button:has-text("Apply Filters")');

    // Recipe should not be visible
    await expect(window.locator('text=E2E Test Recipe')).not.toBeVisible();

    await electronApp.close();
  });

  test('clears filters and shows all recipes', async () => {
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

    // Clear database before test
    await clearTestDatabase(window);

    // Create a test recipe
    await createTestRecipe(window);

    // Navigate to View Recipes
    await window.click('text=View Recipes');

    // Apply a filter
    await window.click('text=One Pot');
    await window.click('button:has-text("Apply Filters")');
    await expect(window.locator('text=E2E Test Recipe')).not.toBeVisible();

    // Clear filters
    await window.click('button:has-text("Clear Filters")');

    // Recipe should be visible again
    await expect(window.locator('text=E2E Test Recipe')).toBeVisible();

    await electronApp.close();
  });

  test('navigates to recipe detail page', async () => {
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

    // Clear database before test
    await clearTestDatabase(window);

    // Create a test recipe
    await createTestRecipe(window);

    // Navigate to View Recipes
    await window.click('text=View Recipes');

    // Click on recipe card
    await window.locator('text=E2E Test Recipe').click();

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
        E2E_TEST: 'true',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Clear database before test
    await clearTestDatabase(window);

    // Create a test recipe
    await createTestRecipe(window);

    // Navigate to View Recipes
    await window.click('text=View Recipes');
    await window.locator('text=E2E Test Recipe').click();

    // Click back button
    await window.click('button:has-text("Back to Recipes")');

    // Verify back on list page
    await expect(window.locator('h1:has-text("My Recipes")')).toBeVisible();

    await electronApp.close();
  });
});
