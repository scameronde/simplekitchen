import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('Recipe Viewing and Filtering', () => {
  test.beforeEach(async ({ page }) => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Create a test recipe first
    await window.click('text=Add Recipe');
    await window.fill('input[name="title"]', 'E2E Test Recipe');
    await window.fill('input[name="cookingTime"]', '35');
    await window.selectOption('select[name="cookwareType"]', 'one-pan');
    await window.fill('input[name="ingredients[0].name"]', 'test ingredient');
    await window.fill('input[name="ingredients[0].quantity"]', '1');
    await window.fill('input[name="ingredients[0].unit"]', 'cup');
    await window.click('button:has-text("Add Recipe")');

    // Wait for success message
    await expect(window.locator('text=Recipe added successfully')).toBeVisible();

    // Store window for tests
    (page as any).electronApp = electronApp;
    (page as any).window = window;
  });

  test.afterEach(async ({ page }) => {
    const electronApp = (page as any).electronApp;
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('navigates to recipe list and displays recipes', async ({ page }) => {
    const window = (page as any).window;

    // Navigate to View Recipes
    await window.click('text=View Recipes');

    // Verify recipe list page loads
    await expect(window.locator('h1:has-text("My Recipes")')).toBeVisible();

    // Verify test recipe is displayed
    await expect(window.locator('text=E2E Test Recipe')).toBeVisible();
  });

  test('filters recipes by cooking time', async ({ page }) => {
    const window = (page as any).window;

    await window.click('text=View Recipes');

    // Adjust time range sliders
    const minSlider = window.locator('input[type="range"]').first();
    await minSlider.fill('40');

    // Apply filters
    await window.click('button:has-text("Apply Filters")');

    // Verify recipe is filtered out (cooking time 35 < 40)
    await expect(window.locator('text=E2E Test Recipe')).not.toBeVisible();
  });

  test('filters recipes by cookware type', async ({ page }) => {
    const window = (page as any).window;

    await window.click('text=View Recipes');

    // Select only "oven" cookware
    await window.check('label:has-text("oven")');

    // Apply filters
    await window.click('button:has-text("Apply Filters")');

    // Verify recipe is filtered out (cookware is one-pan, not oven)
    await expect(window.locator('text=E2E Test Recipe')).not.toBeVisible();
  });

  test('clears filters and shows all recipes', async ({ page }) => {
    const window = (page as any).window;

    await window.click('text=View Recipes');

    // Apply a filter
    await window.check('label:has-text("oven")');
    await window.click('button:has-text("Apply Filters")');

    // Clear filters
    await window.click('button:has-text("Clear Filters")');

    // Verify recipe is visible again
    await expect(window.locator('text=E2E Test Recipe')).toBeVisible();
  });

  test('navigates to recipe detail page', async ({ page }) => {
    const window = (page as any).window;

    await window.click('text=View Recipes');

    // Click on recipe card
    await window.click('text=E2E Test Recipe');

    // Verify detail page loads
    await expect(window.locator('h1:has-text("E2E Test Recipe")')).toBeVisible();
    await expect(window.locator('text=test ingredient')).toBeVisible();
    await expect(window.locator('text=1 cup')).toBeVisible();
  });

  test('navigates back from detail page to list', async ({ page }) => {
    const window = (page as any).window;

    await window.click('text=View Recipes');
    await window.click('text=E2E Test Recipe');

    // Click back button
    await window.click('button:has-text("Back to Recipes")');

    // Verify back on list page
    await expect(window.locator('h1:has-text("My Recipes")')).toBeVisible();
  });
});
