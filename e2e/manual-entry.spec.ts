import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test('complete manual recipe entry workflow', async () => {
  const electronApp = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Fill form
  await window.fill('#input-recipe-title', 'E2E Test Pasta');
  await window.fill('#input-cooking-time-\\(minutes\\)', '35');
  await window.selectOption('#select-cookware-type', 'one-pot');

  // Fill ingredient (using rice which is gluten-free)
  await window.fill('input[placeholder="Name"]', 'rice');
  await window.fill('input[placeholder="Qty"]', '200');
  await window.fill('input[placeholder="Unit"]', 'g');

  // Select seasonality - check "any"
  await window.click('text=Any Season');

  // Submit
  await window.click('button:has-text("Save Recipe")');

  // Verify success
  await expect(window.locator('text=Recipe added successfully!')).toBeVisible({ timeout: 5000 });

  await electronApp.close();
});

test('displays validation errors for invalid recipe', async () => {
  const electronApp = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Fill with invalid data
  await window.fill('#input-recipe-title', 'Test');
  await window.fill('#input-cooking-time-\\(minutes\\)', '60'); // Exceeds limit
  await window.selectOption('#select-cookware-type', 'one-pot');
  await window.fill('input[placeholder="Name"]', 'butter'); // Contains lactose
  await window.fill('input[placeholder="Qty"]', '50');
  await window.fill('input[placeholder="Unit"]', 'g');

  await window.click('button:has-text("Save Recipe")');

  // Verify errors displayed
  await expect(window.locator('text=/Please fix the following/')).toBeVisible({ timeout: 5000 });

  await electronApp.close();
});
