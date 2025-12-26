# Phase 0 Technology Decisions

## Decision Summary
Date: 2025-12-25  
Status: APPROVED (2025-12-26)

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
**Chosen**: shadcn/ui  
**Alternatives Considered**: 
- Material-UI (MUI) - Most popular, comprehensive components, heavy bundle
- Ant Design - Enterprise-grade, comprehensive, opinionated styling
- Custom CSS - Maximum control, more development time

**Rationale**: Modern, lightweight approach with Tailwind-based copy-paste components  
**Status**: APPROVED

### Decision 4: Database Persistence
**Chosen**: SQLite with better-sqlite3  
**Alternatives Considered**: lowdb (rejected: performance at scale), PouchDB (rejected: unnecessary complexity)  
**Rationale**: Sub-millisecond queries, ACID durability, proven for 1000+ records  
**Source**: Research lines 229-275

### Decision 5: Query Builder / ORM
**Chosen**: Kysely  
**Alternatives Considered**: 
- Drizzle - Modern ORM with TypeScript-first design
- Raw SQL with TypeScript type generation - Maximum control
- TypeORM - Traditional ORM (rejected: heavy, Active Record pattern overkill)

**Rationale**: Type-safe SQL query builder with zero runtime overhead, maintains SQL control  
**Status**: APPROVED

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

## User Approval

**STATUS**: APPROVED (2025-12-26)

All technology decisions approved with recommended defaults:
- UI Component Library: shadcn/ui
- Query Builder/ORM: Kysely
- All other decisions: As specified above

Proceeding with PLAN-001 implementation.
