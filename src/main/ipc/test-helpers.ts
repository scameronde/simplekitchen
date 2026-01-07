/**
 * IPC handlers for E2E test utilities
 * These handlers should only be used in E2E test environment
 */

import { ipcMain } from 'electron';
import { clearAllData } from '../database/init.js';

export function registerTestHelpers(): void {
  // Only register test helpers in E2E test mode
  if (process.env.E2E_TEST !== 'true') {
    return;
  }

  console.log('Registering E2E test helper IPC handlers');

  // Clear all data from database
  ipcMain.handle('test:clearDatabase', async () => {
    try {
      await clearAllData();
      return { success: true };
    } catch (error) {
      console.error('Failed to clear database:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
