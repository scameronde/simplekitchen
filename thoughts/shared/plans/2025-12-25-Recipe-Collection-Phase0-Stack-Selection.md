# Phase 0: Technology Stack Selection & Project Scaffolding

## Inputs

- **Master Plan**: `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md`
- **Research Report**: `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md`
- **Epic**: `thoughts/shared/epics/2025-12-25-Recipe-Collection-Management.md`
- **Spec**: `thoughts/shared/specs/2025-12-25-SimpleKitchen.md`

## Verified Current State

**Fact:** Project directory contains only documentation files, no source code.  
**Evidence:** Project root listing shows: `thoughts/`, `.gitignore` only. No `src/`, `package.json`, `node_modules/`, or implementation files.  
**Excerpt:** Directory contains `thoughts/shared/{epics,missions,plans,research,specs}/*.md` and `.gitignore`

**Fact:** Research recommends Electron + React + TypeScript stack.  
**Evidence:** `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md:729-782`  
**Excerpt:** "Electron framework (v39+) enables cross-platform desktop applications using Chromium + Node.js, providing full npm ecosystem access and mature tooling (24.2k stars for electron-react-boilerplate)"

**Fact:** Research recommends SQLite with better-sqlite3.  
**Evidence:** `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md:229-275`  
**Excerpt:** "SQLite with better-sqlite3 provides sub-millisecond query performance (<1ms for 1000+ recipes), full ACID durability with proper configuration"

**Fact:** Seven critical decisions require resolution before implementation.  
**Evidence:** `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md` (Critical Decision Points section)  
**Excerpt:** Lists 7 decisions: ingredient database approach, recipe adaptation, versioning, seasonality, web scraping, cookware constraint, performance testing

## Goals / Non-Goals

### Goals
- Finalize all technology stack decisions with user approval
- Initialize Electron + React + TypeScript project structure
- Configure development tooling (linting, formatting, testing)
- Set up build and packaging configuration
- Create basic application skeleton (can launch and render empty window)
- Document all decisions in this plan for future reference

### Non-Goals
- Implement any business logic (recipes, validation, etc.) - that's Phase 1+
- Design UI layouts or components - that's Phase 3+
- Set up database schema - that's Phase 1
- Integrate external APIs - that's Phase 5+

## Design Overview

This phase focuses on **scaffolding** rather than implementation. The workflow is:

1. **Decision Resolution**: User confirms or modifies recommended technology choices
2. **Project Initialization**: Create package.json, install dependencies, configure build tools
3. **Directory Structure**: Set up standardized project layout (main process, renderer process, shared types)
4. **Development Tooling**: Configure TypeScript, ESLint, Prettier, Vitest
5. **Application Skeleton**: Create minimal Electron app that launches with React renderer
6. **Verification**: Confirm app builds, launches, and hot-reloads during development

## Implementation Instructions (For Implementor)

### DECISION GATE: Technology Stack Confirmation

**Before proceeding with implementation**, user must confirm or override these recommendations. If user accepts all defaults, proceed immediately. If user requests changes, update this plan accordingly.

---

### PLAN-000: Decision Resolution Document

**Change Type**: create  
**File(s)**: `thoughts/shared/plans/2025-12-25-Recipe-Collection-Phase0-DECISIONS.md`

**Instruction**:
Create a decision log documenting all technology choices. Use this template:

```markdown
# Phase 0 Technology Decisions

## Decision Summary
Date: 2025-12-25  
Status: [PENDING USER APPROVAL | APPROVED]

## Core Stack Decisions

### Decision 1: Application Framework
**Chosen**: Electron v39+  
**Alternatives Considered**: Tauri (rejected: smaller ecosystem, Rust learning curve)  
**Rationale**: Mature tooling, full Node.js ecosystem, production-proven  
**Source**: Research lines 202-223, 729-782

### Decision 2: Frontend Framework
**Chosen**: React 18+ with TypeScript 5+  
**Alternatives Considered**: Vue, Svelte (rejected: smaller ecosystems)  
**Rationale**: Largest community, best Electron integration, team familiarity assumed  
**Source**: electron-react-boilerplate (24.2k stars)

### Decision 3: UI Component Library
**Chosen**: [TO BE DECIDED]  
**Options**:
- Material-UI (MUI) - Most popular, comprehensive components, heavy bundle
- shadcn/ui - Lightweight, Tailwind-based, copy-paste components
- Ant Design - Enterprise-grade, comprehensive, opinionated styling
- Custom CSS - Maximum control, more development time

**Recommendation**: shadcn/ui for modern, lightweight approach  
**Action**: User to confirm or select alternative

### Decision 4: Database Persistence
**Chosen**: SQLite with better-sqlite3  
**Alternatives Considered**: lowdb (rejected: performance at scale), PouchDB (rejected: unnecessary complexity)  
**Rationale**: Sub-millisecond queries, ACID durability, proven for 1000+ records  
**Source**: Research lines 229-275

### Decision 5: Query Builder / ORM
**Chosen**: [TO BE DECIDED]  
**Options**:
- Kysely - Type-safe SQL query builder, zero runtime overhead
- Drizzle - Modern ORM with TypeScript-first design
- Raw SQL with TypeScript type generation - Maximum control
- TypeORM - Traditional ORM (rejected: heavy, Active Record pattern overkill)

**Recommendation**: Kysely for type safety + SQL control  
**Action**: User to confirm or select alternative

### Decision 6: Testing Framework
**Chosen**: Vitest (unit/integration) + Playwright (E2E)  
**Alternatives Considered**: Jest (rejected: slower, requires more config), Cypress (rejected: heavier than Playwright)  
**Rationale**: Vitest native ESM support, fast execution; Playwright for cross-platform E2E  
**Source**: Modern testing best practices

### Decision 7: AI Service Provider
**Chosen**: OpenAI GPT-4o-mini with Structured Outputs  
**Alternatives Considered**: Anthropic Claude (more expensive), Ollama (slower, lower quality)  
**Rationale**: Best cost/performance ratio (~$0.0005 per recipe), guaranteed schema adherence  
**Source**: Research lines 136-173, 549-606

## Business Logic Decisions (From Master Plan)

### Decision 8: Ingredient Dietary Property Database
**Chosen**: Hybrid approach (static table + API fallback + user overrides)  
**Rationale**: Balances accuracy, automation, and user control  
**Implementation**: Phase 2  
**Source**: Master Plan Decision 1

### Decision 9: Recipe Adaptation for Dietary Constraints
**Chosen**: Reject non-compliant recipes (Option A for MVP)  
**Future Enhancement**: AI-powered substitution suggestions (Phase 5+)  
**Rationale**: Aligns with spec requirement, avoids recipe integrity risks  
**Source**: Master Plan Decision 2

### Decision 10: Recipe Versioning
**Chosen**: Overwrite on edit, no version history (Option A for MVP)  
**Rationale**: Simplicity, single-user context, re-validation on save  
**Source**: Master Plan Decision 3

### Decision 11: Seasonality Data
**Chosen**: User manual tags (spring, summer, fall, winter, any)  
**Rationale**: Simple implementation, user knows preferences best  
**Source**: Master Plan Decision 4

### Decision 12: Web Scraping Approach
**Chosen**: User-driven import with Schema.org extraction (Option A)  
**Rationale**: Lowest legal/technical risk, graceful degradation  
**Source**: Master Plan Decision 5

### Decision 13: Cookware Type Constraint
**Chosen**: Single enum (one-pot OR one-pan OR oven, mutually exclusive)  
**Rationale**: Aligns with spec "minimal cookware" goal  
**Source**: Master Plan Decision 6

### Decision 14: Performance Testing Dataset
**Chosen**: Generate 1000-2000 synthetic recipes in Phase 4 using OpenAI  
**Estimated Cost**: $0.50-$1.00 for generation  
**Source**: Master Plan Decision 7

## User Approval Required

**STATUS**: [PENDING] - User must review and approve/modify above decisions before PLAN-001 execution.

If approved, proceed with PLAN-001. If changes requested, update this document and master plan accordingly.
```

**Done When**: Decision document exists and has been reviewed by user.

---

### PLAN-001: Initialize Node.js Project

**Change Type**: create  
**File(s)**: `package.json`, `.gitignore`, `.npmrc`

