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
