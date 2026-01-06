---
date: 2026-01-06
planner: assistant
epic-source: 'thoughts/shared/epics/2025-12-25-Conversational-Decision-Support.md'
master-plan: 'thoughts/shared/plans/2026-01-02-Conversational-Decision-Support-MASTER.md'
research-source: 'thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md'
phase: 1
status: ready-for-implementation
type: detailed-plan
---

# Phase 1: Conversation Infrastructure - Implementation Plan

## Executive Summary

**Goal**: Build the foundational conversation system—session management, basic UI, IPC wiring—**without AI**. This phase establishes the infrastructure that Phase 2 will extend with AI capabilities.

**Scope**: In-memory session manager, IPC handlers for conversation operations, basic conversation UI with message display and input, and integration with existing app navigation.

**Key Principle**: This is infrastructure work. The conversation will only echo messages back for now. AI integration happens in Phase 2.

**Duration**: 5-7 days

---

## Inputs

### Research Reports Used

- **Research Report**: `thoughts/shared/research/2026-01-02-Conversational-Decision-Support.md`
  - Lines 162-228: Conversation state management patterns (in-memory Map)
  - Lines 331-442: UI architecture (useReducer for state management)
  - Lines 671-831: Architecture recommendations (component responsibilities, data flow)

### Master Plan Reference

- **Master Plan**: `thoughts/shared/plans/2026-01-02-Conversational-Decision-Support-MASTER.md`
  - Lines 83-115: Phase 1 deliverables and verification criteria
  - Lines 394-412: Architecture decisions (state management, IPC patterns)

---

## Verified Current State

### Fact: Existing IPC Handler Pattern

- **Evidence**: `src/main/ipc/recipe-ai-handlers.ts:26-67`
- **Excerpt**:
  ```typescript
  export function registerRecipeAIHandlers(): void {
    ipcMain.handle('recipe:generate', async (event, criteria: RecipeGenerationCriteria) => {
      // Security check
      if (!event.senderFrame || !validateSender(event.senderFrame)) {
        return {
          success: false,
          error: { type: 'auth', message: 'Unauthorized IPC sender' },
        };
      }
      // ... implementation
    });
  }
  ```
- **Implication**: Conversation handlers must follow this exact pattern: security validation, async handlers, structured result types.

### Fact: Preload API Pattern

- **Evidence**: `src/main/preload.ts:10-48`
- **Excerpt**:
  ```typescript
  const __originalAPI__ = {
    create: (input: CreateRecipeInput) => ipcRenderer.invoke('recipe:create', input),
    getAll: () => ipcRenderer.invoke('recipe:getAll'),
    // ... other handlers
  };
  ```
- **Implication**: New conversation APIs must be added to both `__originalAPI__` and `__mockAPI__` in preload.ts, and exposed via `window.electron.conversationAPI`.

### Fact: App Navigation Pattern

- **Evidence**: `src/renderer/App.tsx:9-23`
- **Excerpt**:

  ```typescript
  type View = 'add' | 'list' | 'detail' | 'ai-generation' | 'import';

  const handleNavigate = (view: 'add' | 'list' | 'ai-generation' | 'import') => {
    setCurrentView(view);
    setSelectedRecipeId(null);
  };
  ```

- **Implication**: Add `'conversation'` to the View type and implement navigation handler for conversation page.

### Fact: NavigationBar Component Exists

- **Evidence**: `src/renderer/App.tsx:2` imports `NavigationBar`
- **Implication**: NavigationBar must be updated to include a "What's for dinner?" navigation button.

### Fact: Conversation Types Already Defined

- **Evidence**: `src/shared/types/conversation.ts:61-88`
- **Excerpt**:
  ```typescript
  export interface ConversationSession {
    sessionId: string;
    messages: ConversationMessage[];
    userContext: UserContext;
    suggestedRecipes: string[];
    rejectedRecipes: Array<{ recipeId: string; reason?: string }>;
    state: ConversationState;
    turnCount: number;
    createdAt: Date;
    lastActivity: Date;
  }
  ```
- **Implication**: Types are ready to use. No type definition work needed in Phase 1 (Phase 0 completed this).

### Fact: Existing Page Component Pattern

- **Evidence**: `src/renderer/pages/RecipeGenerationPage.tsx:1-56`
- **Excerpt**:
  ```typescript
  export function RecipeGenerationPage() {
    const [mode, setMode] = useState<Mode>('criteria');
    // ... state management with multiple useState hooks
  ```