**Instruction**:
1. Run `npm init -y` in project root
2. Edit `package.json` to set:
   - `name`: "simplekitchen"
   - `version`: "0.1.0"
   - `description`: "Intelligent cooking companion for just-in-time dinner decision support"
   - `author`: [user to provide]
   - `license`: "MIT" (or user preference)
   - `main`: "dist/main/main.js" (Electron main process entry point after build)
   - `type`: "module" (enable ESM)

3. Update `.gitignore` to add:
```
# Dependencies
node_modules/

# Build outputs
dist/
release/
out/

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/

# Database
*.db
*.db-shm
*.db-wal
```

4. Create `.npmrc` with:
```
engine-strict=true
```

5. Add `engines` field to `package.json`:
```json
"engines": {
  "node": ">=20.0.0",
  "npm": ">=10.0.0"
}
```

**Evidence**: Standard Node.js project initialization pattern  
**Done When**: `package.json` exists with correct metadata, `.gitignore` covers all build artifacts, `.npmrc` enforces Node version

---

### PLAN-002: Install Core Dependencies

**Change Type**: modify  
**File(s)**: `package.json`

**Instruction**:
Run these npm commands to install dependencies:

**Production Dependencies**:
```bash
npm install electron@^39.0.0
npm install react@^18.3.0 react-dom@^18.3.0
npm install better-sqlite3@^11.0.0
```

**Development Dependencies**:
```bash
npm install --save-dev @types/react@^18.3.0 @types/react-dom@^18.3.0
npm install --save-dev @types/better-sqlite3@^7.6.0
npm install --save-dev typescript@^5.6.0
npm install --save-dev vite@^6.0.0
npm install --save-dev electron-builder@^24.0.0
npm install --save-dev vitest@^2.0.0
npm install --save-dev eslint@^9.0.0
npm install --save-dev prettier@^3.3.0
npm install --save-dev @typescript-eslint/eslint-plugin@^8.0.0
npm install --save-dev @typescript-eslint/parser@^8.0.0
npm install --save-dev concurrently@^9.0.0
npm install --save-dev wait-on@^8.0.0
```

**Note on UI Library**: Install after PLAN-000 decision approval. If shadcn/ui chosen, install Tailwind CSS and Radix UI primitives.

**Evidence**: Standard Electron + React + TypeScript dependency versions (December 2025)  
**Done When**: All dependencies installed, `package-lock.json` created, `node_modules/` populated

---

### PLAN-003: Configure TypeScript

**Change Type**: create  
**File(s)**: `tsconfig.json`, `tsconfig.main.json`, `tsconfig.renderer.json`

**Instruction**:

1. Create **`tsconfig.json`** (base config):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  }
}
```

2. Create **`tsconfig.main.json`** (main process - Node.js):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist/main",
    "lib": ["ES2022"],
    "types": ["node"],
    "noEmit": false
  },
  "include": ["src/main/**/*"],
  "exclude": ["node_modules", "dist", "src/renderer"]
}
```

3. Create **`tsconfig.renderer.json`** (renderer process - Browser):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"],
  "exclude": ["node_modules", "dist", "src/main"]
}
```

**Evidence**: Electron two-process architecture requires separate TypeScript configs (research lines 209-221)  
**Done When**: Three TypeScript config files exist with correct compiler options for each context

---

### PLAN-004: Create Project Directory Structure

**Change Type**: create  
**File(s)**: Multiple directories under `src/`

**Instruction**:
Create this directory structure:

```
src/
├── main/                 # Main process (Node.js backend)
│   ├── main.ts          # Application entry point
│   ├── preload.ts       # Secure IPC bridge
│   ├── database/        # Database access layer (Phase 1)
│   ├── services/        # Business logic services (Phase 2+)
│   └── ipc/             # IPC handlers (Phase 3+)
├── renderer/            # Renderer process (React UI)
│   ├── index.html       # HTML entry point
│   ├── App.tsx          # Root React component
│   ├── main.tsx         # React DOM render entry
│   ├── components/      # Reusable UI components (Phase 3+)
│   ├── pages/           # Page-level components (Phase 3+)
│   └── styles/          # Global styles
├── shared/              # Shared types and utilities
│   ├── types/           # TypeScript type definitions
│   └── constants/       # Shared constants
└── assets/              # Static assets (icons, images)
```

Use `mkdir -p` to create all directories:
```bash
mkdir -p src/main/database src/main/services src/main/ipc
mkdir -p src/renderer/components src/renderer/pages src/renderer/styles
mkdir -p src/shared/types src/shared/constants
mkdir -p src/assets
```

**Evidence**: Standard Electron project structure from electron-react-boilerplate (research line 746-763)  
**Done When**: All directories exist, project structure matches above diagram

---

### PLAN-005: Create Minimal Electron Main Process

**Change Type**: create  
**File(s)**: `src/main/main.ts`

**Instruction**:
Create minimal Electron main process that launches a window:

```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false, // CRITICAL: security best practice
      sandbox: false, // Required for preload script access
    },
  });

  // In development, load from Vite dev server
  // In production, load from built files
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173'); // Vite default port
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

