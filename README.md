# SimpleKitchen

Intelligent cooking companion for just-in-time dinner decision support.

## Overview

SimpleKitchen lifts the cognitive load of deciding what to cook on busy weeknights, replacing decision fatigue and uncertainty with confidence and excitement through AI-powered conversational decision support.

## Project Status

**Current Phase**: Phase 6 - Web Recipe Import (Complete)

**Completed Phases:**

- ✅ Phase 0: Technology Stack Scaffolding
- ✅ Phase 1: Data Model & Persistence Foundation
- ✅ Phase 2: Constraint Validation System
- ✅ Phase 3: Manual Recipe Entry UI with E2E Tests
- ✅ Phase 4: Recipe Viewing & Filtering
- ✅ Phase 5: AI-Powered Recipe Generation
- ✅ Phase 6: Web Recipe Import

See `thoughts/shared/plans/` for detailed implementation plans.

## Technology Stack

- **Framework**: Electron v39+ with React 18+ and TypeScript 5+
- **Database**: SQLite with dual-client architecture
  - Production: better-sqlite3 (native performance)
  - Testing: sql.js (pure JavaScript, no native compilation)
- **Build Tool**: Vite (renderer) + TypeScript compiler (main)
- **Testing**: Vitest (unit/integration) + Playwright (E2E)
- **Linting/Formatting**: ESLint + Prettier

## Development Setup

### Prerequisites

- Node.js 22+ and npm 10+
- Git

**Note**: This project requires Node.js 22.x to match Electron 39's internal Node.js version. Use `nvm` or `fnm` to manage Node.js versions.

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

## AI Recipe Generation Setup (Phase 5)

SimpleKitchen uses OpenAI's GPT-4o-mini to generate recipes based on your criteria.

### 1. Obtain API Key

1. Sign up at [OpenAI Platform](https://platform.openai.com/)
2. Create an API key at [API Keys](https://platform.openai.com/api-keys)
3. Copy the key (starts with `sk-proj-...`)

### 2. Configure

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your key:

   ```
   OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_KEY
   ```

3. Restart the app

**⚠️ IMPORTANT**: Never commit the `.env` file. It's already in `.gitignore`.

### Cost

AI generation costs ~$0.001 per recipe (less than 1/10th of a cent).

For detailed usage instructions, see [User Guide: AI Recipe Generation](docs/user-guide-ai-generation.md).

## Web Recipe Import Setup (Phase 6)

SimpleKitchen can import recipes directly from web sources using Schema.org structured data, eliminating the need for manual entry.

### Supported Websites

SimpleKitchen works with any website that implements Schema.org Recipe markup, including:

- Food blogs and recipe websites (AllRecipes, Serious Eats, Budget Bytes, etc.)
- Cooking platforms (Food Network, Tasty, etc.)
- Many other recipe sources that include structured recipe data

See [User Guide: Web Recipe Import](docs/user-guide-web-import.md) for a complete list of tested websites.

### How to Use

1. Find a recipe on a supported website
2. Copy the recipe URL
3. In SimpleKitchen, go to **"Import Recipe"**
4. Paste the URL and click **"Import"**
5. Review the imported recipe details and save

The import feature automatically extracts ingredients, cooking times, servings, and dietary information from the recipe page.

### Schema.org Compatibility

Web import relies on Schema.org Recipe markup embedded in web pages. Most modern recipe websites include this data, enabling reliable automated recipe extraction.

For detailed setup and troubleshooting, see [User Guide: Web Recipe Import](docs/user-guide-web-import.md).

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

SimpleKitchen uses a dual-client database architecture to avoid native module issues in testing:

- **Production**: Uses better-sqlite3 (native module with superior performance)
- **Testing**: Uses sql.js (pure JavaScript SQLite compiled to WebAssembly)
- **Abstraction**: `IDatabaseClient` interface ensures identical behavior

This approach provides:

- ✅ Fast test execution without native module rebuilds
- ✅ CI/CD compatibility (no C++ compilation required for tests)
- ✅ Identical SQL behavior between test and production environments
- ✅ Native performance in production builds

```bash
# Run all tests (uses sql.js automatically)
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run E2E tests (uses real Electron with better-sqlite3)
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

**Note**: Unit tests (`npm test`) use sql.js and require no native module setup. E2E tests and `npm run dev` use better-sqlite3 and will automatically rebuild via the postinstall hook.

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