- **Implication**: ConversationPage should use similar pattern, but research recommends `useReducer` for complex state (Research lines 419-442).

---

## Goals / Non-Goals

### Goals (This Phase)

1. ✅ Implement in-memory session manager with lifecycle management (create, track, cleanup)
2. ✅ Create IPC handlers for conversation operations (start, send message, abandon)
3. ✅ Build basic conversation UI (message list, input field, typing indicator placeholder)
4. ✅ Integrate conversation page into existing app navigation
5. ✅ Implement session cleanup on page close
6. ✅ Write unit tests for session manager
7. ✅ Write integration tests for IPC message flow

### Non-Goals (Deferred to Future Phases)

- ❌ AI integration (Phase 2)
- ❌ Recipe suggestions (Phase 3)
- ❌ Feedback handling (Phase 4)
- ❌ Shopping list generation (Phase 5)
- ❌ Error handling/resilience (Phase 6)
- ❌ Installing `@chatscope/chat-ui-kit-react` (deferred until we verify necessity)

---

## Design Overview

### Data Flow (Phase 1 - Echo Mode)

```
User clicks "What's for dinner?" button
  → Renderer: App.tsx navigates to ConversationPage
  → Renderer: ConversationPage calls window.electron.conversationAPI.startSession()
  → IPC: conversation-handlers.ts receives startSession request
  → Main: session-manager.ts creates new session with UUID
  → IPC: Returns { sessionId: string } to renderer
  → Renderer: Stores sessionId in component state

User types message and clicks Send
  → Renderer: Optimistically add user message to UI
  → Renderer: Call window.electron.conversationAPI.sendMessage(sessionId, message)
  → IPC: conversation-handlers.ts receives message
  → Main: session-manager.ts updates session.messages array
  → Main: Echo back message with "Echo: " prefix (NO AI in Phase 1)
  → IPC: Returns { aiMessage: string, timestamp: Date }
  → Renderer: Add AI message to UI, remove loading indicator

User closes page or navigates away
  → Renderer: useEffect cleanup calls window.electron.conversationAPI.abandonSession(sessionId)
  → IPC: conversation-handlers.ts receives abandon request
  → Main: session-manager.ts deletes session from in-memory Map
```

### Session Lifecycle States (Phase 1)

Phase 1 only implements `gathering` state (hardcoded). State machine expansion happens in Phase 2.

```
[User clicks "What's for dinner?"]
  → Create session (state = 'gathering')
  → User sends messages
  → Session echoes back
  → User abandons
  → Session deleted from memory
```

---

## Implementation Instructions (For Implementor)

### PLAN-001: Create Session Manager (Main Process)

**Change Type**: create  
**File**: `src/main/conversation/session-manager.ts`

**Instruction**:

1. Create new directory `src/main/conversation/`
2. Create `session-manager.ts` with the following exports:
   - `createSession(): Promise<string>` - Creates new session with UUID, adds to in-memory Map, returns sessionId
   - `getSession(sessionId: string): ConversationSession | null` - Retrieves session from Map
   - `updateSessionMessages(sessionId: string, message: ConversationMessage): void` - Adds message to session.messages array
   - `abandonSession(sessionId: string): void` - Deletes session from Map
   - `cleanupStaleSession(): void` - Removes sessions older than 30 minutes (called periodically)

**Pseudocode**:

```typescript
import type { ConversationSession, ConversationMessage } from '../../shared/types/conversation.js';
import { randomUUID } from 'crypto';

// In-memory session storage (Map<sessionId, ConversationSession>)
const activeSessions = new Map<string, ConversationSession>();

export async function createSession(): Promise<string> {
  const sessionId = randomUUID();
  const session: ConversationSession = {
    sessionId,
    messages: [],
    userContext: {},
    suggestedRecipes: [],
    rejectedRecipes: [],
    state: 'gathering',
    turnCount: 0,
    createdAt: new Date(),
    lastActivity: new Date(),
  };
  activeSessions.set(sessionId, session);
  return sessionId;
}

export function getSession(sessionId: string): ConversationSession | null {
  return activeSessions.get(sessionId) ?? null;
}

export function updateSessionMessages(sessionId: string, message: ConversationMessage): void {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.messages.push(message);
  session.turnCount += 1;
  session.lastActivity = new Date();
}

export function abandonSession(sessionId: string): void {
  activeSessions.delete(sessionId);
}

export function cleanupStaleSessions(): void {
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.lastActivity.getTime() < thirtyMinutesAgo) {
      activeSessions.delete(sessionId);
    }
  }
}

// Start cleanup timer (runs every 10 minutes)
setInterval(cleanupStaleSessions, 10 * 60 * 1000);
```

