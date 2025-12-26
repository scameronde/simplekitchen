# Recipe Collection Management - Master Implementation Plan

## Inputs

- **Research Report**: `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md`
- **Epic**: `thoughts/shared/epics/2025-12-25-Recipe-Collection-Management.md`
- **Spec**: `thoughts/shared/specs/2025-12-25-SimpleKitchen.md`
- **User Request**: Implement all epics and stories in Recipe Collection Management

## Executive Summary

This master plan decomposes the Recipe Collection Management epic into 7 sequential phases, each with dedicated implementation plans. The epic is the foundational layer for SimpleKitchen, enabling users to build a curated, constraint-compliant recipe library through manual entry, AI generation, and web import.

**Critical Path**: Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 (MVP complete) → Phase 5 → Phase 6 → Phase 7

**Estimated Scope**: 7 detailed plans, approximately 150-200 action items total

## Verified Current State

**Fact:** This is a greenfield project with no existing codebase.  
**Evidence:** `list` output at project root shows only `thoughts/` directory with documentation and `.gitignore`. No `src/`, `package.json`, or implementation files exist.  
**Excerpt:** Output contains only: `thoughts/`, `.gitignore`

**Fact:** Research recommends SQLite with better-sqlite3 for persistence.  
**Evidence:** `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md:229-275`  
**Excerpt:** "SQLite with better-sqlite3 provides sub-millisecond query performance (<1ms for 1000+ recipes), full ACID durability with proper configuration"

**Fact:** Research recommends Electron with React for desktop application framework.  
**Evidence:** `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md:202-223`  
**Excerpt:** "Electron framework (v39+) enables cross-platform desktop applications using Chromium + Node.js, providing full npm ecosystem access"

**Fact:** 100% automated dietary validation is impossible; multi-layer strategy required.  
**Evidence:** `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md:99-109`  
**Excerpt:** "No automated solution (commercial API, database, or AI) achieves zero false negatives for dietary constraint validation. Spoonacular API provides 80-90% accuracy"

**Fact:** OpenAI Structured Outputs guarantees JSON schema adherence for AI generation.  
**Evidence:** `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md:136-173`  
**Excerpt:** "OpenAI's Structured Outputs feature (available on gpt-4o-2024-08-06+ models) provides JSON schema validation with guaranteed adherence"

**Fact:** recipe-scrapers Python library supports 220+ websites for web import.  
**Evidence:** `thoughts/shared/research/2025-12-25-Recipe-Collection-Management.md:177-197`  
**Excerpt:** "The recipe-scrapers Python library (2.1k GitHub stars, v15.11.0 December 2025) provides site-specific scrapers for 220+ recipe websites"

## Goals / Non-Goals

### Goals
- Deliver all 6 user stories from the epic (Manual Entry, AI Generation, Web Import, Dietary Validation, Viewing/Filtering, Persistence)
- Achieve 100% dietary constraint enforcement reliability through multi-layer validation + user review
- Support 1000+ recipe collections with <1 second query performance
- Enable cross-platform desktop application (Windows, macOS, Linux)
- Build foundation for future epics (Conversational Decision Support, Cooking History)

### Non-Goals
- Conversational AI interface (Epic 2)
- Cooking history tracking (Epic 3)
- Mobile application support (desktop only for MVP)
- Cloud synchronization (local-first per spec)
- Multi-user support (single-user system)
- Advanced recipe editing features (basic CRUD only)

## Design Overview - Phased Approach

### Phase 0: Technology Stack Selection & Project Scaffolding
**Purpose**: Resolve open technology decisions, initialize project structure, configure build tooling  
**Deliverables**: 
- Decision document for open questions (ingredient database approach, cookware constraint definition, etc.)
- Initialized Electron + React project with TypeScript
- Basic project structure (main process, renderer process, shared types)
- Development tooling (ESLint, Prettier, testing framework)

**Decision Gates**: 
- User approval of technology stack decisions (if default recommendations are not acceptable)

---

### Phase 1: Data Model & Persistence Foundation
**Purpose**: Implement SQLite database with Schema.org-aligned recipe data model  
**Deliverables**:
- SQLite database initialization with WAL mode + FULL synchronous durability
- Recipe table schema (aligned with Schema.org Recipe standard)
- Ingredient table schema (one-to-many relationship with Recipe)
- Dietary Profile configuration table
- Database access layer (DAL) with type-safe queries
- Unit tests for CRUD operations

**Dependencies**: Phase 0 complete

---

