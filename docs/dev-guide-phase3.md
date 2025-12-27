# Phase 3: Manual Recipe Entry - Developer Guide

## Overview

Phase 3 delivers the first complete user journey: manual recipe entry through a React form UI with IPC communication to the Electron main process.

## Architecture

### IPC Communication Flow

1. User interacts with RecipeForm (renderer process)
2. Form submits data via `window.electron.recipeAPI.create()`
3. Preload script (`src/main/preload.ts`) bridges to main process via `ipcRenderer.invoke('recipe:create')`
4. Main process handler (`src/main/ipc/recipe-handlers.ts`) receives request
5. Handler calls validation system and DAL
6. Response returned to renderer with success/errors
7. Renderer displays result

### Component Hierarchy

```
App
└── AddRecipePage
    └── RecipeForm (orchestrator)
        ├── ValidationErrors
        ├── RecipeBasicInfo
        │   ├── Input (title, cooking time, prep time)
        │   └── Select (cookware type)
        ├── RecipeDietaryTags
        │   └── Checkbox[] (7 dietary tags)
        ├── RecipeSeasonality
        │   └── Checkbox[] (5 seasons)
        ├── IngredientList
        │   ├── IngredientRow[] (dynamic)
        │   └── Button (add ingredient)
        ├── Textarea (instructions)
        └── Button (submit)
```

## Key Components

### RecipeForm (`src/renderer/components/RecipeForm/RecipeForm.tsx`)

- Main orchestrator component
- Manages all form state
- Handles submission and error display
- Resets form on success

### IPC Handler (`src/main/ipc/recipe-handlers.ts`)

- Handles `recipe:create` IPC channel
- Calls validation and DAL
- Parses validation errors into structured format
- Returns success/error response

### Ingredient Classifier (`src/renderer/utils/ingredient-classifier.ts`)

- Determines dietary properties for ingredients
- Used during form submission to classify ingredients
- Syncs with main process ingredient database

## Testing Strategy

### Unit Tests

- `recipe-handlers.test.ts`: IPC handler logic and error parsing
- `ingredient-classifier.test.ts`: Dietary property determination

### Integration Tests

- `RecipeForm.test.tsx`: Full form submission flow with mocked IPC

### E2E Tests

- `e2e/manual-entry.spec.ts`: End-to-end workflow with real Electron app

## Running Tests

```bash
# All tests
npm run test:all

# Unit tests only
npm run test:unit

# Integration tests only (renderer components)
npm run test:integration

# E2E tests only
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

## Development Workflow

```bash
# Install dependencies
npm install

# Run in development mode (hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run linter
npm run lint

# Format code
npm run format
```

## Common Issues

### Issue: Tailwind classes not applying

**Solution**: Ensure PostCSS config is correct, restart Vite dev server

### Issue: IPC calls return undefined

**Solution**:

1. Check preload script is loaded in BrowserWindow options
2. Verify contextBridge exposes API correctly
3. Check TypeScript types match between preload and electron.d.ts

### Issue: Validation errors not displaying

**Solution**: Verify error parsing in `recipe-handlers.ts` matches validation error format from `validator.ts`

### Issue: Form state not updating

**Solution**: Check that state setters are called correctly, especially for nested objects/arrays

## Architecture Decisions

### Why IPC instead of direct database access?

- Security: Renderer process should not have direct database access
- Separation of concerns: Main process handles all business logic
- Type safety: IPC boundaries enforce clean interfaces

### Why Tailwind CSS?

- Rapid UI development without custom CSS files
- Consistent design system
- Small bundle size (only used classes are included)

### Why separate components for form sections?

- Maintainability: Each section is independently testable
- Reusability: Components can be reused in edit forms (Phase 4+)
- Clarity: Clear separation of concerns

## Next Steps (Phase 4+)

- Recipe viewing and filtering UI
- Recipe editing (UPDATE operation)
- Recipe deletion UI
- Advanced search and filtering
- AI-powered recipe generation (Phase 5)
- Web import functionality (Phase 6)

## Contributing

When adding features:

1. Follow existing component patterns
2. Add TypeScript types for all props and state
3. Write unit/integration tests
4. Update documentation
5. Test manually before committing