**Evidence**: Research lines 162-228 (in-memory Map pattern), Master Plan lines 714-744 (session state schema)

**Done When**:

- [ ] File created at `src/main/conversation/session-manager.ts`
- [ ] All 5 exported functions implemented
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Imports use `.js` extension (per AGENTS.md main process convention)

---

### PLAN-002: Create IPC Handlers for Conversation (Main Process)

**Change Type**: create  
**File**: `src/main/ipc/conversation-handlers.ts`

**Instruction**:

1. Create `conversation-handlers.ts` following existing IPC handler pattern
2. Implement `registerConversationHandlers()` function with 3 handlers:
   - `conversation:start` - Creates session, returns sessionId
   - `conversation:sendMessage` - Echoes message back with "Echo: " prefix
   - `conversation:abandon` - Cleans up session
3. Use same security validation pattern as `recipe-ai-handlers.ts:16-19`
4. For Phase 1, echo messages back (NO AI calls)

**Pseudocode**:

```typescript
import { ipcMain } from 'electron';
import type { WebFrameMain } from 'electron/main';
import {
  createSession,
  getSession,
  updateSessionMessages,
  abandonSession,
} from '../conversation/session-manager.js';
import type { ConversationMessage } from '../../shared/types/conversation.js';

function validateSender(frame: WebFrameMain): boolean {
  const url = new URL(frame.url);
  return url.protocol === 'file:' || url.hostname === 'localhost';
}

export function registerConversationHandlers(): void {
  ipcMain.handle('conversation:start', async event => {
    if (!event.senderFrame || !validateSender(event.senderFrame)) {
      return { success: false, error: 'Unauthorized IPC sender' };
    }

    const sessionId = await createSession();
    return { success: true, sessionId };
  });

  ipcMain.handle('conversation:sendMessage', async (event, sessionId: string, message: string) => {
    if (!event.senderFrame || !validateSender(event.senderFrame)) {
      return { success: false, error: 'Unauthorized IPC sender' };
    }

    const session = getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Add user message to session
    const userMessage: ConversationMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    updateSessionMessages(sessionId, userMessage);

    // Phase 1: Echo back (NO AI)
    const aiMessage: ConversationMessage = {
      role: 'assistant',
      content: `Echo: ${message}`,
      timestamp: new Date(),
    };
    updateSessionMessages(sessionId, aiMessage);

    return {
      success: true,
      aiMessage: aiMessage.content,
      timestamp: aiMessage.timestamp,
    };
  });

  ipcMain.handle('conversation:abandon', async (event, sessionId: string) => {
    if (!event.senderFrame || !validateSender(event.senderFrame)) {
      return { success: false, error: 'Unauthorized IPC sender' };
    }

    abandonSession(sessionId);
    return { success: true };
  });
}
```

**Evidence**: `src/main/ipc/recipe-ai-handlers.ts:26-67` (security pattern), Research lines 671-712 (data flow)

**Done When**:

- [ ] File created at `src/main/ipc/conversation-handlers.ts`
- [ ] 3 IPC handlers registered (`conversation:start`, `conversation:sendMessage`, `conversation:abandon`)
- [ ] Security validation implemented for all handlers
- [ ] Echo functionality works (returns "Echo: {message}")
- [ ] TypeScript compiles without errors

---

### PLAN-003: Register Conversation Handlers in Main Process

**Change Type**: modify  
**File**: `src/main/ipc/index.ts`

**Instruction**:

1. Import `registerConversationHandlers` from `./conversation-handlers.js`
2. Call it in the `registerIpcHandlers()` function

**Evidence**: `src/main/ipc/index.ts` (existing registration pattern)

**Pseudocode**:

```typescript
import { registerRecipeHandlers } from './recipe-handlers.js';
import { registerRecipeAIHandlers } from './recipe-ai-handlers.js';
import { registerRecipeImportHandlers } from './recipe-import-handlers.js';
import { registerConversationHandlers } from './conversation-handlers.js'; // ADD THIS

export function registerIpcHandlers(): void {
  registerRecipeHandlers();
  registerRecipeAIHandlers();
  registerRecipeImportHandlers();
  registerConversationHandlers(); // ADD THIS
}
```