**Evidence**: 
- Research lines 777-782 document contextBridge security pattern
- `nodeIntegration: false` is critical security requirement (never enable)

**Done When**: `src/main/main.ts` exists with secure BrowserWindow configuration

---

### PLAN-006: Create Secure Preload Script

**Change Type**: create  
**File(s)**: `src/main/preload.ts`

**Instruction**:
Create preload script with contextBridge API exposure (secure IPC pattern):

```typescript
import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to renderer process
// NEVER expose entire ipcRenderer or Node.js APIs directly
contextBridge.exposeInMainWorld('electron', {
  // Example API - actual recipe APIs will be added in Phase 3
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  
  // Placeholder for future IPC channels (Phase 3+)
  // recipeAPI: {
  //   getAll: () => ipcRenderer.invoke('recipe:getAll'),
  //   save: (recipe: Recipe) => ipcRenderer.invoke('recipe:save', recipe),
  // },
});

// Type definition for window.electron (to be moved to shared/types in next step)
export type ElectronAPI = {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
};
```

**Evidence**: Research lines 767-782 document secure contextBridge pattern  
**Done When**: `src/main/preload.ts` exists with contextBridge exposing safe APIs only

---

### PLAN-007: Create TypeScript Type Definitions

**Change Type**: create  
**File(s)**: `src/shared/types/electron.d.ts`

**Instruction**:
Create type definitions for window.electron API:

```typescript
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
```

**Evidence**: TypeScript global augmentation pattern for Electron preload APIs  
**Done When**: `src/shared/types/electron.d.ts` exists with type-safe window.electron definition

---

### PLAN-008: Create Minimal React Renderer

**Change Type**: create  
**File(s)**: `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`

**Instruction**:

1. Create **`src/renderer/index.html`**:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SimpleKitchen</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

2. Create **`src/renderer/main.tsx`**:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

3. Create **`src/renderer/App.tsx`**:
```typescript
import React from 'react';

function App() {
  const { platform, versions } = window.electron;

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>SimpleKitchen</h1>
      <p>Intelligent cooking companion for just-in-time dinner decision support</p>
      
      <div style={{ marginTop: '2rem', opacity: 0.7, fontSize: '0.9rem' }}>
        <p>Platform: {platform}</p>
        <p>Electron: {versions.electron}</p>
        <p>Node: {versions.node}</p>
        <p>Chrome: {versions.chrome}</p>
      </div>
      
      <p style={{ marginTop: '2rem', fontStyle: 'italic' }}>
        Phase 0 scaffold complete. Recipe management features coming in Phase 1-6.
      </p>
    </div>
  );
}

export default App;
```

4. Create **`src/renderer/styles/global.css`**:
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  width: 100%;
  min-height: 100vh;
}
```

**Evidence**: Standard React 18 initialization with TypeScript  
**Done When**: Three files created, App component renders basic UI with Electron version info

---

### PLAN-009: Configure Vite Build (Renderer Process)

**Change Type**: create  
**File(s)**: `vite.config.ts`

**Instruction**:
Create Vite configuration for renderer process build:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
  },
});
```