### Phase 2: Core Constraint Validation System
**Purpose**: Build multi-layer dietary and practical constraint validation  
**Deliverables**:
- Static ingredient database (curated lookup table for common ingredients)
- Dietary constraint validator (gluten-free, lactose-free checks)
- Time constraint validator (30-45 minutes)
- Cookware constraint validator (one-pot/pan/oven)
- Servings constraint validator (exactly 2)
- Validation error reporting with actionable messages
- Unit tests with 100% coverage for constraint logic

**Dependencies**: Phase 1 complete

---

### Phase 3: Manual Recipe Entry (First User Journey)
**Purpose**: Deliver end-to-end manual recipe entry workflow  
**Deliverables**:
- Recipe entry form UI (React components)
- Ingredient input with dynamic add/remove rows
- IPC handlers for main-renderer communication
- Integration with constraint validation
- Recipe storage via database layer
- Integration tests for full workflow

**Dependencies**: Phase 1 + Phase 2 complete

**Milestone**: MVP 1 - Users can manually add constraint-compliant recipes

---

### Phase 4: Recipe Viewing & Filtering
**Purpose**: Enable recipe collection browsing and filtering  
**Deliverables**:
- Recipe list/grid view UI
- Filter controls (time range, cookware type, dietary tags)
- Recipe detail view
- Database query layer for filtering
- Indexed queries for performance
- Load testing with 1000+ recipe synthetic dataset

**Dependencies**: Phase 3 complete

**Milestone**: MVP 2 - Users can browse and filter their recipe collection

---

### Phase 5: AI-Powered Recipe Generation
**Purpose**: Integrate OpenAI for recipe generation from user criteria  
**Deliverables**:
- OpenAI SDK integration with Structured Outputs
- Recipe generation UI (criteria input form)
- Zod schema matching Recipe data model
- AI-generated recipe validation workflow
- User review/edit step before storage
- Error handling for API failures
- Integration tests with mock AI responses

**Dependencies**: Phase 4 complete

**Milestone**: MVP 3 - Users can generate recipes via AI

---

### Phase 6: Web Recipe Import
**Purpose**: Enable import from external recipe websites  
**Deliverables**:
- Schema.org JSON-LD extraction (primary method)
- Optional: recipe-scrapers Python bridge for fallback
- URL input UI
- Recipe parsing and adaptation workflow
- Constraint violation detection with manual adaptation support
- User review/edit step before storage
- Integration tests with sample recipe HTML

**Dependencies**: Phase 5 complete

**Milestone**: MVP 4 - Users can import recipes from web sources

---

### Phase 7: Integration Testing & Performance Validation
**Purpose**: Verify all acceptance criteria and performance requirements  
**Deliverables**:
- End-to-end test suite covering all 6 user stories
- Performance benchmarks with 1000+ recipe dataset
- Security audit (SQLite injection prevention, secure IPC)
- User acceptance testing with sample recipes
- Documentation (README, user guide, developer setup)

**Dependencies**: Phase 6 complete

**Milestone**: Epic Complete - Ready for Epic 2 (Conversational Decision Support)

---

## Critical Decision Points (Requires Resolution in Phase 0)

### Decision 1: Ingredient Dietary Property Database Approach

**Options (from research):**
- **A**: Static curated table (~100 common ingredients) + user confirmation for unknowns
- **B**: Spoonacular API (80-90% accuracy) + mandatory user review
- **C**: User-editable database (start with zero knowledge)
- **D**: Hybrid (static + API fallback + user overrides)

**Recommendation**: **Option D (Hybrid)**  
**Rationale**: 
- Static table covers 80% of common ingredients (butter, flour, milk, etc.) with 100% known accuracy
- Spoonacular API fallback for less common ingredients (provides structured allergen data)
- User override capability for edge cases (e.g., "hard cheese is lactose-free for me")
- Mandatory user review before storage ensures zero false negatives

**Implementor Guidance**: 
- Phase 1: Implement static table with ~100 curated ingredients
- Phase 2: Build validation logic with static-first, API-fallback, user-review pattern
- Phase 5+: Optionally integrate Spoonacular API (can defer if budget constraint)

---

### Decision 2: Recipe Adaptation for Dietary Constraints

**Options (from research):**
- **A**: Reject non-compliant recipes entirely
- **B**: Suggest AI-powered substitutions + user confirmation
- **C**: Rule-based substitution engine

