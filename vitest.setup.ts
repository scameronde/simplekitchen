import '@testing-library/jest-dom';
import { vi } from 'vitest';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      };
    };
  }
}

// Type-safe global setup
globalThis.window = globalThis.window || (globalThis as unknown as Window);
globalThis.window.electron = {
  ipcRenderer: {
    invoke: vi.fn(),
  },
};
