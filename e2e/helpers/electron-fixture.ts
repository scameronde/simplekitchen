import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test';

type ElectronFixtures = {
  electronApp: ElectronApplication;
  page: Page;
};

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    // Launch Electron with test configuration
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        E2E_TEST: 'true',
      },
    });

    // Capture console output from Electron main process
    electronApp.process().stdout?.on('data', data => {
      console.log('[Electron Main]:', data.toString());
    });
    electronApp.process().stderr?.on('data', data => {
      console.error('[Electron Main Error]:', data.toString());
    });

    // VERIFY environment variables are set correctly in main process
    const envCheck = await electronApp.evaluate(() => ({
      nodeEnv: process.env.NODE_ENV,
      e2eTest: process.env.E2E_TEST,
    }));

    // Log environment check for debugging
    console.log('Environment check:', envCheck);

    if (envCheck.nodeEnv !== 'test' || envCheck.e2eTest !== 'true') {
      console.warn(
        `Environment variables not set correctly!\n` +
          `Expected: NODE_ENV='test', E2E_TEST='true'\n` +
          `Actual: NODE_ENV='${envCheck.nodeEnv}', E2E_TEST='${envCheck.e2eTest}'`
      );
      // Don't throw - let tests proceed to see what happens
    }

    await use(electronApp);
    await electronApp.close();
  },

  page: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();

    // Wait for page to load
    await window.waitForLoadState('domcontentloaded');

    await use(window);
  },
});

export { expect } from '@playwright/test';