**Recommendation**: **Option A for MVP, B for future enhancement**  
**Rationale**:
- Spec states "validation should catch and reject" (lines 119, 318)
- Automatic substitution risks changing recipe character (gluten-free pasta ≠ wheat pasta)
- User can manually adapt during entry/import review step
- Future: Add AI-powered substitution suggestions in Phase 5+

**Implementor Guidance**: Phase 2 validation logic should REJECT recipes with constraint violations. Display clear error message: "Recipe contains [ingredient] which violates [constraint]. Please adapt the recipe manually or select a different one."

---

### Decision 3: Recipe Versioning and Edit History

**Options (from research):**
- **A**: Overwrite on edit (no history)
- **B**: Keep version history with timestamps
- **C**: Preserve original, create adapted copy

**Recommendation**: **Option A for MVP**  
**Rationale**:
- Spec does not explicitly require versioning
- Single-user local application minimizes risk of accidental data loss
- Version history adds complexity (storage, UI for history browsing)
- Re-validation on save prevents constraint violations (spec line 241)

**Implementor Guidance**: Implement recipe UPDATE operation as simple overwrite. Re-run full constraint validation before saving. If validation fails, reject update and show errors.

---

### Decision 4: Seasonality Data Source

**Options (from research):**
- **A**: User manually tags recipes with seasons
- **B**: Static calendar of seasonal ingredients
- **C**: Omit from MVP
- **D**: AI inference from ingredients

**Recommendation**: **Option A (User Manual Tags) for MVP**  
**Rationale**:
- Seasonality is soft preference, not hard constraint
- User knows their own cooking preferences better than automated system
- Simple implementation (collection of enum values: spring, summer, fall, winter, any)
- Can enhance with AI suggestions in future

**Implementor Guidance**: Phase 1 schema includes `seasonality` field as TEXT[] (array). Phase 3 manual entry form includes checkboxes for seasons. Default to "any" if not specified.

---

### Decision 5: Web Scraping Legal/Technical Constraints

**Options (from research):**
- **A**: User-driven import (user navigates, app extracts from loaded page)
- **B**: Automated scraping with rate limiting
- **C**: Commercial API only
- **D**: User copies HTML manually

**Recommendation**: **Option A (User-Driven) with Schema.org extraction**  
**Rationale**:
- Lowest legal risk (user voluntarily navigates to page)
- Technical feasibility (Electron can extract from loaded page via preload script)
- Respects website ToS (user interaction, not automated bot)
- Falls back gracefully if Schema.org markup missing

**Implementor Guidance**: Phase 6 implements "Import from URL" workflow:
1. User enters URL in app
2. App opens URL in hidden Electron BrowserWindow
3. Preload script extracts Schema.org JSON-LD from loaded page
4. Returns recipe data to main process
5. User reviews/adapts before saving

Alternative: User pastes HTML source, app parses locally (even lower risk).

---

### Decision 6: Cookware Type Constraint Definition

**Options (from research):**
- **A**: Single enum (mutually exclusive: one-pot OR one-pan OR oven, never multiple)
- **B**: Array allowing combinations (e.g., ["one-pan", "oven"])
- **C**: Threshold (≤2 cookware items allowed)

**Recommendation**: **Option A (Single Enum) for MVP**  
**Rationale**:
- Spec states "minimal cookware (one pot, one pan, or oven-based)" as mutually exclusive options (spec line 48)
- Mission goal is simplicity: "minimal cookware to make home cooking achievable" (spec line 32)
- Pan-to-oven recipes can be categorized as "one-pan" (the pan goes in oven, still one piece of cookware)

**Implementor Guidance**: Phase 1 schema defines `cookware_type` as ENUM('one-pot', 'one-pan', 'oven'). Phase 2 validation rejects recipes that don't specify exactly one value. Phase 3 UI uses radio buttons (single selection).

---

### Decision 7: Performance Testing Dataset

**Recommendation**: Create synthetic dataset generator in Phase 4  
**Implementor Guidance**: 
- Phase 4 includes task to generate 1000-2000 realistic recipes programmatically
- Use OpenAI API to generate recipes in batch (cost: ~$0.50-$1.00)
- Populate database, run load tests, measure query performance
- Document performance baseline for future regression testing

---

## Phased Plan Files (To Be Created)

Each phase will have its own detailed implementation plan:

1. **`2025-12-25-Recipe-Collection-Phase0-Stack-Selection.md`**
   - Decision resolution document
   - Project scaffolding tasks
   - ~15-20 action items

2. **`2025-12-25-Recipe-Collection-Phase1-Data-Persistence.md`**
   - Database schema implementation
   - Data access layer
   - ~20-25 action items