**Done When**:

- [ ] Import added
- [ ] Function called in `registerIpcHandlers()`
- [ ] TypeScript compiles without errors

---

### PLAN-004: Expose Conversation API in Preload

**Change Type**: modify  
**File**: `src/main/preload.ts`

**Instruction**:

1. Add `conversationAPI` to `__originalAPI__` object with 3 methods:
   - `startSession(): Promise<{ success: boolean; sessionId?: string; error?: string }>`
   - `sendMessage(sessionId: string, message: string): Promise<{ success: boolean; aiMessage?: string; timestamp?: Date; error?: string }>`
   - `abandonSession(sessionId: string): Promise<{ success: boolean; error?: string }>`
2. Add same methods to `__mockAPI__` object (defaults to calling `__originalAPI__`)
3. No changes needed to `electronAPI` object (it already exposes the determined API)

**Evidence**: `src/main/preload.ts:10-48` (existing API pattern)

**Pseudocode**:

```typescript
const __originalAPI__ = {
  // ... existing methods
  conversationAPI: {
    startSession: () => ipcRenderer.invoke('conversation:start'),
    sendMessage: (sessionId: string, message: string) =>
      ipcRenderer.invoke('conversation:sendMessage', sessionId, message),
    abandonSession: (sessionId: string) => ipcRenderer.invoke('conversation:abandon', sessionId),
  },
};

const __mockAPI__ = {
  // ... existing methods
  conversationAPI: {
    startSession: () => __originalAPI__.conversationAPI.startSession(),
    sendMessage: (sessionId: string, message: string) =>
      __originalAPI__.conversationAPI.sendMessage(sessionId, message),
    abandonSession: (sessionId: string) => __originalAPI__.conversationAPI.abandonSession(sessionId),
  },
};

// Update electronAPI to include conversationAPI
const electronAPI = {
  platform: process.platform,
  versions: { ... },
  recipeAPI,
  conversationAPI, // ADD THIS
};
```

**Done When**:

- [ ] `conversationAPI` added to `__originalAPI__`
- [ ] `conversationAPI` added to `__mockAPI__`
- [ ] `conversationAPI` added to `electronAPI` object
- [ ] TypeScript compiles without errors

---

### PLAN-005: Update Electron API Type Definitions

**Change Type**: modify  
**File**: `src/shared/types/electron.d.ts`

**Instruction**:

1. Add `conversationAPI` interface to `ElectronAPI` interface
2. Add same interface to `TestAPI.__originalAPI__` and `TestAPI.__mockAPI__`

**Evidence**: `src/shared/types/electron.d.ts:6-42` (existing pattern)

**Pseudocode**:

```typescript
export interface ElectronAPI {
  platform: string;
  versions: { ... };
  recipeAPI: { ... };

  // ADD THIS
  conversationAPI: {
    startSession: () => Promise<{
      success: boolean;
      sessionId?: string;
      error?: string;
    }>;
    sendMessage: (sessionId: string, message: string) => Promise<{
      success: boolean;
      aiMessage?: string;
      timestamp?: Date;
      error?: string;
    }>;
    abandonSession: (sessionId: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
  };
}

// Also update TestAPI.__originalAPI__ and TestAPI.__mockAPI__ with same interface
```

**Done When**:

- [ ] `conversationAPI` added to `ElectronAPI`
- [ ] `conversationAPI` added to `TestAPI.__originalAPI__`
- [ ] `conversationAPI` added to `TestAPI.__mockAPI__`
- [ ] TypeScript compiles without errors
- [ ] No errors in renderer code using `window.electron.conversationAPI`

---

### PLAN-006: Create Conversation Page Component

**Change Type**: create  
**File**: `src/renderer/pages/ConversationPage.tsx`

**Instruction**:

1. Create React functional component using `useReducer` for state management (per Research lines 419-442)
2. State should track: `sessionId`, `messages[]`, `isLoading`, `error`
3. Implement:
   - Session initialization on mount (`useEffect`)
   - Message sending handler
   - Session cleanup on unmount (`useEffect` cleanup)
4. Render:
   - Header: "What's for dinner?"
   - Message list (scrollable div)
   - Input field with Send button
   - Loading indicator when AI is "typing" (just a placeholder in Phase 1)

**Pseudocode**:

