---
date: 2026-01-16
planner: assistant
epic-id: 'EPIC-002'
phase: Phase 5
phase-name: Selection & Shopping List
master-plan: 'thoughts/shared/plans/2026-01-02-Conversational-Decision-Support-MASTER.md'
research-source: 'thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md'
status: ready-for-implementation
type: phase-plan
---

# Phase 5: Selection & Shopping List - Implementation Plan

## Inputs

- **MASTER Plan**: `thoughts/shared/plans/2026-01-02-Conversational-Decision-Support-MASTER.md`
- **Research Report**: `thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md`
- **Phase 4 STATE**: `thoughts/shared/plans/2026-01-06-Conversational-Decision-Support-Phase4-STATE.md` (COMPLETE)
- **User Request**: Create detailed plan for Phase 5 - Selection & Shopping List

## Phase Goals

**Primary Goal**: Enable users to confirm recipe selection, generate accurate shopping lists, and store cooking sessions in the database—completing the full decision support workflow.

**Success Criteria**: Users can select a recipe with one click, receive a formatted shopping list with quantities and units, and have their decision persisted for future personalization. Full session completes in <10 minutes.

---

## Verified Current State

### Database Schema

- **Fact**: `cooking_sessions` table exists with complete schema
- **Evidence**: `src/main/database/migrations.ts:151-181`
- **Excerpt**:

```typescript
CREATE TABLE cooking_sessions (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  user_context TEXT NOT NULL DEFAULT '{}',
  conversation_summary TEXT,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
)
```

- **Fact**: `cooking_sessions` included in Database interface
- **Evidence**: `src/shared/types/database.ts:78`
- **Excerpt**: `cooking_sessions: CookingSessionTable;`

- **Fact**: Timestamp index exists for chronological queries
- **Evidence**: `src/main/database/migrations.ts:176-177`
- **Excerpt**: `CREATE INDEX idx_cooking_sessions_timestamp ON cooking_sessions(timestamp DESC)`

### Type Definitions

- **Fact**: `CookingSessionTable` type exists with snake_case fields
- **Evidence**: `src/shared/types/conversation.ts:13-19`
- **Excerpt**:

```typescript
export interface CookingSessionTable {
  id: string; // UUID primary key
  recipe_id: string; // Foreign key to recipes.id
  timestamp: string; // ISO 8601 timestamp
  user_context: string; // JSON object (energy, time, mood, canShop)
  conversation_summary: string | null; // Optional summary
}
```

- **Fact**: `CookingSession` application type with parsed fields exists
- **Evidence**: `src/shared/types/conversation.ts:27-33`
- **Excerpt**:

```typescript
export interface CookingSession {
  id: string;
  recipeId: string;
  timestamp: Date; // Parsed from ISO string
  userContext: UserContext;
  conversationSummary: string | null;
}
```

- **Fact**: `UserContext` type includes all context fields
- **Evidence**: `src/shared/types/conversation.ts:41-46`
- **Excerpt**:

```typescript
export interface UserContext {
  energyLevel?: 'low' | 'medium' | 'high';
  availableTime?: number; // minutes (30-60 range)
  mood?: string; // free-text description
  canShop?: boolean; // whether user can go shopping
}
```

### Ingredient Structure

- **Fact**: Recipe type includes full ingredient array with quantities
- **Evidence**: `src/shared/types/recipe.ts:36-45`
- **Excerpt**:

```typescript
export interface Ingredient {
  id: string;
  recipeId: string;
  name: string;
  quantity: number;
  unit: string;
  dietaryProperties: DietaryProperty[];
  optional: boolean;
  orderIndex: number;
}
```

- **Fact**: Recipes include ingredients in parsed form
- **Evidence**: `src/shared/types/recipe.ts:25`
- **Excerpt**: `ingredients: Ingredient[]; // Nested ingredients`

### Current UI State (Phase 4 Complete)

- **Fact**: `onSelect` handler in ConversationPage is a placeholder
- **Evidence**: `src/renderer/pages/ConversationPage.tsx:360-363`
- **Excerpt**:

```typescript
onSelect={() => {
  // TODO: Phase 4/5 - Implement recipe selection
  console.log('Recipe selected:', recipe.id, recipe.title);
}}
```

- **Fact**: Recipe data is already fetched and cached in ConversationPage
- **Evidence**: `src/renderer/pages/ConversationPage.tsx:171-189`
- **Excerpt**: Uses `fetchedRecipes` state to cache Recipe objects by ID

- **Fact**: ConversationSession includes full userContext
- **Evidence**: `src/shared/types/conversation.ts:93`
- **Excerpt**: `userContext: UserContext;`

### Existing DAL Pattern

- **Fact**: DALs use Kysely for type-safe queries with snake_case mapping
- **Evidence**: `src/main/database/dal/dietary-profile.ts:7-27`
- **Excerpt**:

```typescript
export async function getDietaryProfile(): Promise<DietaryProfile> {
  const row = await db
    .selectFrom('dietary_profile')
    .selectAll()
    .where('id', '=', 1)
    .executeTakeFirst();
  
  return {
    id: row.id,
    hardRestrictions: JSON.parse(row.hard_restrictions),
    // ... parse snake_case to camelCase
  };
}
```

- **Fact**: No DAL exists yet for `cooking_sessions`
- **Evidence**: Directory listing shows only `dietary-profile.ts` and `recipes.ts`
- **Verification**: `ls src/main/database/dal/` shows no cooking-sessions file