3. **`2025-12-25-Recipe-Collection-Phase2-Constraint-Validation.md`**
   - Multi-layer validation system
   - Static ingredient database
   - ~25-30 action items

4. **`2025-12-25-Recipe-Collection-Phase3-Manual-Entry.md`**
   - First complete user journey
   - UI + IPC + storage integration
   - ~20-25 action items

5. **`2025-12-25-Recipe-Collection-Phase4-Viewing-Filtering.md`**
   - Recipe browsing and filtering
   - Performance optimization
   - ~15-20 action items

6. **`2025-12-25-Recipe-Collection-Phase5-AI-Generation.md`**
   - OpenAI integration
   - Structured Outputs implementation
   - ~20-25 action items

7. **`2025-12-25-Recipe-Collection-Phase6-Web-Import.md`**
   - Schema.org extraction
   - User-driven import workflow
   - ~20-25 action items

8. **`2025-12-25-Recipe-Collection-Phase7-Integration-Testing.md`**
   - End-to-end testing
   - Performance validation
   - ~15-20 action items

**Total Estimated Action Items**: ~150-200 across all phases

---

## Implementation Strategy (For Implementor)

### Sequential vs Parallel Execution

**Sequential Dependencies (MUST follow order):**
- Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

**Within each phase**: Tasks can be parallelized where independent (e.g., UI components and database queries can be developed concurrently if schemas are finalized).

### Verification Strategy

**After each phase**:
1. Run all tests (unit + integration)
2. Manually verify phase deliverables against acceptance criteria
3. Update progress in corresponding STATE file
4. Proceed to next phase only if current phase is verified complete

**Phase Milestones**:
- **MVP 1** (end of Phase 3): Can add recipes manually
- **MVP 2** (end of Phase 4): Can browse/filter recipes
- **MVP 3** (end of Phase 5): Can generate recipes via AI
- **MVP 4** (end of Phase 6): Can import recipes from web
- **Epic Complete** (end of Phase 7): All acceptance criteria met

---

## Technology Stack Summary (Pending Phase 0 Final Approval)

### Frontend
- **Framework**: React 18+ with TypeScript
- **UI Library**: TBD in Phase 0 (options: Material-UI, Ant Design, shadcn/ui, or custom CSS)
- **State Management**: React Context API or Zustand (TBD based on complexity)
- **Forms**: React Hook Form with Zod validation

### Backend (Electron Main Process)
- **Runtime**: Node.js 20+ (bundled with Electron)
- **Database**: SQLite 3 with better-sqlite3 binding
- **ORM/Query Builder**: TBD (options: Kysely, Drizzle, raw SQL with type generation)

### AI Integration
- **Primary**: OpenAI GPT-4o-mini with Structured Outputs
- **SDK**: openai-node v6.15.0+
- **Schema Validation**: Zod

### Web Import
- **Primary**: Schema.org JSON-LD extraction (JavaScript in Electron)
- **Fallback**: Optional recipe-scrapers Python bridge (TBD in Phase 6 based on need)

### Application Framework
- **Framework**: Electron v39+
- **Boilerplate**: electron-react-boilerplate or custom setup (TBD in Phase 0)
- **Packaging**: Electron Forge or electron-builder

### Development Tools
- **Language**: TypeScript 5+
- **Testing**: Vitest (unit), Playwright (E2E)
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier
- **Build**: Vite (for renderer process)

---

## Acceptance Criteria (Epic-Level)

These criteria span all phases and will be verified in Phase 7:

### Functional Criteria (User-Facing)
- [ ] A user can manually enter a recipe with all required fields and it is stored successfully (Phase 3)
- [ ] A user can request AI generation of a recipe, review it, and add it to their collection (Phase 5)
- [ ] A user can import a recipe from a web URL, adapt if needed, and store it (Phase 6)
- [ ] The system rejects any recipe containing gluten or lactose with clear error messages (Phase 2)
- [ ] The system rejects recipes outside 30-45 minute window or using excessive cookware (Phase 2)
- [ ] A user can view their entire recipe collection (Phase 4)
- [ ] A user can filter recipes by time, cookware, and dietary tags (Phase 4)
- [ ] Recipe data persists across application restarts (Phase 1)

### Technical Criteria (System-Level)
- [ ] All recipes conform to Schema.org-aligned schema (Phase 1)
- [ ] Ingredient entities include name, quantity, unit, dietary properties (Phase 1)
- [ ] Dietary Profile entity exists with restrictions and preferences (Phase 1)
- [ ] Constraint validation runs before persistence and blocks non-compliant recipes (Phase 2)
- [ ] Recipe queries complete in <1 second with 1000+ recipes (Phase 4)