```typescript
import React, { useReducer, useEffect, useRef } from 'react';
import type { ConversationMessage } from '../../shared/types/conversation';

interface ConversationState {
  sessionId: string | null;
  messages: ConversationMessage[];
  isLoading: boolean;
  error: string | null;
  inputValue: string;
}

type ConversationAction =
  | { type: 'session_started'; sessionId: string }
  | { type: 'add_user_message'; content: string }
  | { type: 'add_ai_message'; content: string; timestamp: Date }
  | { type: 'set_loading'; isLoading: boolean }
  | { type: 'set_error'; error: string }
  | { type: 'set_input'; value: string };

function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case 'session_started':
      return { ...state, sessionId: action.sessionId };
    case 'add_user_message':
      return {
        ...state,
        messages: [...state.messages, { role: 'user', content: action.content, timestamp: new Date() }],
        isLoading: true,
        inputValue: '',
      };
    case 'add_ai_message':
      return {
        ...state,
        messages: [...state.messages, { role: 'assistant', content: action.content, timestamp: action.timestamp }],
        isLoading: false,
      };
    case 'set_loading':
      return { ...state, isLoading: action.isLoading };
    case 'set_error':
      return { ...state, error: action.error, isLoading: false };
    case 'set_input':
      return { ...state, inputValue: action.value };
    default:
      return state;
  }
}

export function ConversationPage() {
  const [state, dispatch] = useReducer(conversationReducer, {
    sessionId: null,
    messages: [],
    isLoading: false,
    error: null,
    inputValue: '',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize session on mount
  useEffect(() => {
    async function initSession() {
      const result = await window.electron.conversationAPI.startSession();
      if (result.success && result.sessionId) {
        dispatch({ type: 'session_started', sessionId: result.sessionId });
      } else {
        dispatch({ type: 'set_error', error: result.error || 'Failed to start session' });
      }
    }
    initSession();

    // Cleanup on unmount
    return () => {
      if (state.sessionId) {
        window.electron.conversationAPI.abandonSession(state.sessionId);
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.inputValue.trim() || !state.sessionId) return;

    const messageContent = state.inputValue;
    dispatch({ type: 'add_user_message', content: messageContent });

    const result = await window.electron.conversationAPI.sendMessage(state.sessionId, messageContent);
    if (result.success && result.aiMessage) {
      dispatch({ type: 'add_ai_message', content: result.aiMessage, timestamp: result.timestamp || new Date() });
    } else {
      dispatch({ type: 'set_error', error: result.error || 'Failed to send message' });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-lg p-6 h-[600px] flex flex-col">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">What's for dinner?</h1>

        {state.error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{state.error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto mb-4 space-y-3">
          {state.messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-900'
                }`}
              >
                <p>{msg.content}</p>
              </div>
            </div>
          ))}
          {state.isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg">
                <p className="italic">AI is thinking...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Tell me about your day..."
            value={state.inputValue}
            onChange={(e) => dispatch({ type: 'set_input', value: e.target.value })}
            disabled={state.isLoading || !state.sessionId}
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
            disabled={state.isLoading || !state.inputValue.trim() || !state.sessionId}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Evidence**: Research lines 419-442 (useReducer pattern), Research lines 486-495 (optimistic updates)

**Done When**:

- [ ] File created at `src/renderer/pages/ConversationPage.tsx`
- [ ] Component uses `useReducer` for state management
- [ ] Session initializes on mount
- [ ] Session cleans up on unmount
- [ ] User can type and send messages
- [ ] Messages display in chat-like UI
- [ ] Auto-scrolls to bottom on new message
- [ ] TypeScript compiles without errors

---

### PLAN-007: Integrate Conversation Page into App Navigation

**Change Type**: modify  
**File**: `src/renderer/App.tsx`

**Instruction**:

1. Add `'conversation'` to the `View` type
2. Import `ConversationPage` component
3. Add navigation handler for conversation view
4. Add conditional render for conversation view in the JSX

**Evidence**: `src/renderer/App.tsx:9-42` (existing navigation pattern)

**Pseudocode**:

```typescript
import { ConversationPage } from './pages/ConversationPage'; // ADD THIS

type View = 'add' | 'list' | 'detail' | 'ai-generation' | 'import' | 'conversation'; // ADD 'conversation'

const handleNavigate = (view: 'add' | 'list' | 'ai-generation' | 'import' | 'conversation') => { // ADD 'conversation'
  setCurrentView(view);
  setSelectedRecipeId(null);
};

// In JSX:
{currentView === 'add' && <AddRecipePage />}
{currentView === 'ai-generation' && <RecipeGenerationPage />}
{currentView === 'import' && <RecipeImportPage />}
{currentView === 'conversation' && <ConversationPage />} // ADD THIS
{currentView === 'list' && <RecipeListPage onRecipeClick={handleRecipeClick} />}
{currentView === 'detail' && selectedRecipeId !== null && (
  <RecipeDetailPage recipeId={selectedRecipeId} onBack={handleBackToList} />
)}
```

**Done When**:

- [ ] `'conversation'` added to `View` type
- [ ] `ConversationPage` imported
- [ ] Conditional render added for conversation view
- [ ] TypeScript compiles without errors

---

### PLAN-008: Add Navigation Button to NavigationBar

**Change Type**: modify  
**File**: `src/renderer/components/common/NavigationBar.tsx`

**Instruction**:

1. Read the existing NavigationBar component to understand its structure
2. Add a navigation button labeled "What's for dinner?" that calls `onNavigate('conversation')`
3. Update the `currentView` prop type to include `'conversation'`

**Evidence**: `src/renderer/App.tsx:2` (NavigationBar import), App.tsx usage shows it receives `currentView` and `onNavigate` props

**Pseudocode** (structure will depend on existing component):

```typescript
interface NavigationBarProps {
  currentView: 'add' | 'list' | 'ai-generation' | 'import' | 'conversation'; // ADD 'conversation'
  onNavigate: (view: 'add' | 'list' | 'ai-generation' | 'import' | 'conversation') => void; // ADD 'conversation'
}

// Add button in JSX:
<button
  onClick={() => onNavigate('conversation')}
  className={currentView === 'conversation' ? 'active' : ''}
>
  What's for dinner?
</button>
```

**Done When**:

- [ ] File read to understand existing structure
- [ ] "What's for dinner?" button added
- [ ] `currentView` and `onNavigate` types updated to include `'conversation'`
- [ ] TypeScript compiles without errors
- [ ] Button visually indicates active state when on conversation view

---

### PLAN-009: Write Unit Tests for Session Manager

**Change Type**: create  
**File**: `src/main/conversation/session-manager.test.ts`

**Instruction**:

1. Create unit tests for all exported functions in `session-manager.ts`
2. Test cases:
   - `createSession()` generates unique sessionId
   - `getSession()` retrieves existing session
   - `getSession()` returns null for non-existent session
   - `updateSessionMessages()` adds message to session
   - `updateSessionMessages()` increments turnCount
   - `updateSessionMessages()` updates lastActivity
   - `abandonSession()` deletes session
   - `cleanupStaleSessions()` removes sessions older than 30 minutes

**Evidence**: Existing test pattern in `src/main/database/dal/recipes.test.ts`

**Pseudocode**:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSession,
  getSession,
  updateSessionMessages,
  abandonSession,
  cleanupStaleSessions,
} from './session-manager.js';
import type { ConversationMessage } from '../../shared/types/conversation.js';

