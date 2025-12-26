# State: Phase 3 - Manual Recipe Entry

**Plan**: thoughts/shared/plans/2025-12-26-Recipe-Collection-Phase3-Manual-Entry.md  
**Current Task**: PLAN-301  
**Completed Tasks**: (none yet)

## Quick Verification

After completing Phase 3, verify with these commands:

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test:all

# Start application in dev mode
npm run dev

# Build and run production
npm run build && npm start
```

## Manual Verification Checklist

After implementation, perform these manual tests:

- [ ] VERIFY-301: Launch app, form renders correctly
- [ ] VERIFY-302: Submit valid recipe, success message shown, form resets
- [ ] VERIFY-303: Submit invalid recipe (cookingTime=60, ingredient=butter), validation errors shown
- [ ] VERIFY-304: Add/remove ingredients, minimum 1 row enforced
- [ ] VERIFY-305: All unit and integration tests pass
- [ ] VERIFY-306: E2E test passes
- [ ] VERIFY-307: Recipe persists in database after app restart

## Phase Status

**Started**: (not started)  
**Completed**: (not completed)  
**Total Tasks**: 42 (35 implementation + 7 verification)  
**Completed**: 0 / 42

## Task Progress

### IPC Infrastructure (Priority 1 - Critical Path)
- [ ] PLAN-301: Add RecipeAPI to electron.d.ts
- [ ] PLAN-302: Create recipe IPC handlers
- [ ] PLAN-303: Create IPC index barrel export
- [ ] PLAN-304: Register handlers in main.ts
- [ ] PLAN-305: Expose recipeAPI in preload.ts

### Common Components (Priority 2)
- [ ] PLAN-306: Create Button component
- [ ] PLAN-307: Create Input component
- [ ] PLAN-308: Create Select component
- [ ] PLAN-309: Create Checkbox component
- [ ] PLAN-329: Create common components barrel export

### Form Components (Priority 3)
- [ ] PLAN-310: Create IngredientRow component
- [ ] PLAN-311: Create IngredientList component
- [ ] PLAN-312: Create RecipeBasicInfo component
- [ ] PLAN-313: Create RecipeDietaryTags component
- [ ] PLAN-314: Create RecipeSeasonality component
- [ ] PLAN-315: Create ValidationErrors component
- [ ] PLAN-316: Create RecipeForm component (orchestrator)
- [ ] PLAN-317: Create ingredient-classifier utility
- [ ] PLAN-318: Create AddRecipePage
- [ ] PLAN-319: Update App.tsx
- [ ] PLAN-328: Create RecipeForm barrel export

### Styling & Configuration (Priority 2 - Can run in parallel with Priority 3)
- [ ] PLAN-320: Update global.css with Tailwind
- [ ] PLAN-321: Create tailwind.config.js
- [ ] PLAN-322: Create postcss.config.js
- [ ] PLAN-323: Install Tailwind dependencies

### Testing (Priority 4 - After implementation)
- [ ] PLAN-324: Create RecipeForm integration test
- [ ] PLAN-325: Create recipe-handlers unit test
- [ ] PLAN-326: Create ingredient-classifier test
- [ ] PLAN-330: Install testing libraries
- [ ] PLAN-331: Configure Vitest for React
- [ ] PLAN-332: Create E2E test
- [ ] PLAN-333: Install Playwright
- [ ] PLAN-335: Update package.json scripts

### Documentation (Priority 5 - Final)
- [ ] PLAN-327: Create user documentation
- [ ] PLAN-334: Create developer documentation

### Verification
- [ ] VERIFY-301: Verify form renders
- [ ] VERIFY-302: Verify valid recipe creation
- [ ] VERIFY-303: Verify validation errors
- [ ] VERIFY-304: Verify ingredient add/remove
- [ ] VERIFY-305: Verify unit/integration tests
- [ ] VERIFY-306: Verify E2E test
- [ ] VERIFY-307: Verify database persistence

## Notes

- Phase 3 created: 2025-12-26
- Depends on: Phase 0 (complete), Phase 1 (complete), Phase 2 (complete)
- Milestone: MVP 1 - Users can manually add constraint-compliant recipes
- Next phase: Phase 4 - Recipe Viewing & Filtering

## Blockers

(none currently)

## Implementation Strategy

**Sequential Dependencies:**
1. Complete IPC Infrastructure (PLAN-301 to PLAN-305) FIRST
2. Then work on Components and Styling in parallel
3. Then Testing
4. Finally Documentation and Verification

**Recommended Order:**
1. PLAN-301 to PLAN-305 (IPC) - CRITICAL PATH
2. PLAN-323 (install Tailwind) - needed for components
3. PLAN-320 to PLAN-322 (Tailwind config)
4. PLAN-306 to PLAN-309, PLAN-329 (common components)
5. PLAN-310 to PLAN-318, PLAN-328 (form components)
6. PLAN-319 (wire up App.tsx)
7. PLAN-330 to PLAN-333, PLAN-335 (testing setup)
8. PLAN-324 to PLAN-326 (write tests)
9. PLAN-327, PLAN-334 (documentation)
10. VERIFY-301 to VERIFY-307 (manual verification)

## Acceptance Criteria Mapping

This phase addresses:
- [x] Epic Functional AC 1: Manual recipe entry (Primary goal)
- [x] Epic Functional AC 4: Dietary validation with errors
- [x] Epic Functional AC 5: Time/cookware validation
- [x] Epic Technical AC 1: Schema.org-aligned (via Phase 1 DAL)
- [x] Epic Technical AC 4: Validation before persistence
- [x] Epic Quality AC 2: Integration tests for manual entry

## Risk Register

**Risk 1**: IPC type mismatches between preload and electron.d.ts  
**Mitigation**: TypeScript strict mode will catch these at compile time  
**Status**: Monitoring

**Risk 2**: Complex form state management in RecipeForm  
**Mitigation**: Thoroughly test add/remove ingredients (VERIFY-304)  
**Status**: Monitoring

**Risk 3**: Tailwind CSS not processing correctly in Electron  
**Mitigation**: Verify PostCSS config early, test in dev mode  
**Status**: Monitoring
