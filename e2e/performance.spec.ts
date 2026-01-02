import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { generateTestRecipes } from '../src/main/database/generate-test-recipes';

test.describe('Performance Testing with Large Dataset', () => {
  test('recipe filtering with 1500 recipes completes in <1s', async () => {
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

    // =========================================================================
    // SETUP: Populate database with 1500 synthetic recipes
    // =========================================================================
    console.log('Generating 1500 test recipes...');
    const testRecipes = generateTestRecipes({ count: 1500, seed: 12345 });

    console.log('Populating database...');
    const populateStart = performance.now();

    for (const recipe of testRecipes) {
      const response = await window.evaluate(async recipeInput => {
        return await (window as any).electron.recipeAPI.create(recipeInput);
      }, recipe as any);
      if (!response.success) {
        throw new Error(`Failed to create recipe: ${response.errors?.[0]?.message}`);
      }
    }

    const populateDuration = performance.now() - populateStart;
    console.log(`Database populated in ${populateDuration.toFixed(2)}ms`);

    // =========================================================================
    // TEST 1: Initial Render Performance
    // =========================================================================
    console.log('Test 1: Initial render with 1500 recipes');
    await window.click('text=View Recipes');

    const renderStart = performance.now();
    await window.waitForSelector('[data-testid="recipe-card"]', { timeout: 5000 });
    const renderDuration = performance.now() - renderStart;

    console.log(`Initial render completed in ${renderDuration.toFixed(2)}ms`);
    expect(renderDuration).toBeLessThan(1000);

    // Verify multiple recipes are rendered
    const recipeCards = await window.locator('[data-testid="recipe-card"]').count();
    console.log(`Rendered ${recipeCards} recipe cards`);
    expect(recipeCards).toBeGreaterThan(0);

    // =========================================================================
    // TEST 2: Time Filter Performance (30-40 minutes)
    // =========================================================================
    console.log('Test 2: Apply time filter (30-40 minutes)');

    const timeFilterStart = performance.now();

    // Set time range sliders to 30-40 minutes
    const minSlider = window.locator('input[type="range"]').first();
    const maxSlider = window.locator('input[type="range"]').nth(1);

    await minSlider.fill('30');
    await maxSlider.fill('40');

    // Apply filters
    await window.click('button:has-text("Apply Filters")');

    // Wait for filtered results
    await window.waitForSelector('[data-testid="recipe-card"]', { timeout: 5000 });

    const timeFilterDuration = performance.now() - timeFilterStart;
    console.log(`Time filter completed in ${timeFilterDuration.toFixed(2)}ms`);
    expect(timeFilterDuration).toBeLessThan(1000);

    // Verify filtering worked (some recipes should match)
    const filteredCount1 = await window.locator('[data-testid="recipe-card"]').count();
    console.log(`Time filter returned ${filteredCount1} recipes`);
    expect(filteredCount1).toBeGreaterThan(0);

    // =========================================================================
    // TEST 3: Cookware Filter Performance (one-pan)
    // =========================================================================
    console.log('Test 3: Apply cookware filter (one-pan)');

    // Clear previous filters first
    await window.click('button:has-text("Clear Filters")');
    await window.waitForSelector('[data-testid="recipe-card"]', { timeout: 5000 });

    const cookwareFilterStart = performance.now();

    // Select one-pan cookware
    await window.check('label:has-text("one-pan")');

    // Apply filters
    await window.click('button:has-text("Apply Filters")');

    // Wait for filtered results
    await window.waitForSelector('[data-testid="recipe-card"]', { timeout: 5000 });

    const cookwareFilterDuration = performance.now() - cookwareFilterStart;
    console.log(`Cookware filter completed in ${cookwareFilterDuration.toFixed(2)}ms`);
    expect(cookwareFilterDuration).toBeLessThan(1000);

    // Verify filtering worked
    const filteredCount2 = await window.locator('[data-testid="recipe-card"]').count();
    console.log(`Cookware filter returned ${filteredCount2} recipes`);
    expect(filteredCount2).toBeGreaterThan(0);

    // =========================================================================
    // TEST 4: Dietary Tag Filter Performance (gluten-free)
    // =========================================================================
    console.log('Test 4: Apply dietary tag filter (gluten-free)');

    // Clear previous filters first
    await window.click('button:has-text("Clear Filters")');
    await window.waitForSelector('[data-testid="recipe-card"]', { timeout: 5000 });

    const dietaryFilterStart = performance.now();

    // Select gluten-free dietary tag
    await window.check('label:has-text("Gluten-Free")');

    // Apply filters
    await window.click('button:has-text("Apply Filters")');

    // Wait for filtered results
    await window.waitForSelector('[data-testid="recipe-card"]', { timeout: 5000 });

    const dietaryFilterDuration = performance.now() - dietaryFilterStart;
    console.log(`Dietary filter completed in ${dietaryFilterDuration.toFixed(2)}ms`);
    expect(dietaryFilterDuration).toBeLessThan(1000);

    // Verify filtering worked
    const filteredCount3 = await window.locator('[data-testid="recipe-card"]').count();
    console.log(`Dietary filter returned ${filteredCount3} recipes`);
    expect(filteredCount3).toBeGreaterThan(0);

    // =========================================================================
    // TEST 5: Combined Filter Performance (all filters together)
    // =========================================================================
    console.log('Test 5: Apply combined filters');

    // Clear previous filters first
    await window.click('button:has-text("Clear Filters")');
    await window.waitForSelector('[data-testid="recipe-card"]', { timeout: 5000 });

    const combinedFilterStart = performance.now();

    // Set time range
    await minSlider.fill('30');
    await maxSlider.fill('45');

    // Select cookware
    await window.check('label:has-text("one-pan")');

    // Select dietary tag
    await window.check('label:has-text("Gluten-Free")');

    // Apply filters
    await window.click('button:has-text("Apply Filters")');

    // Wait for filtered results (might have no results, that's OK)
    try {
      await window.waitForSelector('[data-testid="recipe-card"]', { timeout: 2000 });
      const filteredCount4 = await window.locator('[data-testid="recipe-card"]').count();
      console.log(`Combined filter returned ${filteredCount4} recipes`);
    } catch {
      // No recipes match all filters - verify "no recipes" message
      const noRecipesMsg = await window.locator('text=/No recipes found/');
      expect(await noRecipesMsg.isVisible()).toBe(true);
      console.log('Combined filter returned 0 recipes (expected for strict filtering)');
    }

    const combinedFilterDuration = performance.now() - combinedFilterStart;
    console.log(`Combined filter completed in ${combinedFilterDuration.toFixed(2)}ms`);
    expect(combinedFilterDuration).toBeLessThan(1000);

    // =========================================================================
    // TEST 6: UI Responsiveness - Rapid Filter Changes
    // =========================================================================
    console.log('Test 6: Rapid filter changes (UI responsiveness)');

    const rapidFilterStart = performance.now();

    // Clear filters
    await window.click('button:has-text("Clear Filters")');
    await window.waitForSelector('[data-testid="recipe-card"]', { timeout: 5000 });

    // Quickly toggle multiple filters
    await window.check('label:has-text("one-pot")');
    await window.click('button:has-text("Apply Filters")');
    await window.waitForSelector('[data-testid="recipe-card"]', { timeout: 5000 });

    await window.check('label:has-text("Vegan")');
    await window.click('button:has-text("Apply Filters")');
    await window.waitForTimeout(100); // Small delay for UI update

    await window.uncheck('label:has-text("one-pot")');
    await window.click('button:has-text("Apply Filters")');
    await window.waitForTimeout(100);

    const rapidFilterDuration = performance.now() - rapidFilterStart;
    console.log(`Rapid filter changes completed in ${rapidFilterDuration.toFixed(2)}ms`);
    expect(rapidFilterDuration).toBeLessThan(3000); // Allow more time for multiple operations

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n=== Performance Test Summary ===');
    console.log(`Database population: ${populateDuration.toFixed(2)}ms (1500 recipes)`);
    console.log(`Initial render: ${renderDuration.toFixed(2)}ms ✓`);
    console.log(`Time filter: ${timeFilterDuration.toFixed(2)}ms ✓`);
    console.log(`Cookware filter: ${cookwareFilterDuration.toFixed(2)}ms ✓`);
    console.log(`Dietary filter: ${dietaryFilterDuration.toFixed(2)}ms ✓`);
    console.log(`Combined filter: ${combinedFilterDuration.toFixed(2)}ms ✓`);
    console.log(`Rapid filter changes: ${rapidFilterDuration.toFixed(2)}ms ✓`);
    console.log('All performance targets met (<1s per operation)');

    await electronApp.close();
  });
});