describe('Session Manager', () => {
  describe('createSession', () => {
    it('should create session with unique ID', async () => {
      const sessionId = await createSession();
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });

    it('should store session in memory', async () => {
      const sessionId = await createSession();
      const session = getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
      expect(session?.state).toBe('gathering');
    });
  });

  describe('getSession', () => {
    it('should retrieve existing session', async () => {
      const sessionId = await createSession();
      const session = getSession(sessionId);
      expect(session).not.toBeNull();
    });

    it('should return null for non-existent session', () => {
      const session = getSession('non-existent-id');
      expect(session).toBeNull();
    });
  });

  describe('updateSessionMessages', () => {
    it('should add message to session', async () => {
      const sessionId = await createSession();
      const message: ConversationMessage = {
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      };
      updateSessionMessages(sessionId, message);
      const session = getSession(sessionId);
      expect(session?.messages).toHaveLength(1);
      expect(session?.messages[0].content).toBe('Hello');
    });

    it('should increment turn count', async () => {
      const sessionId = await createSession();
      const message: ConversationMessage = {
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      };
      updateSessionMessages(sessionId, message);
      const session = getSession(sessionId);
      expect(session?.turnCount).toBe(1);
    });
  });

  describe('abandonSession', () => {
    it('should delete session from memory', async () => {
      const sessionId = await createSession();
      abandonSession(sessionId);
      const session = getSession(sessionId);
      expect(session).toBeNull();
    });
  });

  // cleanupStaleSessions test would require mocking time
});
```

**Done When**:

- [ ] Test file created
- [ ] All 8 test cases pass
- [ ] Tests run successfully with `npm test`
- [ ] Code coverage includes session-manager.ts

---

### PLAN-010: Write Integration Tests for IPC Message Flow

**Change Type**: create  
**File**: `src/main/ipc/conversation-handlers.test.ts`

**Instruction**:

1. Create integration tests for all 3 IPC handlers
2. Mock Electron IPC events with `senderFrame.url = 'file://test'`
3. Test cases:
   - `conversation:start` returns sessionId
   - `conversation:start` rejects unauthorized sender
   - `conversation:sendMessage` echoes message back
   - `conversation:sendMessage` rejects invalid sessionId
   - `conversation:sendMessage` rejects unauthorized sender
   - `conversation:abandon` cleans up session
   - `conversation:abandon` rejects unauthorized sender

**Evidence**: Existing IPC handler test pattern in `src/main/ipc/recipe-ai-handlers.test.ts`

**Pseudocode**:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ipcMain } from 'electron';
import { registerConversationHandlers } from './conversation-handlers.js';

describe('Conversation IPC Handlers', () => {
  beforeEach(() => {
    // Clear all handlers
    ipcMain.removeAllListeners();
    registerConversationHandlers();
  });

  describe('conversation:start', () => {
    it('should return sessionId', async () => {
      const mockEvent = {
        senderFrame: { url: 'file://test' },
      };
      const handler = ipcMain.listeners('conversation:start')[0];
      const result = await handler(mockEvent);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
    });

    it('should reject unauthorized sender', async () => {
      const mockEvent = {
        senderFrame: { url: 'https://evil.com' },
      };
      const handler = ipcMain.listeners('conversation:start')[0];
      const result = await handler(mockEvent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });

  describe('conversation:sendMessage', () => {
    it('should echo message back', async () => {
      // First start session
      const mockEvent = { senderFrame: { url: 'file://test' } };
      const startHandler = ipcMain.listeners('conversation:start')[0];
      const startResult = await startHandler(mockEvent);
      const sessionId = startResult.sessionId;

      // Send message
      const messageHandler = ipcMain.listeners('conversation:sendMessage')[0];
      const result = await messageHandler(mockEvent, sessionId, 'Hello');

      expect(result.success).toBe(true);
      expect(result.aiMessage).toBe('Echo: Hello');
    });

    it('should reject invalid sessionId', async () => {
      const mockEvent = { senderFrame: { url: 'file://test' } };
      const handler = ipcMain.listeners('conversation:sendMessage')[0];
      const result = await handler(mockEvent, 'invalid-id', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session not found');
    });
  });

  describe('conversation:abandon', () => {
    it('should clean up session', async () => {
      const mockEvent = { senderFrame: { url: 'file://test' } };

      // Start session
      const startHandler = ipcMain.listeners('conversation:start')[0];
      const startResult = await startHandler(mockEvent);
      const sessionId = startResult.sessionId;

      // Abandon session
      const abandonHandler = ipcMain.listeners('conversation:abandon')[0];
      const result = await abandonHandler(mockEvent, sessionId);
      expect(result.success).toBe(true);

      // Verify session is gone
      const messageHandler = ipcMain.listeners('conversation:sendMessage')[0];
      const sendResult = await messageHandler(mockEvent, sessionId, 'Test');
      expect(sendResult.success).toBe(false);
    });
  });
});
```

