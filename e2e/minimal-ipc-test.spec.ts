import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('Minimal IPC Reproduction Tests', () => {
  test('Test 1: Manual entry pattern (NODE_ENV=development, no E2E_TEST) - BASELINE', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        // No E2E_TEST
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    console.log('[TEST 1] Checking API availability...');
    const apiCheck = await window.evaluate(() => {
      return {
        electronExists: typeof window.electron !== 'undefined',
        recipeAPIExists: typeof window.electron?.recipeAPI !== 'undefined',
        generateExists: typeof window.electron?.recipeAPI?.generateRecipe === 'function',
        testAPIExists: typeof (window as any).__testAPI__ !== 'undefined',
      };
    });
    console.log('[TEST 1] API Check:', apiCheck);

    expect(apiCheck.electronExists).toBe(true);
    expect(apiCheck.recipeAPIExists).toBe(true);
    expect(apiCheck.generateExists).toBe(true);

    await electronApp.close();
  });

  test('Test 2: With E2E_TEST but development (NODE_ENV=development, E2E_TEST=true)', async () => {
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

    console.log('[TEST 2] Checking API availability...');
    const apiCheck = await window.evaluate(() => {
      return {
        electronExists: typeof window.electron !== 'undefined',
        recipeAPIExists: typeof window.electron?.recipeAPI !== 'undefined',
        generateExists: typeof window.electron?.recipeAPI?.generateRecipe === 'function',
        testAPIExists: typeof (window as any).__testAPI__ !== 'undefined',
      };
    });
    console.log('[TEST 2] API Check:', apiCheck);

    expect(apiCheck.electronExists).toBe(true);
    expect(apiCheck.recipeAPIExists).toBe(true);
    expect(apiCheck.generateExists).toBe(true);

    await electronApp.close();
  });

  test('Test 3: Current failing pattern (NODE_ENV=test, E2E_TEST=true)', async () => {
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

    console.log('[TEST 3] Checking API availability...');
    const apiCheck = await window.evaluate(() => {
      return {
        electronExists: typeof window.electron !== 'undefined',
        recipeAPIExists: typeof window.electron?.recipeAPI !== 'undefined',
        generateExists: typeof window.electron?.recipeAPI?.generateRecipe === 'function',
        testAPIExists: typeof (window as any).__testAPI__ !== 'undefined',
      };
    });
    console.log('[TEST 3] API Check:', apiCheck);

    expect(apiCheck.electronExists).toBe(true);
    expect(apiCheck.recipeAPIExists).toBe(true);
    expect(apiCheck.generateExists).toBe(true);

    await electronApp.close();
  });

  test('Test 4: Direct IPC call test (NODE_ENV=test, E2E_TEST=true)', async () => {
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

    console.log('[TEST 4] Attempting direct IPC call to recipe:generate...');
    
    try {
      const result = await window.evaluate(async () => {
        const criteria = {
          cuisineType: 'Thai',
          mainIngredient: 'chicken',
          dietaryTags: ['gluten-free'],
          seasonality: 'any',
          cookwareType: 'one-pan',
          flavorProfile: 'savory',
          skillLevel: 'beginner',
        };
        
        console.log('[RENDERER] About to call generateRecipe with:', criteria);
        
        try {
          const result = await window.electron.recipeAPI.generateRecipe(criteria);
          console.log('[RENDERER] generateRecipe returned:', result);
          return { success: true, result };
        } catch (error: any) {
          console.error('[RENDERER] generateRecipe error:', error);
          return { success: false, error: error.message };
        }
      });

      console.log('[TEST 4] IPC call result:', result);
      
      if (result.success) {
        expect(result.result).toBeDefined();
        console.log('[TEST 4] ✅ IPC call succeeded!');
      } else {
        console.log('[TEST 4] ❌ IPC call failed:', result.error);
        throw new Error(`IPC call failed: ${result.error}`);
      }
    } catch (error) {
      console.error('[TEST 4] Test failed with error:', error);
      throw error;
    }

    await electronApp.close();
  });

  test('Test 5: Manual entry IPC call (NODE_ENV=development, no E2E_TEST)', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    console.log('[TEST 5] Attempting recipe:create IPC call (manual entry pattern)...');
    
    try {
      const result = await window.evaluate(async () => {
        const input = {
          title: 'Minimal Test Recipe',
          cookingTimeMinutes: 30,
          servings: 2,
          cookwareType: 'one-pan',
          sourceType: 'manual',
          ingredients: [{ name: 'rice', quantity: 200, unit: 'g' }],
          dietaryTags: [],
          seasonality: 'any',
        };
        
        console.log('[RENDERER] About to call create with:', input);
        
        try {
          const result = await window.electron.recipeAPI.create(input);
          console.log('[RENDERER] create returned:', result);
          return { success: true, result };
        } catch (error: any) {
          console.error('[RENDERER] create error:', error);
          return { success: false, error: error.message };
        }
      });

      console.log('[TEST 5] IPC call result:', result);
      
      if (result.success) {
        expect(result.result).toBeDefined();
        console.log('[TEST 5] ✅ IPC call succeeded!');
      } else {
        console.log('[TEST 5] ❌ IPC call failed:', result.error);
        throw new Error(`IPC call failed: ${result.error}`);
      }
    } catch (error) {
      console.error('[TEST 5] Test failed with error:', error);
      throw error;
    }

    await electronApp.close();
  });
});
