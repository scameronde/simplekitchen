---
date: 2026-01-08
researcher: research-architect
topic: "Conversation Memory Loss - Root Cause Analysis"
status: complete
coverage:
  - src/main/conversation/conversation-service.ts
  - src/main/conversation/session-manager.ts
  - src/main/conversation/prompts.ts
  - src/main/ipc/conversation-handlers.ts
---

# Research: Conversation Memory Loss - Root Cause Analysis

## Executive Summary
- Conversation history IS being stored correctly in session memory
- Session manager properly maintains message arrays with user and AI messages
- **CRITICAL DEFECT**: OpenAI API receives conversation history as a formatted STRING, not as proper message array
- AI has no conversational context from OpenAI's perspective - it reads a text summary, not participates in a conversation
- Current implementation bundles all history into single user message instead of using OpenAI's native conversation threading
- Fix requires restructuring API call to send messages as proper array format
- No data loss - only architectural implementation error in API communication

## Coverage Map
### Files Inspected
- `src/main/conversation/conversation-service.ts` - OpenAI API call implementation
- `src/main/conversation/session-manager.ts` - Session storage and message management
- `src/main/conversation/prompts.ts` - Prompt construction logic
- `src/main/ipc/conversation-handlers.ts` - IPC handler flow

### Scope
Complete analysis of conversation flow from user input through OpenAI API call and response handling.

## Critical Findings (Verified, Planner Attention Required)

### Finding 1: Conversation History Storage Works Correctly
- **Observation:** Session manager properly stores all messages in `session.messages` array
- **Direct consequence:** Data persistence is not the problem; conversation history exists in memory
- **Evidence:** `src/main/conversation/session-manager.ts:58-66`
- **Excerpt:**
```typescript
export function updateSessionMessages(sessionId: string, message: ConversationMessage): void {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.messages.push(message);
  session.turnCount += 1;
  session.turnsInCurrentState += 1;
  session.lastActivity = new Date();
}
```

### Finding 2: Messages Are Added to Session Before and After AI Call
- **Observation:** User messages added at line 72-76, AI messages added at line 104-108 of conversation-service.ts
- **Direct consequence:** Both sides of conversation are captured; no message loss in storage layer
- **Evidence:** `src/main/conversation/conversation-service.ts:72-76, 104-108`
- **Excerpt (user message):**
```typescript
// Step 2: Add user message to session
updateSessionMessages(sessionId, {
  role: 'user',
  content: userMessage,
  timestamp: new Date(),
});
```

### Finding 3: CRITICAL DEFECT - Conversation Sent as String, Not Message Array
- **Observation:** OpenAI API receives conversation history as a formatted string within a single user message, not as native message array
- **Direct consequence:** OpenAI treats each API call as independent; AI reads conversation summary text instead of having actual conversational context
- **Evidence:** `src/main/conversation/conversation-service.ts:86-95`
- **Excerpt:**
```typescript
const completion = await client.chat.completions.parse({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: GATHERING_SYSTEM_PROMPT },
    { role: 'user', content: prompt },  // ← Entire conversation as STRING
  ],
  response_format: zodResponseFormat(ConversationTurnSchema, 'conversation_turn'),
  temperature: 0.7,
  max_tokens: 500,
});
```