**Additional Dependency** (install if not already done):
```bash
npm install --save-dev @vitejs/plugin-react@^4.3.0
```

**Evidence**: Standard Vite + React configuration with Electron-specific output directory  
**Done When**: `vite.config.ts` exists, Vite can build renderer process to `dist/renderer/`

---

### PLAN-010: Configure TypeScript Build (Main Process)

**Change Type**: modify  
**File(s)**: `package.json`

**Instruction**:
Add build scripts to `package.json`:

```json
{
  "scripts": {
    "build:main": "tsc -p tsconfig.main.json",
    "build:renderer": "vite build",
    "build": "npm run build:main && npm run build:renderer",
    "watch:main": "tsc -p tsconfig.main.json --watch",
    "watch:renderer": "vite",
    "dev": "concurrently \"npm run watch:main\" \"npm run watch:renderer\" \"wait-on http://localhost:5173 && electron dist/main/main.js\"",
    "start": "electron dist/main/main.js",
    "package": "npm run build && electron-builder"
  }
}
```

**Script Breakdown**:
- `build:main`: Compile main process TypeScript to `dist/main/`
- `build:renderer`: Build renderer process with Vite to `dist/renderer/`
- `build`: Full production build
- `watch:main`: Watch mode for main process (auto-recompile on changes)
- `watch:renderer`: Vite dev server with HMR
- `dev`: Development mode (runs all three in parallel)
- `start`: Launch built application
- `package`: Create distributable (Windows .exe, macOS .dmg, etc.)

**Evidence**: Standard Electron development workflow with concurrent builds  
**Done When**: All scripts defined, `npm run dev` launches application successfully

---

### PLAN-011: Configure Electron Builder (Packaging)

**Change Type**: create  
**File(s)**: `electron-builder.json`

**Instruction**:
Create electron-builder configuration for packaging:

```json
{
  "appId": "com.simplekitchen.app",
  "productName": "SimpleKitchen",
  "directories": {
    "output": "release",
    "buildResources": "assets"
  },
  "files": [
    "dist/**/*",
    "package.json"
  ],
  "mac": {
    "category": "public.app-category.lifestyle",
    "target": ["dmg", "zip"]
  },
  "win": {
    "target": ["nsis", "portable"]
  },
  "linux": {
    "target": ["AppImage", "deb"],
    "category": "Utility"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

**Evidence**: Standard electron-builder configuration for cross-platform packaging  
**Done When**: `electron-builder.json` exists, `npm run package` creates distributable for current platform

---

### PLAN-012: Configure ESLint

**Change Type**: create  
**File(s)**: `eslint.config.js`

**Instruction**:
Create ESLint configuration (ESLint v9 flat config format):

```javascript
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'react/react-in-jsx-scope': 'off', // Not needed in React 18+
      'react/prop-types': 'off', // Using TypeScript for prop types
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];
```

**Additional Dependencies**:
```bash
npm install --save-dev eslint-plugin-react@^7.37.0 eslint-plugin-react-hooks@^5.0.0
```

Add lint script to `package.json`:
```json
"scripts": {
  "lint": "eslint src/**/*.{ts,tsx}",
  "lint:fix": "eslint src/**/*.{ts,tsx} --fix"
}
```

**Evidence**: ESLint v9+ flat config format with TypeScript + React rules  
**Done When**: `eslint.config.js` exists, `npm run lint` executes without errors

---

### PLAN-013: Configure Prettier

**Change Type**: create  
**File(s)**: `.prettierrc`, `.prettierignore`

**Instruction**:

1. Create **`.prettierrc`**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "avoid"
}
```

2. Create **`.prettierignore`**:
```
node_modules/
dist/
release/
coverage/
*.db
package-lock.json
```

3. Add format scripts to `package.json`:
```json
"scripts": {
  "format": "prettier --write \"src/**/*.{ts,tsx,css}\"",
  "format:check": "prettier --check \"src/**/*.{ts,tsx,css}\""
}
```

**Evidence**: Standard Prettier configuration for TypeScript + React projects  
**Done When**: `.prettierrc` exists, `npm run format` formats all source files consistently

---

### PLAN-014: Configure Vitest (Unit Testing)

