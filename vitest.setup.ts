/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import type { ElectronAPI } from './src/shared/types/electron';

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

// Type-safe global setup
globalThis.window = globalThis.window || (globalThis as unknown as Window);
globalThis.window.electron = {
  platform: 'test',
  versions: {
    node: '22.0.0',
    chrome: '126.0.0',
    electron: '39.0.0',
  },
  recipeAPI: {
    create: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    filter: vi.fn(),
    generateRecipe: vi.fn(),
    importRecipe: vi.fn(),
  },
};

// Mock window.scrollTo to prevent jsdom warnings
globalThis.window.scrollTo = vi.fn();