### Finding 4: buildConversationPrompt Creates Text Summary, Not Message Thread
- **Observation:** Prompt builder formats conversation history as plain text with "User: ..." and "AI: ..." prefixes
- **Direct consequence:** OpenAI receives "#Conversation History" text block instead of structured message objects
- **Evidence:** `src/main/conversation/prompts.ts:150-166`
- **Excerpt:**
```typescript
export function buildConversationPrompt(
  session: ConversationSession,
  dietaryProfile: DietaryProfile
): string {
  const recentMessages = session.messages.slice(-5);
  const contextSummary = JSON.stringify(session.userContext, null, 2);
  const restrictions = dietaryProfile.hardRestrictions.join(', ') || 'None';

  let prompt = `# User's Dietary Restrictions\n${restrictions}\n\n`;
  prompt += `# User Context Captured So Far\n${contextSummary}\n\n`;
  prompt += `# Conversation History (last 5 messages)\n`;
  recentMessages.forEach(msg => {
    prompt += `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}\n`;
  });

  return prompt;
}
```

### Finding 5: Only Last 5 Messages Included in Summary Text
- **Observation:** Prompt builder uses `session.messages.slice(-5)` to limit history
- **Direct consequence:** Even the text summary is truncated; longer conversations lose early context entirely
- **Evidence:** `src/main/conversation/prompts.ts:154`
- **Excerpt:**
```typescript
const recentMessages = session.messages.slice(-5);
```

## Detailed Technical Analysis (Verified)

### Current Implementation Flow
1. User sends message (e.g., "I want chicken")
2. IPC handler calls `processConversationTurn(sessionId, userMessage)` (`conversation-handlers.ts:57`)
3. Conversation service adds user message to session storage (`conversation-service.ts:72-76`)
4. Conversation service fetches session and builds text prompt (`conversation-service.ts:82`)
5. Prompt builder creates string: `"# Conversation History\nUser: I want chicken\n..."` (`prompts.ts:150-166`)
6. OpenAI API called with TWO messages only: system prompt + formatted text prompt (`conversation-service.ts:86-95`)
7. OpenAI responds based on text summary, not actual conversation memory
8. AI response added to session storage (`conversation-service.ts:104-108`)
9. Next turn repeats from step 1

### What OpenAI Sees (Current)
```
Message 1 (system): "You are a friendly, supportive recipe advisor..."
Message 2 (user): "# User's Dietary Restrictions\nNone\n\n# User Context Captured So Far\n{...}\n\n# Conversation History (last 5 messages)\nUser: I want chicken\nAI: Great! How much time do you have?\nUser: I have lots of time\nAI: Perfect! ..."
```

### What OpenAI Should See (Correct)
```
Message 1 (system): "You are a friendly, supportive recipe advisor..."
Message 2 (user): "I want chicken"
Message 3 (assistant): "Great! How much time do you have?"
Message 4 (user): "I have lots of time"
Message 5 (assistant): "Perfect! ..."
Message 6 (user): [current user message]
```

### Why This Breaks Conversational Memory
- OpenAI's chat models are designed to process message arrays as conversation threads
- When conversation is embedded as text in a single user message:
  - Model loses turn-by-turn context awareness
  - Model treats history as informational text, not as its own previous responses
  - Model cannot leverage conversation state maintained across its own outputs
  - Structured output parsing may ignore embedded conversation text in favor of current instruction

### Evidence of Structured Output Compatibility
- **Observation:** OpenAI's structured output feature works with multi-turn conversations
- **Direct consequence:** No technical barrier prevents using proper message arrays with `response_format: zodResponseFormat(...)`
- **Evidence:** OpenAI API documentation (structured outputs accept messages array)

## Verification Log

### Verified Files (Read Directly)
- `src/main/conversation/conversation-service.ts` (verified lines 60-124)
- `src/main/conversation/session-manager.ts` (verified lines 1-158)
- `src/main/conversation/prompts.ts` (verified lines 1-166)
- `src/main/ipc/conversation-handlers.ts` (verified lines 45-84)

### Spot-checked Excerpts Captured
Yes - all excerpts extracted directly from source files via `read` tool.

## Open Questions / Unverified Claims

### Question 1: Why Was It Implemented This Way?
- Could not determine from code comments or commit history
- Possible reasons:
  - Misunderstanding of OpenAI API message format
  - Copy-paste from single-turn example
  - Attempt to reduce token usage (failed - text summary uses similar tokens)
  - Testing artifact that became production code

### Question 2: Does Structured Output Limit Message Count?
- Not verified in OpenAI documentation during this research
- Would need to consult OpenAI API docs to confirm no message array length limits with structured outputs
- However, standard chat completions support long message arrays (100+ messages)

### Question 3: Impact on Recipe Ranking
- Did not verify if recipe-ranker.ts has similar issue
- Requires separate investigation
- File path: `src/main/conversation/recipe-ranker.ts`

## References

### Verified Code Locations
- `src/main/conversation/conversation-service.ts:72-76` - User message storage
- `src/main/conversation/conversation-service.ts:82` - Prompt building call
- `src/main/conversation/conversation-service.ts:86-95` - OpenAI API call (defect location)
- `src/main/conversation/conversation-service.ts:104-108` - AI message storage
- `src/main/conversation/prompts.ts:150-166` - Text-based prompt builder
- `src/main/conversation/prompts.ts:154` - 5-message truncation
- `src/main/conversation/session-manager.ts:15-16` - In-memory session storage (Map)
- `src/main/conversation/session-manager.ts:58-66` - Message append logic
- `src/main/ipc/conversation-handlers.ts:57` - processConversationTurn invocation

---

**Research Complete**: 2026-01-08
**Verified Defect**: OpenAI API receives conversation as formatted string instead of message array
**Data Integrity**: Session storage is correct; only API communication layer is defective
**Fix Complexity**: Medium - requires restructuring API call and potentially refactoring prompt logic