**Change Type**: create  
**File(s)**: `vitest.config.ts`

**Instruction**:
Create Vitest configuration:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Main process tests
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'src/**/*.test.ts'],
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
```

**Additional Dependencies**:
```bash
npm install --save-dev @vitest/coverage-v8@^2.0.0
```

Add test scripts to `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

**Evidence**: Vitest is modern, fast test runner with native TypeScript support  
**Done When**: `vitest.config.ts` exists, `npm test` runs (no tests yet, but framework ready)

---

### PLAN-015: Create Sample Unit Test

**Change Type**: create  
**File(s)**: `src/main/main.test.ts`

**Instruction**:
Create a simple smoke test to verify testing infrastructure:

```typescript
import { describe, it, expect } from 'vitest';

describe('Phase 0 Smoke Tests', () => {
  it('should confirm Node.js environment', () => {
    expect(typeof process).toBe('object');
    expect(process.versions.node).toBeDefined();
  });

  it('should confirm TypeScript transpilation', () => {
    const sum = (a: number, b: number): number => a + b;
    expect(sum(2, 3)).toBe(5);
  });
});
```

Run test:
```bash
npm test
```

Expected output: All tests pass.

**Evidence**: Confirms Vitest is correctly configured and can run TypeScript tests  
**Done When**: Test file exists, `npm test` executes and passes

---

### PLAN-016: Create README with Development Instructions

**Change Type**: create  
**File(s)**: `README.md`

**Instruction**:
Create project README:

```markdown
# SimpleKitchen

Intelligent cooking companion for just-in-time dinner decision support.

## Overview

SimpleKitchen lifts the cognitive load of deciding what to cook on busy weeknights, replacing decision fatigue and uncertainty with confidence and excitement through AI-powered conversational decision support.

## Project Status

**Current Phase**: Phase 0 - Technology Stack Scaffolding  
**Next Phase**: Phase 1 - Data Model & Persistence Foundation

See `thoughts/shared/plans/` for detailed implementation plans.

## Technology Stack

- **Framework**: Electron v39+ with React 18+ and TypeScript 5+
- **Database**: SQLite with better-sqlite3
- **Build Tool**: Vite (renderer) + TypeScript compiler (main)
- **Testing**: Vitest (unit/integration) + Playwright (E2E, future)
- **Linting/Formatting**: ESLint + Prettier

## Development Setup

### Prerequisites

- Node.js 20+ and npm 10+
- Git

### Installation

```bash
# Clone repository
git clone <repo-url>
cd simplekitchen

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Available Scripts

- `npm run dev` - Launch application in development mode with hot reload
- `npm run build` - Build production application
- `npm start` - Launch built application
- `npm run package` - Create distributable package for current platform
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run lint` - Check code for linting errors
- `npm run lint:fix` - Auto-fix linting errors
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Project Structure

```
simplekitchen/
├── src/
│   ├── main/           # Electron main process (Node.js backend)
│   ├── renderer/       # React UI (browser frontend)
│   └── shared/         # Shared types and utilities
├── dist/               # Build output
├── release/            # Packaged distributables
├── thoughts/           # Documentation, plans, specs
└── assets/             # Static assets
```

## Architecture

SimpleKitchen uses Electron's two-process architecture:

- **Main Process** (`src/main/`): Node.js backend handling database, business logic, and system APIs
- **Renderer Process** (`src/renderer/`): React UI running in Chromium
- **IPC Bridge** (`src/main/preload.ts`): Secure communication layer using contextBridge

## Development Workflow

1. Make changes to source files in `src/`
2. Vite hot-reloads renderer changes automatically
3. Main process changes require manual restart (or use watch mode)
4. Run `npm test` before committing
5. Run `npm run lint:fix && npm run format` to ensure code quality

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Building for Production

```bash
# Build application
npm run build

# Create distributable package
npm run package
```

Distributables will be created in `release/` directory:
- **macOS**: `.dmg` and `.zip`
- **Windows**: `.exe` installer and portable `.exe`
- **Linux**: `.AppImage` and `.deb`

## Contributing

See `thoughts/shared/plans/2025-12-25-Recipe-Collection-Management-MASTER.md` for implementation roadmap.

## License

MIT
```

