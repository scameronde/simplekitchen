import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('Conversation to Suggestions Flow', () => {
  test('should display recipe suggestions after conversation', async () => {
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
    await window.click("text=What's for dinner?");

    // Wait for conversation to load
    await expect(window.locator('h1')).toContainText("What's for dinner?");

    // Simulate conversation: Answer energy level question
    const input = window.locator('input[placeholder*="Tell me about your day"]');
    const sendButton = window.locator('button:has-text("Send")');

    await input.fill("I'm feeling pretty tired tonight");
    await sendButton.click();

    // Wait for AI response
    await expect(window.locator('text=/time do you have/i')).toBeVisible({ timeout: 10000 });

    // Simulate conversation: Answer time question
    await input.fill('About 30 minutes');
    await sendButton.click();

    // Wait for AI to transition and show suggestions
    // This should happen automatically when AI detects sufficient context
    await expect(window.locator('text=/Here are some recipes/i')).toBeVisible({ timeout: 15000 });

    // Verify: Recipe cards are displayed
    await expect(window.locator('[data-testid="recipe-suggestion-card"]').first()).toBeVisible({
      timeout: 5000,
    });

    // Verify: Recipe card has expected elements
    const firstCard = window.locator('[data-testid="recipe-suggestion-card"]').first();
    await expect(firstCard.locator('h3')).toBeVisible(); // Recipe title
    await expect(firstCard.locator('text=/min/i')).toBeVisible(); // Time indicator
    await expect(firstCard.locator('button:has-text("Select this recipe")')).toBeVisible();
    await expect(firstCard.locator('button:has-text("Not this one")')).toBeVisible();
  });

  test('should continue conversation if AI needs more info', async ({ page }) => {
    // Navigate to conversation page
    await page.goto('/');
    await page.click("text=What's for dinner?");

    // Wait for conversation to load
    await expect(page.locator('h1')).toContainText("What's for dinner?");

    // Send a vague message
    const input = page.locator('input[placeholder*="Tell me about your day"]');
    const sendButton = page.locator('button:has-text("Send")');

    await input.fill('Hello');
    await sendButton.click();

    // Wait for AI response asking for more info
    await expect(page.locator('.bg-gray-200').last()).toBeVisible({ timeout: 10000 });

    // Verify: NO recipe suggestions appear (AI still gathering context)
    await expect(page.locator('[data-testid="recipe-suggestion-card"]')).not.toBeVisible();

    // Verify: Conversation continues normally
    const aiMessages = page.locator('.bg-gray-200');
    await expect(aiMessages).toHaveCount(1); // Only one AI message so far
  });
});
