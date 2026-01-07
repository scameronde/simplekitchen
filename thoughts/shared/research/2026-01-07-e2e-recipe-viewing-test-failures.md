---
date: 2026-01-07
researcher: research-architect
topic: "E2E Recipe Viewing Test Failures - Root Cause Analysis"
status: complete
coverage:
  - e2e/recipe-viewing.spec.ts
  - src/renderer/components/RecipeList/FilterControls.tsx
  - src/renderer/components/common/Checkbox.tsx
  - src/renderer/components/RecipeForm/RecipeBasicInfo.tsx
  - src/shared/constants/dietary-tags.ts
  - src/shared/types/database.ts
---

# Research: E2E Recipe Viewing Test Failures - Root Cause Analysis

## Executive Summary
- Two E2E tests in `recipe-viewing.spec.ts` fail with 30-second timeouts.
- Root cause: Label mismatch between test expectations and actual UI rendering.
- Tests search for "One Pot" (capitalized, space-separated) but UI renders "one-pot" (lowercase, hyphenated).
- FilterControls.tsx uses raw CookwareType values as labels instead of formatted display strings.
- Application inconsistency: RecipeBasicInfo.tsx and other components use formatted labels ("One Pot", "One Pan"), but FilterControls.tsx does not.
- Shared constant pattern exists for dietary tags (DIETARY_TAG_LABELS) but not for cookware types.

## Coverage Map
Inspected files:
- `e2e/recipe-viewing.spec.ts` (test specifications)
- `src/renderer/components/RecipeList/FilterControls.tsx` (filter UI component)
- `src/renderer/components/common/Checkbox.tsx` (checkbox rendering)
- `src/renderer/components/RecipeForm/RecipeBasicInfo.tsx` (recipe form with cookware selection)
- `src/shared/constants/dietary-tags.ts` (pattern for label constants)
- `src/shared/types/database.ts` (CookwareType type definition)

Scope: Complete analysis of failing tests and related UI components.

## Critical Findings (Verified, Planner Attention Required)

### Finding 1: Test Timeout Due to Missing UI Element

**Observation:** Test at line 117 attempts to click element with text "One Pot".
**Direct consequence:** Playwright waits for element to appear, times out after 30 seconds when element never found.
**Evidence:** `e2e/recipe-viewing.spec.ts:117`
**Excerpt:**
```typescript
// Select one-pot filter (which should hide our one-pan recipe)
await window.click('text=One Pot');
```

### Finding 2: FilterControls Renders Raw Type Values as Labels

**Observation:** FilterControls.tsx passes raw CookwareType value directly to Checkbox label prop.
**Direct consequence:** UI displays "one-pot", "one-pan", "oven" (lowercase with hyphens) instead of formatted labels.
**Evidence:** `src/renderer/components/RecipeList/FilterControls.tsx:111-118`
**Excerpt:**
```typescript
{COOKWARE_OPTIONS.map(type => (
  <Checkbox
    key={type}
    label={type}  // Passes "one-pot" directly
    checked={selectedCookware.includes(type)}
    onChange={() => handleCookwareToggle(type)}
  />
))}
```

### Finding 3: Checkbox Component Renders Label Without Transformation

**Observation:** Checkbox component renders label prop as-is with no formatting.
**Direct consequence:** Whatever string is passed becomes the visible text.
**Evidence:** `src/renderer/components/common/Checkbox.tsx:15`
**Excerpt:**
```typescript
<span className="text-sm text-gray-700">{label}</span>
```

### Finding 4: Application Uses Formatted Labels Elsewhere

**Observation:** RecipeBasicInfo.tsx uses formatted cookware labels with proper capitalization and spacing.
**Direct consequence:** Inconsistency in UI—form uses "One Pot", filter uses "one-pot".
**Evidence:** `src/renderer/components/RecipeForm/RecipeBasicInfo.tsx:46-50`
**Excerpt:**
```typescript
options={[
  { value: 'one-pot', label: 'One Pot' },
  { value: 'one-pan', label: 'One Pan' },
  { value: 'oven', label: 'Oven' },
]}
```

### Finding 5: Shared Constant Pattern Exists for Dietary Tags

