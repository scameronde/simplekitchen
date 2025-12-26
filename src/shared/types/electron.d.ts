// Type definitions for Electron APIs exposed via contextBridge

export interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };

  // Future APIs (Phase 3+):
  // recipeAPI: {
  //   getAll: () => Promise<Recipe[]>;
  //   save: (recipe: Recipe) => Promise<void>;
  //   // ... more methods
  // };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