### App Routing Pattern

- **Fact**: App uses simple state-based routing with View type
- **Evidence**: `src/renderer/App.tsx:10-11`
- **Excerpt**:

```typescript
type View = 'add' | 'list' | 'detail' | 'ai-generation' | 'import' | 'conversation';
```

- **Fact**: Navigation handled via `handleNavigate` function
- **Evidence**: `src/renderer/App.tsx:16-19`
- **Excerpt**:

```typescript
const handleNavigate = (view: ...) => {
  setCurrentView(view);
  setSelectedRecipeId(null);
};
```

- **Fact**: Pages conditionally rendered based on currentView
- **Evidence**: `src/renderer/App.tsx:35-42`
- **Excerpt**: Shows pattern like `{currentView === 'conversation' && <ConversationPage />}`

---

## Goals / Non-Goals

### Goals

- ✅ Create cooking_sessions DAL (create, getById, getRecent)
- ✅ Generate shopping list from recipe ingredients
- ✅ Implement recipe selection confirmation in conversation-service
- ✅ Add IPC handler for conversation:confirm-selection
- ✅ Update ConversationPage onSelect handler
- ✅ Create ShoppingListPage component with formatted display
- ✅ Add shopping list routing to App
- ✅ Persist cooking session to database with user context
- ✅ Update session state to 'confirmed'
- ✅ Comprehensive testing (unit, integration, E2E)

### Non-Goals

- ❌ Multi-day shopping list persistence (shopping list is ephemeral, tied to session)
- ❌ Shopping list editing (user cannot modify quantities)
- ❌ Shopping list export (no CSV/PDF export in Phase 5)
- ❌ Recipe instruction display on shopping list page (separate feature)
- ❌ Ingredient substitution suggestions (handled in Phase 4 refinement)
- ❌ Shopping list optimization (grouping by aisle, etc.)

---

## Design Overview

### Data Flow

1. **User Selects Recipe** → ConversationPage calls `onSelect(recipeId)`
2. **Frontend Calls IPC** → `window.electron.conversationAPI.confirmSelection(sessionId, recipeId)`
3. **Main Process Validates** → IPC handler validates session and recipe exist
4. **Service Orchestrates** → `confirmSelection()` in conversation-service:
   - Fetch Recipe with ingredients
   - Generate shopping list (extract ingredient list with quantities/units)
   - Save to cooking_sessions table (via DAL)
   - Update session state to 'confirmed'
   - Return shopping list items to renderer
5. **Frontend Navigates** → Display ShoppingListPage with items
6. **User Reviews** → Scannable list with checkboxes (UI only, no persistence)

### Shopping List Format

Each item contains:
- `name`: Ingredient name (e.g., "olive oil")
- `quantity`: Numeric amount (e.g., 2)
- `unit`: Unit of measure (e.g., "tbsp")
- `displayText`: Formatted string (e.g., "2 tbsp olive oil")

Items are sorted by `orderIndex` from recipe.

### State Transitions

- Before: `ConversationSession.state = 'suggesting' | 'refining'`
- After: `ConversationSession.state = 'confirmed'`
- Session remains in memory for shopping list display, then cleaned up on navigation away

---

## Implementation Instructions (For Implementor)

### PLAN-001: Create cooking-sessions.ts DAL

**Change Type**: create

**File**: `src/main/database/dal/cooking-sessions.ts`

**Instruction**:

1. Create new file with imports:
   - `import { db } from '../init.js';`
   - `import type { CookingSession, CookingSessionTable, UserContext } from '../../../shared/types/conversation.js';`
   - `import { randomUUID } from 'crypto';`

2. Implement `createCookingSession(recipeId: string, userContext: UserContext, conversationSummary?: string): Promise<CookingSession>`:
   - Generate UUID for session ID
   - Create ISO timestamp
   - Serialize userContext to JSON string
   - Insert into cooking_sessions table using Kysely
   - Return parsed CookingSession object

3. Implement `getCookingSessionById(id: string): Promise<CookingSession | null>`:
   - Query by ID using `db.selectFrom('cooking_sessions').selectAll().where('id', '=', id).executeTakeFirst()`
   - Parse JSON fields (user_context)
   - Parse timestamp to Date
   - Return null if not found

4. Implement `getRecentCookingSessions(limit = 10): Promise<CookingSession[]>`:
   - Query sorted by timestamp DESC with limit
   - Parse all rows
   - Return array

**Pseudocode**:

```typescript
export async function createCookingSession(
  recipeId: string,
  userContext: UserContext,
  conversationSummary?: string
): Promise<CookingSession> {
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  
  await db
    .insertInto('cooking_sessions')
    .values({
      id,
      recipe_id: recipeId,
      timestamp,
      user_context: JSON.stringify(userContext),
      conversation_summary: conversationSummary ?? null,
    })
    .execute();
  
  return {
    id,
    recipeId,
    timestamp: new Date(timestamp),
    userContext,
    conversationSummary: conversationSummary ?? null,
  };
}
```

**Evidence**:
- DAL pattern: `src/main/database/dal/dietary-profile.ts:6-27`
- Database table: `src/main/database/migrations.ts:162-169`
- Type definitions: `src/shared/types/conversation.ts:13-33`