**Evidence**: Standard README structure for Electron projects  
**Done When**: `README.md` exists with complete development instructions

---

### PLAN-017: Verify Application Builds and Launches

**Change Type**: verify  
**File(s)**: N/A (verification step)

**Instruction**:
Execute these verification steps in sequence:

1. **Clean build**:
   ```bash
   rm -rf dist/ node_modules/ package-lock.json
   npm install
   npm run build
   ```
   Expected: No TypeScript errors, `dist/main/` and `dist/renderer/` populated

2. **Launch built application**:
   ```bash
   npm start
   ```
   Expected: Electron window opens, shows "SimpleKitchen" title, displays platform/version info

3. **Development mode with hot reload**:
   ```bash
   npm run dev
   ```
   Expected: Electron window opens, Vite dev server running on port 5173
   
   Test hot reload: Edit `src/renderer/App.tsx` (change title text), save  
   Expected: UI updates without manual refresh

4. **Run tests**:
   ```bash
   npm test
   ```
   Expected: Sample test passes

5. **Run linting**:
   ```bash
   npm run lint
   ```
   Expected: No errors (warnings acceptable if minor)

6. **Run formatting check**:
   ```bash
   npm run format:check
   ```
   Expected: All files formatted correctly

7. **Create package** (optional, takes 2-5 minutes):
   ```bash
   npm run package
   ```
   Expected: Distributable created in `release/` for current platform

**Evidence**: Manual verification confirms all tooling works correctly  
**Done When**: All 7 verification steps pass successfully

---

## Verification Tasks

**No assumptions in Phase 0** - all tooling is standard and well-documented. No custom business logic yet.

## Acceptance Criteria

**Phase 0 Complete When:**

- [ ] All technology decisions documented in `PLAN-000` decision log
- [ ] User has approved technology stack (or requested modifications applied)
- [ ] Project initializes with `npm install` without errors
- [ ] Application builds with `npm run build` without TypeScript errors
- [ ] Application launches with `npm start` showing minimal UI
- [ ] Development mode works with `npm run dev` and hot reload functions
- [ ] Tests run with `npm test` (sample test passes)
- [ ] Linting works with `npm run lint` (no errors)
- [ ] Formatting works with `npm run format` (all files formatted)
- [ ] README documents development workflow clearly
- [ ] `.gitignore` prevents committing build artifacts and dependencies
- [ ] Project structure follows Electron two-process architecture pattern

## Implementor Checklist

Execute in this exact order:

- [ ] PLAN-000: Create decision resolution document
- [ ] **GATE**: Wait for user approval of technology decisions
- [ ] PLAN-001: Initialize Node.js project
- [ ] PLAN-002: Install core dependencies
- [ ] PLAN-003: Configure TypeScript (3 config files)
- [ ] PLAN-004: Create project directory structure
- [ ] PLAN-005: Create minimal Electron main process
- [ ] PLAN-006: Create secure preload script
- [ ] PLAN-007: Create TypeScript type definitions
- [ ] PLAN-008: Create minimal React renderer (3 files)
- [ ] PLAN-009: Configure Vite build (renderer)
- [ ] PLAN-010: Configure TypeScript build (main) and add npm scripts
- [ ] PLAN-011: Configure Electron Builder (packaging)
- [ ] PLAN-012: Configure ESLint
- [ ] PLAN-013: Configure Prettier
- [ ] PLAN-014: Configure Vitest
- [ ] PLAN-015: Create sample unit test
- [ ] PLAN-016: Create README
- [ ] PLAN-017: Verify application builds and launches (7 sub-checks)

**Total Tasks**: 18 (1 decision gate + 17 implementation tasks)

---

## Next Phase

After Phase 0 completion, proceed to:

**Phase 1**: Data Model & Persistence Foundation  
**Plan File**: `2025-12-25-Recipe-Collection-Phase1-Data-Persistence.md`

Phase 1 will implement:
- SQLite database initialization with durability configuration
- Schema.org-aligned Recipe and Ingredient tables
- Dietary Profile configuration
- Type-safe database access layer
- Unit tests for CRUD operations

---

**End of Phase 0 Plan**
