# State: Phase 5 - AI-Powered Recipe Generation

**Plan**: thoughts/shared/plans/2025-12-29-Recipe-Collection-Phase5-AI-Generation.md  
**Current Task**: PLAN-518  
**Completed Tasks**: PLAN-501, PLAN-502, PLAN-503, PLAN-504, PLAN-505, PLAN-506, PLAN-507, PLAN-508, PLAN-509, PLAN-510, PLAN-511, PLAN-512, PLAN-513, PLAN-514, PLAN-515, PLAN-516, PLAN-517

## Quick Verification

After completing Phase 5, verify with these commands:

```bash
# Set up API key (one-time)
cp .env.example .env
# Edit .env and add your OpenAI API key

# Run all tests (should pass with mocks)
npm run test:all

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Start application in dev mode
npm run dev

# Type checking
npm run typecheck

# Build for production
npm run build
```

## Manual Verification Checklist

- [ ] VERIFY-501: Recipe generation works end-to-end
- [ ] VERIFY-502: Rate limit error handling works
- [ ] VERIFY-503: Invalid API key error handling works
- [ ] VERIFY-504: Network failure error handling works
- [ ] VERIFY-505: All unit tests pass
- [ ] VERIFY-506: All integration tests pass
- [ ] VERIFY-507: All E2E tests pass
- [ ] VERIFY-508: Documentation is accurate

## Phase Status

**Started**: 2025-12-29  
**Completed**: (pending)  
**Depends On**: Phase 0, 1, 2, 3, 4 MUST be complete  
**Total Tasks**: 26 (18 implementation + 8 verification)  
**Completed**: 17 / 26 (65%)

## Task Progress

### Setup & Dependencies (Priority 1 - CRITICAL PATH)

- [x] PLAN-501: Install OpenAI SDK and Zod
- [x] PLAN-502: Create .env.example template

### Schema & Types (Priority 1 - CRITICAL PATH)

- [x] PLAN-503: Create Zod schema for recipe generation
- [x] PLAN-504: Create recipe generation criteria types

### AI Service Layer (Priority 1 - CRITICAL PATH)

- [x] PLAN-505: Create OpenAI recipe generator service
- [x] PLAN-506: Create IPC handler for recipe generation
- [x] PLAN-507: Register AI handlers in main.ts

### IPC Bridge (Priority 1 - CRITICAL PATH)

- [x] PLAN-508: Update preload.ts to expose generateRecipe
- [x] PLAN-509: Update electron.d.ts with generateRecipe type

### UI (Priority 2)

- [x] PLAN-510: Create RecipeGenerationPage component
- [x] PLAN-511: Update App.tsx navigation

### Testing (Priority 3)

- [x] PLAN-512: Create unit tests for Zod schema
- [x] PLAN-513: Create unit tests for recipe generator (mocked)
- [x] PLAN-514: Create integration test for IPC handler (mocked)
- [x] PLAN-515: Create E2E test for AI workflow (mocked)

### Documentation (Priority 4)

- [x] PLAN-516: Create user documentation
- [x] PLAN-517: Create developer documentation
- [ ] PLAN-518: Add README section for API key setup

### Verification (Priority 5 - FINAL)

- [ ] VERIFY-501: Verify recipe generation end-to-end
- [ ] VERIFY-502: Verify error handling for rate limits
- [ ] VERIFY-503: Verify error handling for invalid API key
- [ ] VERIFY-504: Verify error handling for network failure
- [ ] VERIFY-505: Verify all unit tests pass
- [ ] VERIFY-506: Verify all integration tests pass
- [ ] VERIFY-507: Verify all E2E tests pass
- [ ] VERIFY-508: Verify documentation accuracy

## Notes

- Phase 5 created: 2025-12-29
- Depends on: Phase 0 (complete), Phase 1 (complete), Phase 2 (complete), Phase 3 (complete), Phase 4 (complete)
- Milestone: MVP 3 - Users can generate recipes via AI
- Next phase: Phase 6 - Web Recipe Import

## Blockers

(none currently)

## Implementation Strategy

**Sequential Dependencies:**

