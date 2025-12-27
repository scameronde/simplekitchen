import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.electron for renderer tests
global.window = global.window || ({} as any);
(global.window as any).electron = {
  recipeAPI: {
    create: vi.fn(),
  },
};