### Quality Criteria (Testing/Verification)
- [ ] Unit tests cover constraint validation with 100% coverage (Phase 2)
- [ ] Integration tests demonstrate all three acquisition modes end-to-end (Phases 3, 5, 6)
- [ ] Integration tests verify rejection of each constraint type (Phase 2)
- [ ] Performance tests confirm <1s filtering with 1000+ recipes (Phase 4)

---

## Risk Mitigation

### Risk 1: SQLite Durability Misconfiguration
**Impact**: Data loss on crash/power failure  
**Mitigation**: Phase 1 MUST configure `journal_mode=WAL` and `synchronous=FULL` (verified in research)  
**Verification**: Phase 1 includes unit test to verify PRAGMA settings

### Risk 2: False Negative in Dietary Validation
**Impact**: User receives recipe violating dietary restriction (safety issue)  
**Mitigation**: Multi-layer validation + mandatory user review + legal disclaimer  
**Verification**: Phase 2 unit tests MUST achieve 100% coverage; Phase 7 includes user acceptance testing with known violating recipes

### Risk 3: AI Generation Cost Overruns
**Impact**: Budget exceeded if users generate hundreds of recipes  
**Mitigation**: Track API usage, implement rate limiting if needed  
**Verification**: Phase 5 includes cost monitoring; Phase 0 decision on API budget limits

### Risk 4: Web Import Parsing Failures
**Impact**: User cannot import recipes from desired websites  
**Mitigation**: Graceful degradation (manual HTML paste fallback), clear error messages  
**Verification**: Phase 6 includes error handling tests with malformed HTML

### Risk 5: Performance Degradation at Scale
**Impact**: Slow filtering with large recipe collections  
**Mitigation**: Database indexing strategy, synthetic dataset load testing  
**Verification**: Phase 4 MUST include load testing with 1000-2000 recipes

---

## Traceability Matrix (Epic Stories → Phases)

| Epic User Story | Primary Phase | Supporting Phases | Acceptance Criteria Refs |
|-----------------|---------------|-------------------|-------------------------|
| Story 1: Manual Recipe Entry | Phase 3 | Phase 1, 2 | Functional AC 1, Technical AC 1-4 |
| Story 2: AI Recipe Generation | Phase 5 | Phase 1, 2 | Functional AC 2, Technical AC 1-4 |
| Story 3: Web Recipe Import | Phase 6 | Phase 1, 2 | Functional AC 3, Technical AC 1-4 |
| Story 4: Dietary Validation | Phase 2 | All phases | Functional AC 4-5, Quality AC 1, 3 |
| Story 5: Viewing/Filtering | Phase 4 | Phase 1 | Functional AC 6-7, Technical AC 5, Quality AC 4 |
| Story 6: Local Persistence | Phase 1 | All phases | Functional AC 8, Technical AC 1-5 |

---

## Next Steps (For Implementor)

1. **Review this master plan** and confirm understanding of phased approach
2. **Read Phase 0 detailed plan** (once created): `2025-12-25-Recipe-Collection-Phase0-Stack-Selection.md`
3. **Resolve critical decisions** documented in Phase 0 (or accept recommended defaults)
4. **Initialize project structure** per Phase 0 guidance
5. **Proceed sequentially** through Phase 1 → Phase 7
6. **Update STATE files** after completing each phase
7. **Verify acceptance criteria** at end of Phase 7

---

## Appendix: File Naming Convention

All implementation plan files follow this pattern:

```
thoughts/shared/plans/2025-12-25-Recipe-Collection-Phase{N}-{Phase-Name}.md
thoughts/shared/plans/2025-12-25-Recipe-Collection-Phase{N}-{Phase-Name}-STATE.md
```

Examples:
- `2025-12-25-Recipe-Collection-Phase0-Stack-Selection.md`
- `2025-12-25-Recipe-Collection-Phase0-Stack-Selection-STATE.md`
- `2025-12-25-Recipe-Collection-Phase1-Data-Persistence.md`
- `2025-12-25-Recipe-Collection-Phase1-Data-Persistence-STATE.md`

This master plan file: `2025-12-25-Recipe-Collection-Management-MASTER.md`

---

**End of Master Plan**  
**Next**: Create detailed Phase 0 plan for technology stack selection and project scaffolding.