1. **MUST complete first** (Priority 1 - CRITICAL PATH):
   - PLAN-501 to PLAN-509 (Setup, Schema, AI Service, IPC Bridge)
   - These tasks are sequential and must be done in order

2. **Then** (Priority 2):
   - PLAN-510 to PLAN-511 (UI components)

3. **Then** (Priority 3):
   - PLAN-512 to PLAN-515 (Tests - can run in parallel)

4. **Then** (Priority 4):
   - PLAN-516 to PLAN-518 (Documentation - can run in parallel)

5. **Finally** (Priority 5):
   - VERIFY-501 to VERIFY-508 (Verification)

**Recommended Order:**

1. PLAN-501, PLAN-502 (Setup dependencies and env template)
2. PLAN-503, PLAN-504 (Define schemas and types)
3. PLAN-505 (AI service - core logic)
4. PLAN-506, PLAN-507 (IPC integration)
5. PLAN-508, PLAN-509 (IPC bridge)
6. PLAN-510, PLAN-511 (UI)
7. PLAN-512 to PLAN-515 (Tests - parallel)
8. PLAN-516 to PLAN-518 (Docs - parallel)
9. VERIFY-501 to VERIFY-508 (Manual verification)

## Acceptance Criteria Mapping

This phase addresses:

- [ ] Epic Functional AC 2: AI recipe generation with review and save
- [ ] Epic Technical AC 1-4: Schema compliance and validation
- [ ] Epic Quality AC 2: Integration tests for AI acquisition mode

## Risk Register

**Risk 1**: OpenAI API costs during development  
**Mitigation**: Mock all tests, gate integration tests behind env var  
**Status**: Monitoring

**Risk 2**: AI generates constraint-violating recipes  
**Mitigation**: Strict Zod schema, emphatic prompts, belt-and-suspenders validation  
**Status**: Low risk (multiple layers of defense)

**Risk 3**: API key leakage  
**Mitigation**: .env in .gitignore, IPC sender validation, security docs  
**Status**: Low risk (standard best practices)

**Risk 4**: Poor AI output quality  
**Mitigation**: Prompt engineering, user review step, temperature tuning  
**Status**: Monitoring (subjective quality check in VERIFY-501)

**Risk 5**: Network/API unavailability  
**Mitigation**: Error handling, retry capability, graceful degradation  
**Status**: Low risk (tested in VERIFY-504)

## Definition of Done

Phase 5 is complete when:

- [ ] All 18 implementation tasks complete
- [ ] All 8 verification tasks pass
- [ ] All automated tests pass (unit, integration, E2E)
- [ ] User can generate recipe via AI in <30 seconds
- [ ] Generated recipes comply with all constraints
- [ ] Errors display clearly with retry capability
- [ ] Documentation exists and is accurate
- [ ] Code is type-safe (TypeScript compiles without errors)
- [ ] Code is committed and tests pass in CI

## Cost Tracking

**Development Budget** (recommended):

- Budget: $5 during development (500+ test generations)
- Set budget alert in OpenAI dashboard: https://platform.openai.com/account/billing

**Per-Recipe Cost**:

- gpt-4o-mini: ~$0.001 per recipe
- With caching (future): ~$0.0006 per recipe

**Monitor Usage**:

- Dashboard: https://platform.openai.com/account/usage
- Check weekly during Phase 5 development

## Security Checklist

- [ ] API key in .env (not committed)
- [ ] .env in .gitignore (verify)
- [ ] IPC sender validation implemented
- [ ] API key never exposed to renderer process
- [ ] contextIsolation enabled in BrowserWindow
- [ ] nodeIntegration disabled in renderer
- [ ] preload.ts uses contextBridge

## Performance Targets

**AI Recipe Generation:**

- API call latency: 5-15 seconds (typical)
- Timeout: 30 seconds (configured)
- User experience: Loading spinner, no blocking

**Testing Performance:**

- Unit tests (mocked): <100ms per test
- Integration tests (real API): ~10-15 seconds per test
- E2E tests (mocked): <5 seconds per test

## What's New in Phase 5