**Observation:** Dietary tags use DIETARY_TAG_LABELS constant (Record<DietaryTag, string>) and DIETARY_TAG_OPTIONS array.
**Direct consequence:** Dietary tag labels are consistent across application; cookware lacks equivalent constant.
**Evidence:** `src/shared/constants/dietary-tags.ts:20-33`
**Excerpt:**
```typescript
export const DIETARY_TAG_LABELS: Record<DietaryTag, string> = {
  'gluten-free': 'Gluten-Free',
  'lactose-free': 'Lactose-Free',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
};

export const DIETARY_TAG_OPTIONS = (
  Object.entries(DIETARY_TAG_LABELS) as [DietaryTag, string][]
).map(([value, label]) => ({ value, label }));
```

## Detailed Technical Analysis (Verified)

### Test Failure Mechanism

**Test 1: "filters recipes by cookware type" (line 94)**
1. Test creates recipe with cookware type "one-pan"
2. Test navigates to recipe list
3. Test attempts `await window.click('text=One Pot')` at line 117
4. Playwright searches DOM for element containing text "One Pot"
5. No such element exists (actual text is "one-pot")
6. Playwright waits with retries until 30-second timeout
7. Test fails with timeout error

**Test 2: "clears filters and shows all recipes" (line 128)**
Same failure pattern—attempts to click "text=One Pot" at line 151, times out.

### CookwareType Type Definition

**Observation:** CookwareType is defined as union of string literals.
**Evidence:** `src/shared/types/database.ts:11`
**Excerpt:**
```typescript
export type CookwareType = 'one-pot' | 'one-pan' | 'oven';
```

**Direct consequence:** Type system enforces lowercase hyphenated values; display labels must be separate.

### Label Formatting Pattern in Codebase

**Observation:** Multiple components manually define label mappings for cookware types.
**Evidence:** Search results show repeated pattern across files:
- `src/renderer/components/RecipeForm/RecipeBasicInfo.tsx:47-49`
- `src/renderer/components/RecipeList/RecipeCard.tsx:23-24`
- `src/renderer/pages/RecipeDetailPage.tsx:88-89`

**Direct consequence:** No single source of truth for cookware labels; duplication creates maintenance risk and inconsistency.

### COOKWARE_OPTIONS Constant

**Observation:** FilterControls.tsx defines local constant with type values only.
**Evidence:** `src/renderer/components/RecipeList/FilterControls.tsx:20`
**Excerpt:**
```typescript
const COOKWARE_OPTIONS: CookwareType[] = ['one-pot', 'one-pan', 'oven'];
```

**Direct consequence:** Array contains type values suitable for data operations, not display labels.

## Verification Log

**Verified:** 
- `e2e/recipe-viewing.spec.ts:94-126` (failing test 1)
- `e2e/recipe-viewing.spec.ts:128-162` (failing test 2)
- `e2e/recipe-viewing.spec.ts:117` (specific click statement)
- `src/renderer/components/RecipeList/FilterControls.tsx:20` (COOKWARE_OPTIONS)
- `src/renderer/components/RecipeList/FilterControls.tsx:111-118` (checkbox rendering)
- `src/renderer/components/common/Checkbox.tsx:7-18` (label rendering)
- `src/renderer/components/RecipeForm/RecipeBasicInfo.tsx:46-50` (formatted labels)
- `src/shared/constants/dietary-tags.ts:20-33` (label pattern)
- `src/shared/types/database.ts:11` (CookwareType definition)

**Spot-checked excerpts captured:** yes

## Open Questions / Unverified Claims

None. All relevant code paths verified with direct file reads.

## References

- `e2e/recipe-viewing.spec.ts:117` (test click statement)
- `e2e/recipe-viewing.spec.ts:151` (second failing test click)
- `src/renderer/components/RecipeList/FilterControls.tsx:111-118` (checkbox map)
- `src/renderer/components/common/Checkbox.tsx:15` (label rendering)
- `src/renderer/components/RecipeForm/RecipeBasicInfo.tsx:46-50` (existing formatted labels)
- `src/shared/constants/dietary-tags.ts:20-33` (label constant pattern)
- `src/shared/types/database.ts:11` (CookwareType type)