**Done When**:

- [ ] Test file created
- [ ] All 7 test cases pass
- [ ] Tests run successfully with `npm test`
- [ ] Code coverage includes conversation-handlers.ts

---

## Verification Tasks

**No Assumptions in This Plan**: All files referenced have been verified to exist or are new files explicitly defined.

---

## Acceptance Criteria

### Functional Criteria (User-Facing)

- [ ] User can click "What's for dinner?" button in navigation
- [ ] Conversation page loads with session initialized
- [ ] User can type message in input field
- [ ] User can click "Send" button or press Enter
- [ ] Message appears in chat UI immediately (optimistic update)
- [ ] AI responds with "Echo: {message}" within 1 second
- [ ] Message list scrolls to bottom automatically
- [ ] User can send multiple messages in sequence
- [ ] Closing the conversation page cleans up session
- [ ] Navigating away from conversation page cleans up session

### Technical Criteria (System-Level)

- [ ] Session manager creates unique session IDs
- [ ] Session manager stores sessions in memory (Map)
- [ ] Session cleanup runs every 10 minutes
- [ ] IPC handlers validate sender security
- [ ] IPC handlers return structured result types
- [ ] Preload API exposes `conversationAPI` methods
- [ ] TypeScript types are correctly defined
- [ ] No TypeScript compilation errors (`npm run typecheck`)
- [ ] No linting errors (`npm run lint`)