✅ OpenAI SDK integration with Structured Outputs  
✅ Zod schema for type-safe AI responses  
✅ Recipe generation with custom criteria  
✅ User review/edit workflow  
✅ Comprehensive error handling (rate limit, network, auth, timeout)  
✅ Belt-and-suspenders validation  
✅ Cost-effective gpt-4o-mini model  
✅ Security best practices for API key management  
✅ Mocked tests (zero API cost)

## What Was Already Done in Previous Phases

✅ Recipe CRUD operations (Phase 3)  
✅ Constraint validation system (Phase 2)  
✅ Recipe viewing and filtering (Phase 4)  
✅ Database schema and DAL (Phase 1)  
✅ Project structure and tooling (Phase 0)

## Dependencies on Existing Code

**Reused Components:**

- `createRecipe()` DAL function (Phase 1)
- `validateRecipe()` validation system (Phase 2)
- `RecipeForm` component (Phase 3)
- IPC handler pattern (Phase 3, 4)
- Type definitions (`CreateRecipeInput`, `Recipe`, etc.)

**Integration Points:**

- AI-generated recipes use `sourceType: 'ai-generated'`
- Validation runs identically for manual/AI/web recipes
- Recipe saved via same DAL as manual entry
- Recipe appears in collection with same viewing/filtering

## Testing Strategy Summary

**Unit Tests** (PLAN-512, PLAN-513):

- Mock OpenAI SDK completely
- Test schema validation
- Test error handling for all error types
- Test prompt construction
- Zero API cost

**Integration Tests** (PLAN-514):

- Mock OpenAI SDK
- Test IPC handler orchestration
- Test sender validation
- Test belt-and-suspenders validation
- Zero API cost

**E2E Tests** (PLAN-515):

- Mock `window.electronAPI.generateRecipe()`
- Test full UI workflow
- Test error display and retry
- Zero API cost

**Real API Testing** (optional, gated):

- Create separate `ai-real.test.ts` file
- Gate with `describe.skipIf(!process.env.OPENAI_API_KEY)`
- Run manually or in CI with env var set
- Monitor cost

## Documentation Checklist

- [ ] User guide for AI generation (PLAN-516)
- [ ] Developer guide for Phase 5 (PLAN-517)
- [ ] README setup section (PLAN-518)
- [ ] .env.example with clear instructions (PLAN-502)
- [ ] Code comments in complex areas (prompts, error handling)

## Pre-Flight Checklist

Before starting Phase 5, verify:

- [x] Phase 4 is complete (STATE file shows COMPLETE)
- [x] All Phase 4 tests pass
- [x] Database has recipes (can seed with `npm run seed:db`)
- [ ] OpenAI account created (free tier OK)
- [ ] OpenAI API key obtained
- [ ] Budget alert set in OpenAI dashboard

## Post-Phase Checklist

After completing Phase 5, verify:

- [ ] All tasks checked off
- [ ] All verification tasks pass
- [ ] Tests pass: `npm run test:all`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Manual testing complete (VERIFY-501 to VERIFY-504)
- [ ] Documentation reviewed (VERIFY-508)
- [ ] Code committed
- [ ] STATE file updated with completion date

## Common Issues and Solutions

### "Cannot find module 'openai'"

**Solution**: Run `npm install openai zod` (PLAN-501)

### "OPENAI_API_KEY is not defined"

**Solution**: Create `.env` file with API key (PLAN-502)

### "TypeError: Cannot read property 'parsed' of undefined"

**Cause**: Mock not set up correctly in tests  
**Solution**: Verify `vi.mock('openai')` includes `parse` method

### Generated recipes fail validation

**Cause**: Mismatch between prompt constraints and Zod schema  
**Solution**: Review PLAN-505 system prompt, ensure it matches schema constraints

### Tests timeout

**Cause**: Real API calls instead of mocks  
**Solution**: Verify mocks are set up before tests run (`beforeEach`)

### API key exposed in logs

**Cause**: Logging too verbosely  
**Solution**: Never log `process.env.OPENAI_API_KEY` or OpenAI client object

## Ready to Begin?

1. ✅ Phase 4 complete
2. ✅ Plan reviewed and understood
3. ⏳ OpenAI API key ready
4. ⏳ Budget alert set
5. ⏳ Development environment ready

**Next Step**: Execute PLAN-501 (Install OpenAI SDK and Zod)
