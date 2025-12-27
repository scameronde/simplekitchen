import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test('complete manual recipe entry workflow', async () => {
  const electronApp = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Fill form
  await window.fill('input[label*="Recipe Title"]', 'E2E Test Pasta');
  await window.fill('input[label*="Cooking Time"]', '35');
  await window.selectOption('select[label*="Cookware"]', 'one-pot');

  // Fill ingredient
  await window.fill('input[placeholder="Name"]', 'pasta');
  await window.fill('input[placeholder="Qty"]', '200');
  await window.fill('input[placeholder="Unit"]', 'g');

  // Submit
  await window.click('button:has-text("Save Recipe")');

  // Verify success
  await expect(window.locator('text=Recipe added successfully')).toBeVisible({ timeout: 5000 });

  await electronApp.close();
});

test('displays validation errors for invalid recipe', async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Fill with invalid data
  await window.fill('input[label*="Recipe Title"]', 'Test');
  await window.fill('input[label*="Cooking Time"]', '60'); // Exceeds limit
  await window.selectOption('select[label*="Cookware"]', 'one-pot');
  await window.fill('input[placeholder="Name"]', 'butter'); // Contains lactose
  await window.fill('input[placeholder="Qty"]', '50');
  await window.fill('input[placeholder="Unit"]', 'g');

  await window.click('button:has-text("Save Recipe")');

  // Verify errors displayed
  await expect(window.locator('text=Please fix the following')).toBeVisible({ timeout: 5000 });

  await electronApp.close();
});