### Quality Criteria (Testing/Verification)

- [ ] All unit tests pass (`npm test`)
- [ ] Session manager has 100% test coverage
- [ ] IPC handlers have 100% test coverage
- [ ] Integration tests verify end-to-end message flow
- [ ] Manual testing confirms UI works as expected

---

## Implementor Checklist

- [ ] PLAN-001: Create Session Manager (Main Process)
- [ ] PLAN-002: Create IPC Handlers for Conversation (Main Process)
- [ ] PLAN-003: Register Conversation Handlers in Main Process
- [ ] PLAN-004: Expose Conversation API in Preload
- [ ] PLAN-005: Update Electron API Type Definitions
- [ ] PLAN-006: Create Conversation Page Component
- [ ] PLAN-007: Integrate Conversation Page into App Navigation
- [ ] PLAN-008: Add Navigation Button to NavigationBar
- [ ] PLAN-009: Write Unit Tests for Session Manager
- [ ] PLAN-010: Write Integration Tests for IPC Message Flow

**Total Tasks**: 10

---

## Dependencies

### Prerequisites (Must Be Complete Before Starting)

- ✅ **Phase 0: Data Foundation** - `ConversationSession`, `ConversationMessage`, `UserContext` types must exist in `src/shared/types/conversation.ts`
  - **Verification**: Read `src/shared/types/conversation.ts:61-88` - CONFIRMED types exist

### Blockers (External)

- None. Phase 1 has no external dependencies.

---

## Risk Register

### Technical Risks

| Risk                                                | Impact                                       | Probability | Mitigation                                                              |
| --------------------------------------------------- | -------------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| **Session cleanup interferes with active sessions** | Medium (users lose session mid-conversation) | Low         | Use 30-minute timeout (generous), test cleanup logic thoroughly         |
| **Memory leak from abandoned sessions**             | Low (session data is small)                  | Medium      | Cleanup timer runs every 10 minutes, unit tests verify cleanup          |
| **Race condition in session creation**              | Low (sessionId collision)                    | Very Low    | Use `randomUUID()` (cryptographically strong, collision probability ~0) |

### User Experience Risks

| Risk                                      | Impact                             | Probability | Mitigation                                                        |
| ----------------------------------------- | ---------------------------------- | ----------- | ----------------------------------------------------------------- |
| **User confused by echo responses**       | Low (Phase 1 is internal testing)  | High        | Add placeholder text: "AI integration coming in Phase 2"          |
| **Session lost on accidental navigation** | Low (no real data loss in Phase 1) | Medium      | Cleanup is correct behavior; Phase 2 will add confirmation dialog |

---

## Next Steps

### After Phase 1 Completion

1. **Verification**: Run all tests, manual testing of conversation flow
2. **Update STATE File**: Mark all PLAN-XXX tasks as complete
3. **Notify Planner**: Request Phase 2 detailed plan (AI Integration & Contextual Questions)

### For Phase 2 Preview

Phase 2 will:

- Replace echo logic with actual OpenAI API calls
- Implement contextual question generation
- Capture user context (energy, time, mood)
- Transition conversation state from `gathering` → `suggesting`

---

## Appendix: Key References

### Codebase References (Verified)

- IPC handler pattern: `src/main/ipc/recipe-ai-handlers.ts:26-67`
- Preload API pattern: `src/main/preload.ts:10-48`
- App navigation pattern: `src/renderer/App.tsx:9-42`
- Conversation types: `src/shared/types/conversation.ts:61-88`
- Electron API types: `src/shared/types/electron.d.ts:6-42`

### Research References

- Conversation state management: Research lines 162-228
- UI architecture (useReducer): Research lines 419-442
- Optimistic UI updates: Research lines 486-495
- Architecture recommendations: Research lines 671-831

### Master Plan References

- Phase 1 overview: Master Plan lines 83-115
- Acceptance criteria: Master Plan lines 347-385
- Architecture decisions: Master Plan lines 394-412

---

**End of Phase 1 Plan**

**Status**: Ready for implementation

**Next Document**: `2026-01-06-Conversational-Decision-Support-Phase1-STATE.md` (created when implementation begins)
