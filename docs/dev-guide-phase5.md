# Developer Guide: Phase 5 - AI Recipe Generation

## Architecture Overview

### Component Diagram

```
RecipeGenerationPage (Renderer)
  ↓ IPC: recipe:generate
recipe-ai-handlers.ts (Main Process)
  ↓ calls
recipe-generator.ts (AI Service)
  ↓ OpenAI API
gpt-4o-mini with Structured Outputs
  ↓ returns
CreateRecipeInput (validated)
  ↓ saved via
createRecipe() DAL (existing)
```

### File Structure

```
src/
├── main/
│   ├── ai/
│   │   ├── recipe-schema.ts          # Zod schemas
│   │   ├── recipe-schema.test.ts
│   │   ├── recipe-generator.ts       # OpenAI integration
│   │   └── recipe-generator.test.ts
│   └── ipc/
│       ├── recipe-ai-handlers.ts     # IPC handlers
│       └── recipe-ai-handlers.test.ts
├── renderer/
│   └── pages/
│       └── RecipeGenerationPage.tsx
└── shared/
    └── types/
        └── ai.ts                      # AI-specific types
```

## OpenAI Structured Outputs

### Why Structured Outputs?

- **Guaranteed schema compliance**: 100% adherence vs ~40% with JSON mode
- **Type safety**: Zod schema → TypeScript types via `z.infer<>`
- **No parsing errors**: OpenAI handles JSON generation internally
- **Automatic validation**: Rejects invalid outputs before returning

### Schema Design

**Key Decision**: Zod schema mirrors `CreateRecipeInput` type exactly (minus `sourceType`/`sourceReference`).

**Rationale**:

- Single source of truth for recipe structure
- AI output can be directly passed to existing `createRecipe()` DAL
- TypeScript inference provides compile-time type safety

**Example**:

```typescript
export const RecipeGenerationSchema = z.object({
  title: z.string().min(1).max(200),
  cookingTimeMinutes: z.number().int().min(30).max(45), // HARD constraint
  servings: z.literal(2), // MUST be exactly 2
  // ... other fields
});

type RecipeGenerationOutput = z.infer<typeof RecipeGenerationSchema>;
// Type is compatible with CreateRecipeInput
```

## Prompt Engineering

### System Prompt Strategy

Fixed system prompt emphasizes:

1. **Constraint compliance**: NEVER violate cooking time, servings, cookware, dietary
2. **Precision**: Exact measurements, not ranges
3. **Dietary properties**: Accurate marking (contains-gluten, etc.)
4. **Home cook focus**: Practical, achievable recipes

### User Prompt Strategy

Dynamic prompt constructed from `RecipeGenerationCriteria`:

- Include only specified criteria (don't force defaults)
- Emphasize MUST vs SHOULD constraints
- Provide context (cuisine, flavor profile, skill level)

### Temperature Selection

- **0.8**: Creative but coherent (chosen for recipe generation)
- **0.3-0.5**: More deterministic (use for factual content)
- **1.0**: Maximum creativity (too random for recipes)

## Error Handling

### Error Type Hierarchy

```typescript
type ErrorType =
  | 'rate-limit' // 429 - Wait and retry
  | 'network' // Connection failed
  | 'auth' // 401 - Invalid API key
  | 'timeout' // Request took too long
  | 'validation' // Generated recipe failed constraints
  | 'refusal' // AI refused (safety)
  | 'unknown'; // Unexpected error
```

### Retry Strategy

**Built-in retries** (OpenAI SDK default):

- Max retries: 2
- Retry on: Connection errors, 408, 429, ≥500
- Exponential backoff

**User-initiated retries**:

- Rate limit: Show countdown timer, enable retry button
- Network: Immediate retry allowed
- Validation: Automatic regeneration (no user action)

### Belt-and-Suspenders Validation

Even though Structured Outputs enforces schema compliance, we still validate with `validateRecipe()`:

**Rationale**:

- Catches edge cases (e.g., AI marks butter as "none" instead of "contains-lactose")
- Provides consistent error messaging
- Defense in depth

## Testing Strategy

### Unit Tests (Mocked)

**DO**: Mock OpenAI SDK for all unit tests

```typescript
vi.mock('openai', () => {
  const MockOpenAI = vi.fn(() => ({
    chat: { completions: { parse: vi.fn() } },
  }));
  return { default: MockOpenAI };
});
```

**Rationale**:

- Zero API cost
- Fast execution (<100ms vs 5-15 seconds)
- Deterministic results
- Test error handling

### Integration Tests (Conditional)

**DO**: Gate real API tests behind environment variable

```typescript
const hasApiKey = !!process.env.OPENAI_API_KEY;

describe.skipIf(!hasApiKey)('OpenAI Integration', () => {
  it('should generate real recipe', async () => {
    // Real API call
  }, 30000); // 30s timeout
});
```

**Rationale**:

- Only run on CI or when explicitly testing
- Monitor cost (~$0.001 per test)
- Validate against real API behavior

### E2E Tests (Mocked)

**DO**: Mock `window.electronAPI.generateRecipe()` in E2E tests

```typescript
await page.evaluate(() => {
  window.electronAPI.generateRecipe = async () => ({
    success: true,
    recipe: {
      /* ... */
    },
  });
});
```

**Rationale**:

- E2E tests focus on UI/UX, not API integration
- Playwright tests run frequently (every commit)
- Avoid API costs in CI

## Cost Management

### Monitoring

1. **OpenAI Dashboard**: https://platform.openai.com/account/usage
2. **Set budget alerts**: Settings → Billing → Budget alerts
3. **Track usage**: Log recipe generation counts locally (optional)

### Optimization Opportunities (Future)

1. **Prompt caching**: OpenAI's cache feature reduces input token cost by 90%
   - System prompt is cached automatically after first use
   - Reduces cost to ~$0.0006 per recipe
2. **Batch generation**: Generate multiple recipes in one request
3. **Fine-tuning**: Train custom model on your recipe format (advanced)

### Cost Estimation

**Current (gpt-4o-mini)**:

- Input: ~1,500 tokens × $0.15/1M = $0.000225
- Output: ~1,000 tokens × $0.60/1M = $0.000600
- **Total: ~$0.000825 per recipe**

**With caching**:

- Input: ~1,500 tokens × $0.015/1M = $0.0000225 (cached system prompt)
- Output: ~1,000 tokens × $0.60/1M = $0.000600
- **Total: ~$0.0006225 per recipe** (25% reduction)

## Security

### API Key Management

**Development**:

```bash
# .env file (NEVER commit!)
OPENAI_API_KEY=sk-proj-...
```

**Production** (future):

```typescript
import { safeStorage } from 'electron';

// Encrypt and store
const encrypted = safeStorage.encryptString(apiKey);
fs.writeFileSync(configPath, encrypted);

// Load and decrypt
const decrypted = safeStorage.decryptString(fs.readFileSync(configPath));
```

### IPC Security

**Always validate sender**:

```typescript
function validateSender(frame: WebFrameMain): boolean {
  const url = new URL(frame.url);
  return url.protocol === 'file:' || url.host === 'localhost';
}
```

**Rationale**: Prevents malicious external pages from calling IPC handlers.

## Common Tasks

### Adding New Criteria Field

1. Update `RecipeGenerationCriteria` in `shared/types/ai.ts`
2. Update `buildUserPrompt()` in `recipe-generator.ts`
3. Add form field in `RecipeGenerationPage.tsx`
4. Update tests

### Changing Model

```typescript
// In recipe-generator.ts
const completion = await openai.chat.completions.parse({
  model: 'gpt-4o', // Change here
  // ... rest unchanged
});
```

**Note**: Verify model supports Structured Outputs (gpt-4o-2024-08-06+).

### Debugging Failed Generations

1. Check OpenAI dashboard for error logs
2. Log full prompt (system + user) to console
3. Check validation errors (belt-and-suspenders catch)
4. Verify schema constraints match prompt instructions

## Troubleshooting

### "Module not found: openai"

**Solution**: Run `npm install openai zod`

### "Cannot read property 'parsed' of undefined"

**Cause**: OpenAI API returned unexpected format  
**Solution**: Check if API key is valid, verify model supports Structured Outputs

### Tests fail with "OPENAI_API_KEY is not defined"

**Cause**: Unit tests should not access env vars (use mocks)  
**Solution**: Verify mocks are set up correctly, check `vi.mock('openai')` is called

### Generated recipes always fail validation

**Cause**: Mismatch between prompt constraints and Zod schema  
**Solution**: Ensure system prompt emphasizes same constraints as schema (30-45 min, servings=2, etc.)
