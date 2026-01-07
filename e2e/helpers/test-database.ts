import type { Page } from '@playwright/test';

/**
 * Clear all data from the E2E test database
 * @param page - Playwright page object
 */
export async function clearTestDatabase(page: Page): Promise<void> {
  try {
    // Call the test helper IPC handler via window.electron
    const result = await page.evaluate(async () => {
      if (!window.electron.testHelpers) {
        return {
          success: false,
          error: 'Test helpers not available. E2E_TEST env var not set.',
        };
      }
      return window.electron.testHelpers.clearDatabase();
    });

    if (!result.success) {
      console.warn(`Failed to clear test database: ${result.error}`);
      console.warn('Continuing anyway - database might already be clean');
    }
  } catch (error) {
    console.warn('Error clearing test database:', error);
    console.warn('Continuing anyway - database might already be clean');
  }
}