**Done When**:
- [ ] File compiles without errors
- [ ] All three functions exported
- [ ] JSON serialization/deserialization works correctly
- [ ] Type conversions (snake_case ↔ camelCase) correct

---

### PLAN-002: Create shopping-list.ts utility

**Change Type**: create

**File**: `src/main/conversation/shopping-list.ts`

**Instruction**:

1. Create new file with imports:
   - `import type { Recipe, Ingredient } from '../../shared/types/recipe.js';`

2. Define `ShoppingListItem` interface:
   - Fields: `name: string`, `quantity: number`, `unit: string`, `displayText: string`, `optional: boolean`

3. Implement `generateShoppingList(recipe: Recipe): ShoppingListItem[]`:
   - Map over `recipe.ingredients` (already sorted by orderIndex)
   - For each ingredient, create ShoppingListItem:
     - `name`: ingredient.name
     - `quantity`: ingredient.quantity
     - `unit`: ingredient.unit
     - `displayText`: Format as "{quantity} {unit} {name}" (e.g., "2 tbsp olive oil")
     - `optional`: ingredient.optional
   - Return array (pre-sorted by orderIndex)

4. Handle edge cases:
   - Quantity 0 → display as "to taste" or unit
   - Empty unit → omit unit in displayText
   - Optional ingredients → mark with "(optional)" in displayText

**Pseudocode**:

```typescript
export interface ShoppingListItem {
  name: string;
  quantity: number;
  unit: string;
  displayText: string;
  optional: boolean;
}

export function generateShoppingList(recipe: Recipe): ShoppingListItem[] {
  return recipe.ingredients.map(ing => {
    const qtyStr = ing.quantity === 0 ? '' : String(ing.quantity);
    const unitStr = ing.unit || '';
    const displayText = `${qtyStr} ${unitStr} ${ing.name}`.trim();
    const finalText = ing.optional ? `${displayText} (optional)` : displayText;
    
    return {
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      displayText: finalText,
      optional: ing.optional,
    };
  });
}
```

**Evidence**:
- Ingredient structure: `src/shared/types/recipe.ts:36-45`
- Recipe includes ingredients: `src/shared/types/recipe.ts:25`

**Done When**:
- [ ] ShoppingListItem interface exported
- [ ] generateShoppingList function exported
- [ ] displayText formatting correct
- [ ] Optional ingredients marked
- [ ] Function compiles without errors

---

### PLAN-003: Add confirmSelection to conversation-service.ts

**Change Type**: modify

**File**: `src/main/conversation/conversation-service.ts`

**Instruction**:

1. Add imports:
   - `import { getRecipeById } from '../database/dal/recipes.js';`
   - `import { createCookingSession } from '../database/dal/cooking-sessions.js';`
   - `import { generateShoppingList, type ShoppingListItem } from './shopping-list.js';`

2. Add new function `confirmSelection(sessionId: string, recipeId: string): Promise<{ success: boolean; shoppingList?: ShoppingListItem[]; error?: string }>`:
   - Step 1: Get session from session-manager
   - Step 2: Validate session state (must be 'suggesting' or 'refining')
   - Step 3: Fetch recipe by ID (throw error if not found)
   - Step 4: Generate shopping list using `generateShoppingList(recipe)`
   - Step 5: Create cooking session record via DAL (recipeId, session.userContext, no summary)
   - Step 6: Update session state to 'confirmed' via `updateSessionState(sessionId, 'confirmed')`
   - Step 7: Return success with shopping list
   - Error handling: Wrap in try-catch, return `{ success: false, error: message }`

3. Export the function

**Pseudocode**:

```typescript
export async function confirmSelection(
  sessionId: string,
  recipeId: string
): Promise<{ success: boolean; shoppingList?: ShoppingListItem[]; error?: string }> {
  try {
    const session = getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    
    if (session.state !== 'suggesting' && session.state !== 'refining') {
      return { success: false, error: `Cannot confirm selection in ${session.state} state` };
    }
    
    const recipe = await getRecipeById(recipeId);
    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }
    
    const shoppingList = generateShoppingList(recipe);
    
    await createCookingSession(recipeId, session.userContext);
    
    updateSessionState(sessionId, 'confirmed');
    
    return { success: true, shoppingList };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

**Evidence**:
- Service pattern: `src/main/conversation/conversation-service.ts:182-284` (processRefinement function)
- Session manager: `src/main/conversation/session-manager.ts` (getSession, updateSessionState)
- Recipe DAL: `src/main/database/dal/recipes.ts` (getRecipeById)

**Done When**:
- [ ] Function compiles and exported
- [ ] Session validation works
- [ ] Recipe fetching works
- [ ] Shopping list generation called
- [ ] Cooking session saved to DB
- [ ] Session state updated to 'confirmed'
- [ ] Error handling complete

---

### PLAN-004: Add IPC handler for conversation:confirm-selection

**Change Type**: modify

**File**: `src/main/ipc/conversation-handlers.ts`

**Instruction**:

1. Add import:
   - `import { confirmSelection } from '../conversation/conversation-service.js';`

2. Add new IPC handler in `registerConversationHandlers()` function:
   - Channel: `'conversation:confirm-selection'`
   - Parameters: `sessionId: string, recipeId: string`
   - Security: Use `validateSender(event)` pattern
   - Validation: Check sessionId and recipeId are non-empty strings
   - Business logic: Call `await confirmSelection(sessionId, recipeId)`
   - Return: Result object `{ success: boolean; shoppingList?: ShoppingListItem[]; error?: string }`

3. Update JSDoc at top of file to document 7 handlers (add this new one)

**Pseudocode**:

```typescript
ipcMain.handle(
  'conversation:confirm-selection',
  async (event, sessionId: string, recipeId: string) => {
    validateSender(event);
    
    if (!sessionId || typeof sessionId !== 'string') {
      return { success: false, error: 'Invalid session ID' };
    }
    
    if (!recipeId || typeof recipeId !== 'string') {
      return { success: false, error: 'Invalid recipe ID' };
    }
    
    try {
      const result = await confirmSelection(sessionId, recipeId);
      return result;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
);
```

**Evidence**:
- IPC handler pattern: `src/main/ipc/conversation-handlers.ts:81-103` (conversation:reject-recipe)
- Security validation: `src/main/ipc/conversation-handlers.ts:33-37`

**Done When**:
- [ ] Handler registered in function
- [ ] Security validation implemented
- [ ] Parameter validation complete
- [ ] confirmSelection called correctly
- [ ] Error handling in place
- [ ] JSDoc updated

---

### PLAN-005: Update preload.ts with confirmSelection binding

**Change Type**: modify

**File**: `src/preload/preload.ts`

**Instruction**:

1. Add new method to `__originalAPI__.conversationAPI` object (around line 26-30):
   - Method name: `confirmSelection`
   - Parameters: `sessionId: string, recipeId: string`
   - Implementation: `ipcRenderer.invoke('conversation:confirm-selection', sessionId, recipeId)`

2. Add corresponding mock method to `__mockAPI__.conversationAPI` object (around line 52-56):
   - Same signature
   - Implementation: Delegate to `__originalAPI__.conversationAPI.confirmSelection(sessionId, recipeId)`

**Pseudocode**:

```typescript
// In __originalAPI__.conversationAPI:
confirmSelection: (sessionId: string, recipeId: string) =>
  ipcRenderer.invoke('conversation:confirm-selection', sessionId, recipeId),

// In __mockAPI__.conversationAPI:
confirmSelection: (sessionId: string, recipeId: string) =>
  __originalAPI__.conversationAPI.confirmSelection(sessionId, recipeId),
```

**Evidence**:
- Existing pattern: `src/preload/preload.ts:26-30` (getSuggestions, rejectRecipe, refine)
- Mock pattern: `src/preload/preload.ts:52-56`

**Done When**:
- [ ] Method added to original API
- [ ] Method added to mock API
- [ ] Channel name matches handler
- [ ] Type checking passes

---

### PLAN-006: Update electron.d.ts with confirmSelection type

**Change Type**: modify

**File**: `src/shared/types/electron.d.ts`

**Instruction**:

1. Add import for ShoppingListItem:
   - `import type { ShoppingListItem } from '../../main/conversation/shopping-list';`
   - Note: May need to move ShoppingListItem to shared/types/conversation.ts for proper sharing

2. Add new method to `ConversationAPI` interface:
   - Method: `confirmSelection(sessionId: string, recipeId: string): Promise<{ success: boolean; shoppingList?: ShoppingListItem[]; error?: string }>`

3. Update test files that mock `window.electron.conversationAPI`:
   - Add `confirmSelection: vi.fn()` to mock objects

**Pseudocode**:

```typescript
// In electron.d.ts ConversationAPI interface:
confirmSelection(
  sessionId: string,
  recipeId: string
): Promise<{ success: boolean; shoppingList?: ShoppingListItem[]; error?: string }>;
```

**Evidence**:
- Existing API methods: `src/shared/types/electron.d.ts` (getSuggestions, rejectRecipe, refine)
- Test mocking pattern: Phase 4 STATE notes show pattern

**Done When**:
- [ ] ShoppingListItem type accessible in electron.d.ts
- [ ] Method added to ConversationAPI interface
- [ ] Test files updated with mock
- [ ] Type checking passes across all files

---

### PLAN-007: Move ShoppingListItem to shared types

**Change Type**: modify (prerequisite for PLAN-006)

**File**: `src/shared/types/conversation.ts`

**Instruction**:

1. Add `ShoppingListItem` interface to shared types (after RecipeSuggestion):

```typescript
/**
 * Shopping list item generated from recipe ingredients.
 * Used in Phase 5 to display formatted shopping list after recipe selection.
 */
export interface ShoppingListItem {
  name: string; // Ingredient name (e.g., "olive oil")
  quantity: number; // Numeric amount
  unit: string; // Unit of measure (e.g., "tbsp")
  displayText: string; // Formatted string (e.g., "2 tbsp olive oil")
  optional: boolean; // Whether ingredient is optional
}
```

2. Update `src/main/conversation/shopping-list.ts` imports:
   - Change to: `import type { ShoppingListItem } from '../../shared/types/conversation.js';`
   - Remove local interface definition
   - Keep `generateShoppingList` function implementation

**Evidence**:
- Shared types location: `src/shared/types/conversation.ts:1-124`
- Import pattern: Other shared types used across main and renderer

**Done When**:
- [ ] ShoppingListItem added to conversation.ts
- [ ] shopping-list.ts updated to import from shared
- [ ] Type checking passes
- [ ] No duplicate interface definitions

---

### PLAN-008: Implement handleSelect in ConversationPage

**Change Type**: modify

**File**: `src/renderer/pages/ConversationPage.tsx`

**Instruction**:

1. Add new reducer action type `'navigate_to_shopping_list'`:
   - Payload: `shoppingList: ShoppingListItem[], recipeName: string`
   - Updates state with shopping list data for passing to ShoppingListPage

2. Implement `handleSelect` function (replace console.log at line 360-363):
   - Parameters: `recipeId: string, recipeName: string`
   - Call `window.electron.conversationAPI.confirmSelection(state.sessionId, recipeId)`
   - On success: Dispatch `navigate_to_shopping_list` action with shopping list and recipe name
   - On error: Show error in UI (add to messages or alert)

3. Update `onSelect` prop in RecipeSuggestionCard:
   - Change to: `onSelect={() => handleSelect(recipe.id, recipe.title)}`

4. Note: Actual navigation will be handled in PLAN-010 via parent App component

**Pseudocode**:

```typescript
const handleSelect = async (recipeId: string, recipeName: string) => {
  if (!state.sessionId) return;
  
  const result = await window.electron.conversationAPI.confirmSelection(
    state.sessionId,
    recipeId
  );
  
  if (result.success && result.shoppingList) {
    dispatch({
      type: 'navigate_to_shopping_list',
      shoppingList: result.shoppingList,
      recipeName,
    });
  } else {
    dispatch({
      type: 'add_ai_message',
      content: `Error: ${result.error || 'Failed to confirm selection'}`,
    });
  }
};
```

**Evidence**:
- Current placeholder: `src/renderer/pages/ConversationPage.tsx:360-363`
- Reducer pattern: ConversationPage uses useReducer for state management
- Recipe data available: Recipes already cached in fetchedRecipes map

**Done When**:
- [ ] handleSelect function implemented
- [ ] confirmSelection IPC called correctly
- [ ] Shopping list data captured in state
- [ ] Error handling in place
- [ ] onSelect prop updated to call handleSelect

---

### PLAN-009: Create ShoppingListPage component

**Change Type**: create

**File**: `src/renderer/pages/ShoppingListPage.tsx`

**Instruction**:

1. Create functional component with props:
   - `shoppingList: ShoppingListItem[]`
   - `recipeName: string`
   - `onBack: () => void` (for navigation back to conversation)

2. Implement UI layout:
   - Header with recipe name and back button
   - Shopping list title: "Shopping List for {recipeName}"
   - List of items with checkboxes (local UI state only)
   - Each item displays `displayText` from ShoppingListItem
   - Optional items shown with gray/italic styling

3. Add local state for checkbox tracking:
   - `const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())`
   - Toggle on click, update UI styling (strikethrough when checked)

4. Styling using Tailwind CSS (match existing page patterns)

**Pseudocode**:

```tsx
import { useState } from 'react';
import type { ShoppingListItem } from '../../shared/types/conversation';

interface ShoppingListPageProps {
  shoppingList: ShoppingListItem[];
  recipeName: string;
  onBack: () => void;
}

export function ShoppingListPage({ shoppingList, recipeName, onBack }: ShoppingListPageProps) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  
  const toggleItem = (index: number) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedItems(newChecked);
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <button onClick={onBack}>← Back to Conversation</button>
      <h1>Shopping List for {recipeName}</h1>
      <ul>
        {shoppingList.map((item, idx) => (
          <li key={idx} onClick={() => toggleItem(idx)}>
            <input type="checkbox" checked={checkedItems.has(idx)} readOnly />
            <span className={checkedItems.has(idx) ? 'line-through' : ''}>
              {item.displayText}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Evidence**:
- Page pattern: `src/renderer/pages/ConversationPage.tsx` (layout and styling)
- Tailwind usage: Existing pages use Tailwind CSS classes

**Done When**:
- [ ] Component renders without errors
- [ ] Shopping list items displayed correctly
- [ ] Checkboxes toggle and update UI
- [ ] Optional items styled differently
- [ ] Back button works (calls onBack)
- [ ] Responsive layout with Tailwind

---

### PLAN-010: Add shopping list routing to App

**Change Type**: modify

**File**: `src/renderer/App.tsx`

**Instruction**:

1. Update `View` type to include `'shopping-list'`:
   - Line 10: `type View = 'add' | 'list' | 'detail' | 'ai-generation' | 'import' | 'conversation' | 'shopping-list';`

2. Add state for shopping list data:
   - `const [shoppingListData, setShoppingListData] = useState<{ items: ShoppingListItem[]; recipeName: string } | null>(null);`

3. Create `handleShowShoppingList` function:
   - Parameters: `items: ShoppingListItem[], recipeName: string`
   - Sets `shoppingListData` and navigates to `'shopping-list'` view

4. Pass `onShowShoppingList` prop to ConversationPage:
   - `<ConversationPage onShowShoppingList={handleShowShoppingList} />`

5. Add ShoppingListPage rendering:
   - Import: `import { ShoppingListPage } from './pages/ShoppingListPage';`
   - Conditional render: `{currentView === 'shopping-list' && shoppingListData && <ShoppingListPage shoppingList={shoppingListData.items} recipeName={shoppingListData.recipeName} onBack={() => setCurrentView('conversation')} />}`

6. Update ConversationPage to accept and use `onShowShoppingList` prop:
   - Add prop to ConversationPage interface
   - Call in `navigate_to_shopping_list` reducer action

**Pseudocode**:

```typescript
// In App.tsx:
const [shoppingListData, setShoppingListData] = useState<{
  items: ShoppingListItem[];
  recipeName: string;
} | null>(null);

const handleShowShoppingList = (items: ShoppingListItem[], recipeName: string) => {
  setShoppingListData({ items, recipeName });
  setCurrentView('shopping-list');
};

// In render:
{currentView === 'conversation' && (
  <ConversationPage onShowShoppingList={handleShowShoppingList} />
)}
{currentView === 'shopping-list' && shoppingListData && (
  <ShoppingListPage
    shoppingList={shoppingListData.items}
    recipeName={shoppingListData.recipeName}
    onBack={() => setCurrentView('conversation')}
  />
)}
```

**Evidence**:
- Routing pattern: `src/renderer/App.tsx:10-44`
- State-based navigation: currentView state controls which page renders

**Done When**:
- [ ] View type includes 'shopping-list'
- [ ] Shopping list state added
- [ ] handleShowShoppingList implemented
- [ ] ConversationPage receives onShowShoppingList prop
- [ ] ShoppingListPage conditionally rendered
- [ ] Navigation flow works end-to-end
- [ ] Type checking passes

---

### PLAN-011: Write unit tests for cooking-sessions DAL

**Change Type**: create

**File**: `src/main/database/dal/cooking-sessions.test.ts`

**Instruction**:

1. Create test file with setup/teardown:
   - Import: `runMigrations`, `closeDatabase`, DAL functions, types
   - `beforeEach`: Call `runMigrations()` for fresh DB
   - `afterAll`: Call `closeDatabase()`

2. Write test cases:
   - "should create cooking session with all fields"
     - Create session with full userContext and summary
     - Verify returned object has correct fields
     - Verify ID is UUID format
     - Verify timestamp is recent Date
   - "should create cooking session without summary"
     - Create session with null summary
     - Verify conversationSummary is null
   - "should get cooking session by ID"
     - Create session
     - Fetch by ID
     - Verify all fields match
   - "should return null for non-existent ID"
     - Call getCookingSessionById with fake UUID
     - Expect null
   - "should get recent sessions sorted by timestamp"
     - Create 3 sessions with small delays
     - Call getRecentCookingSessions(2)
     - Verify returns 2 most recent, in DESC order
   - "should parse userContext JSON correctly"
     - Create session with full UserContext
     - Fetch and verify energyLevel, availableTime, mood, canShop

3. Use vitest assertions (expect, toBeDefined, toEqual, toBeNull, etc.)

**Evidence**:
- Test pattern: `src/main/database/dal/recipes.test.ts` (DAL testing with migrations)
- Migration setup: `beforeEach` with `runMigrations()`

**Done When**:
- [ ] All 6+ test cases pass
- [ ] Test coverage >85% for cooking-sessions.ts
- [ ] Tests run successfully with `npm test`
- [ ] No type errors

---

### PLAN-012: Write unit tests for shopping-list utility

**Change Type**: create

**File**: `src/main/conversation/shopping-list.test.ts`

**Instruction**:

1. Create test file with imports:
   - `import { generateShoppingList } from './shopping-list.js';`
   - `import type { Recipe, Ingredient } from '../../shared/types/recipe.js';`

2. Create mock recipe factory function:
   - Minimal Recipe object with ingredients array
   - Helper to create Ingredient objects

3. Write test cases:
   - "should generate shopping list from recipe"
     - Mock recipe with 3 ingredients
     - Verify returns 3 ShoppingListItems
     - Verify displayText formatting correct
   - "should format displayText correctly"
     - Test "2 tbsp olive oil" format
     - Test "1 lb chicken breast" format
   - "should mark optional ingredients"
     - Mock recipe with 1 optional ingredient
     - Verify optional field is true
     - Verify displayText includes "(optional)"
   - "should handle zero quantity"
     - Mock ingredient with quantity 0
     - Verify displayText formatting (e.g., "to taste salt")
   - "should handle empty unit"
     - Mock ingredient with unit ""
     - Verify displayText omits unit properly
   - "should preserve ingredient order"
     - Mock recipe with ingredients in specific orderIndex
     - Verify output array matches order

**Pseudocode**:

```typescript
const createMockRecipe = (ingredients: Partial<Ingredient>[]): Recipe => ({
  id: 'test-id',
  title: 'Test Recipe',
  ingredients: ingredients.map((ing, idx) => ({
    id: `ing-${idx}`,
    recipeId: 'test-id',
    name: ing.name || 'ingredient',
    quantity: ing.quantity ?? 1,
    unit: ing.unit || 'cup',
    optional: ing.optional || false,
    orderIndex: ing.orderIndex ?? idx,
    dietaryProperties: [],
  })),
  // ... other required Recipe fields
});
```

**Evidence**:
- Test pattern: `src/main/conversation/prompts.test.ts` (pure function testing)
- Ingredient structure: `src/shared/types/recipe.ts:36-45`

**Done When**:
- [ ] All 6+ test cases pass
- [ ] Edge cases covered (zero quantity, empty unit, optional)
- [ ] displayText formatting verified
- [ ] Test coverage >90% for shopping-list.ts

---

### PLAN-013: Write integration tests for confirmSelection

**Change Type**: modify

**File**: `src/main/conversation/conversation-service.test.ts`

**Instruction**:

1. Add new describe block: `"confirmSelection Integration"`

2. Write test cases:
   - "should successfully confirm selection and return shopping list"
     - Create session in 'suggesting' state with userContext
     - Create test recipe with 2 ingredients in database
     - Call `confirmSelection(sessionId, recipeId)`
     - Verify success is true
     - Verify shoppingList has 2 items
     - Verify cooking session saved to DB (query cooking_sessions table)
     - Verify session state updated to 'confirmed'
   - "should return error if session not found"
     - Call with fake sessionId
     - Verify success is false and error message present
   - "should return error if recipe not found"
     - Create session
     - Call with fake recipeId
     - Verify success is false
   - "should return error if session in wrong state"
     - Create session in 'gathering' state
     - Call confirmSelection
     - Verify error about invalid state

3. Use real database (with migrations) and real session-manager
4. Mock only if necessary (likely none needed)

**Pseudocode**:

```typescript
describe('confirmSelection Integration', () => {
  beforeEach(() => {
    runMigrations();
    // Create test recipe with ingredients
  });
  
  it('should successfully confirm selection and return shopping list', async () => {
    const sessionId = createSession();
    updateSessionState(sessionId, 'suggesting');
    updateSessionContext(sessionId, {
      energyLevel: 'medium',
      availableTime: 45,
    });
    
    const recipeId = 'test-recipe-id'; // from beforeEach
    
    const result = await confirmSelection(sessionId, recipeId);
    
    expect(result.success).toBe(true);
    expect(result.shoppingList).toHaveLength(2);
    expect(result.shoppingList[0].displayText).toContain('olive oil');
    
    // Verify cooking session in DB
    const dbSession = await getCookingSessionById(...);
    expect(dbSession).toBeDefined();
    
    // Verify state updated
    const session = getSession(sessionId);
    expect(session?.state).toBe('confirmed');
  });
});
```

**Evidence**:
- Integration test pattern: `src/main/conversation/conversation-service.test.ts:154-263` (processRefinement tests)
- Database setup: Uses real migrations in beforeEach

**Done When**:
- [ ] All 4+ test cases pass
- [ ] Database interactions verified
- [ ] Session state transitions tested
- [ ] Error cases covered
- [ ] Tests run successfully

---

### PLAN-014: Write component tests for ShoppingListPage

**Change Type**: create

**File**: `src/renderer/pages/ShoppingListPage.test.tsx`

**Instruction**:

1. Create test file with setup:
   - Import: `render`, `screen`, `userEvent` from testing library
   - Import component and types

2. Create mock data factory:
   - Mock ShoppingListItem array (3-4 items)
   - Include at least 1 optional item

3. Write test cases:
   - "should render recipe name in heading"
     - Render with recipeName="Chicken Pasta"
     - Verify heading contains "Chicken Pasta"
   - "should render all shopping list items"
     - Render with 4 items
     - Verify all 4 displayText values appear
   - "should render checkboxes for each item"
     - Render with items
     - Verify checkbox count matches item count
   - "should toggle checkbox on click"
     - Render
     - Click first item checkbox
     - Verify checkbox checked
     - Click again, verify unchecked
   - "should apply strikethrough when checked"
     - Render
     - Check item
     - Verify text has line-through class
   - "should call onBack when back button clicked"
     - Mock onBack function
     - Click back button
     - Verify onBack called once
   - "should style optional items differently"
     - Render with optional item
     - Verify optional item has gray/italic styling

4. Use React Testing Library and userEvent for interactions

**Pseudocode**:

```typescript
const mockShoppingList: ShoppingListItem[] = [
  { name: 'olive oil', quantity: 2, unit: 'tbsp', displayText: '2 tbsp olive oil', optional: false },
  { name: 'salt', quantity: 0, unit: '', displayText: 'salt (optional)', optional: true },
];

it('should render all shopping list items', () => {
  render(<ShoppingListPage shoppingList={mockShoppingList} recipeName="Test Recipe" onBack={vi.fn()} />);
  
  expect(screen.getByText('2 tbsp olive oil')).toBeInTheDocument();
  expect(screen.getByText('salt (optional)')).toBeInTheDocument();
});
```

**Evidence**:
- Component test pattern: `src/renderer/components/Conversation/FeedbackDialog.test.tsx:1-150`
- Testing library usage: Uses `@testing-library/react` and `@testing-library/user-event`

**Done When**:
- [ ] All 7+ test cases pass
- [ ] User interactions tested (checkbox toggle, back button)
- [ ] Rendering verified
- [ ] Styling assertions correct
- [ ] Test coverage >85% for ShoppingListPage

---

### PLAN-015: Write E2E test for full decision flow

**Change Type**: create

**File**: `e2e/conversational-decision-flow.spec.ts`

**Instruction**:

1. Create Playwright E2E test for complete user journey:
   - Start app
   - Navigate to Conversation page
   - Complete context gathering (send messages about energy/time)
   - Receive recipe suggestions
   - Select a recipe
   - Verify shopping list page appears
   - Verify shopping list contains ingredients

2. Test steps:
   - Click "What's for dinner?" navigation
   - Type and send message: "I have medium energy"
   - Type and send message: "I have 45 minutes"
   - Wait for suggestions to appear (recipe cards)
   - Click "Select this recipe" button on first card
   - Wait for navigation to shopping list
   - Verify heading contains recipe name
   - Verify at least 1 ingredient item displayed
   - Verify checkbox interaction works

3. Use Playwright selectors and assertions

**Pseudocode**:

```typescript
import { test, expect } from '@playwright/test';

test('complete conversational decision flow', async ({ page }) => {
  await page.goto('/');
  
  // Navigate to conversation
  await page.click('text=What\'s for dinner?');
  
  // Provide context
  await page.fill('input[placeholder*="message"]', 'I have medium energy');
  await page.click('button:has-text("Send")');
  
  await page.fill('input[placeholder*="message"]', 'I have 45 minutes');
  await page.click('button:has-text("Send")');
  
  // Wait for suggestions
  await page.waitForSelector('[data-testid="recipe-suggestion-card"]', { timeout: 10000 });
  
  // Select first recipe
  await page.click('button:has-text("Select this recipe")');
  
  // Verify shopping list page
  await expect(page.locator('h1')).toContainText('Shopping List');
  
  // Verify ingredients
  const items = await page.locator('ul li').count();
  expect(items).toBeGreaterThan(0);
  
  // Test checkbox
  await page.click('ul li:first-child');
  await expect(page.locator('ul li:first-child input[type="checkbox"]')).toBeChecked();
});
```

**Evidence**:
- E2E test pattern: `e2e/manual-entry.spec.ts` (existing E2E tests)
- Playwright usage: Project uses Playwright for E2E

**Done When**:
- [ ] Test passes end-to-end
- [ ] All user interactions verified
- [ ] Navigation flow works
- [ ] Shopping list rendering confirmed
- [ ] Test completes in <30 seconds

---

## Acceptance Criteria (Phase-Level)

### Functional Criteria

- [ ] User can click "Select this recipe" button on suggestion card
- [ ] Shopping list page displays with recipe name in heading
- [ ] Shopping list shows all ingredients with correct quantities and units
- [ ] Optional ingredients marked with "(optional)"
- [ ] Shopping list items are scannable (checkbox UI)
- [ ] User can navigate back to conversation from shopping list
- [ ] Cooking session saved to database with recipe ID, timestamp, and user context
- [ ] Session state transitions to 'confirmed'
- [ ] Full decision flow (start → context → suggestions → selection → shopping list) completes in <10 minutes

### Technical Criteria

- [ ] cooking_sessions DAL implements create, getById, getRecent
- [ ] Shopping list generation extracts ingredients correctly
- [ ] confirmSelection service function validates state and saves to DB
- [ ] IPC handler conversation:confirm-selection works securely
- [ ] ShoppingListPage component renders without errors
- [ ] App routing includes 'shopping-list' view
- [ ] Shopping list generation completes in <2 seconds
- [ ] Database foreign key constraint enforced (recipe_id → recipes.id)

### Testing Criteria

- [ ] Unit tests pass for cooking-sessions DAL (>85% coverage)
- [ ] Unit tests pass for shopping-list utility (>90% coverage)
- [ ] Integration tests pass for confirmSelection flow
- [ ] Component tests pass for ShoppingListPage (>85% coverage)
- [ ] E2E test passes for full decision journey
- [ ] All tests run successfully (`npm test`, `npm run test:e2e`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)

---

## Implementor Checklist

- [ ] PLAN-001: Create cooking-sessions.ts DAL
- [ ] PLAN-002: Create shopping-list.ts utility
- [ ] PLAN-003: Add confirmSelection to conversation-service.ts
- [ ] PLAN-004: Add IPC handler for conversation:confirm-selection
- [ ] PLAN-005: Update preload.ts with confirmSelection binding
- [ ] PLAN-006: Update electron.d.ts with confirmSelection type
- [ ] PLAN-007: Move ShoppingListItem to shared types
- [ ] PLAN-008: Implement handleSelect in ConversationPage
- [ ] PLAN-009: Create ShoppingListPage component
- [ ] PLAN-010: Add shopping list routing to App
- [ ] PLAN-011: Write unit tests for cooking-sessions DAL
- [ ] PLAN-012: Write unit tests for shopping-list utility
- [ ] PLAN-013: Write integration tests for confirmSelection
- [ ] PLAN-014: Write component tests for ShoppingListPage
- [ ] PLAN-015: Write E2E test for full decision flow

---

## Verification Commands

After completing all tasks, verify with:

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Run all unit tests
npm test

# Run specific test suites
npm test cooking-sessions.test.ts
npm test shopping-list.test.ts
npm test conversation-service.test.ts
npm test ShoppingListPage.test.tsx

# Run E2E tests
npm run test:e2e

# Manual verification (important!)
npm run dev
# 1. Start conversation ("What's for dinner?")
# 2. Provide context (energy, time)
# 3. Receive suggestions
# 4. Click "Select this recipe"
# 5. Verify shopping list appears
# 6. Verify all ingredients shown correctly
# 7. Test checkbox interactions
# 8. Navigate back to conversation
```

---

## Notes

- **Plan created**: 2026-01-16
- **Total tasks**: 15
- **Estimated duration**: 5-7 days (per master plan)
- **Prerequisites**: Phase 4 complete ✅ (all conversation infrastructure exists)
- **Dependencies**: 
  - cooking_sessions table exists (Phase 0) ✅
  - Recipe DAL with ingredients (EPIC-001) ✅
  - Conversation infrastructure (Phases 1-4) ✅

---

**End of Phase 5 Plan**

**Status**: Ready for implementation

**Next Phase**: Phase 6 - Error Handling & Resilience (after Phase 5 verification)
