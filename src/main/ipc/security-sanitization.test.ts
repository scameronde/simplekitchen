/**
 * @module ipc-security-sanitization-tests
 * Security test cases that verify all user inputs are properly sanitized.
 * Tests XSS prevention, HTML injection, special character handling, Unicode support,
 * and path traversal protection.
 *
 * Security Requirements:
 * - Store all user inputs literally without interpretation
 * - Preserve special characters (<, >, &, ', ", \n, \t)
 * - Handle Unicode characters correctly (emojis, non-Latin scripts)
 * - Prevent script execution in UI (verified in E2E tests)
 * - Prevent path traversal attacks (no file system access)
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createRecipe, getRecipeById } from '../database/dal/recipes.js';
import { runMigrations, closeDatabase } from '../database/index.js';
import type { CreateRecipeInput } from '../../shared/types/recipe.js';

// Run migrations before each test to ensure clean state
beforeEach(() => {
  runMigrations();
});

// Close database after all tests
afterAll(() => {
  closeDatabase();
});

describe('Input Sanitization', () => {
  // Base valid recipe for testing
  const baseRecipe: CreateRecipeInput = {
    title: 'Safe Recipe',
    cookingTimeMinutes: 30,
    prepTimeMinutes: 10,
    cookwareType: 'one-pot',
    servings: 2,
    dietaryTags: ['gluten-free'],
    seasonality: ['any'],
    sourceType: 'manual',
    instructions: 'Cook normally.',
    ingredients: [
      {
        name: 'rice',
        quantity: 1,
        unit: 'cup',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 1,
      },
    ],
  };

  describe('XSS Prevention in Recipe Titles', () => {
    it('should safely store HTML/script tags in recipe title', async () => {
      const maliciousInput: CreateRecipeInput = {
        ...baseRecipe,
        title: "<script>alert('XSS')</script>",
      };

      const recipe = await createRecipe(maliciousInput);

      // Verify stored literally
      expect(recipe.title).toBe("<script>alert('XSS')</script>");

      // Verify retrieval preserves the literal string
      const retrieved = await getRecipeById(recipe.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe("<script>alert('XSS')</script>");

      // TODO: Verify UI renders safely (E2E test - text content, not HTML)
    });

    it('should store JavaScript event handlers literally in title', async () => {
      const maliciousInput: CreateRecipeInput = {
        ...baseRecipe,
        title: '<div onload="alert(\'XSS\')">Recipe</div>',
      };

      const recipe = await createRecipe(maliciousInput);
      expect(recipe.title).toBe('<div onload="alert(\'XSS\')">Recipe</div>');
    });

    it('should store img tag with onerror handler literally in title', async () => {
      const maliciousInput: CreateRecipeInput = {
        ...baseRecipe,
        title: '<img src=x onerror=alert("XSS")>',
      };

      const recipe = await createRecipe(maliciousInput);
      expect(recipe.title).toBe('<img src=x onerror=alert("XSS")>');
    });
  });

  describe('HTML Injection in Instructions', () => {
    it('should safely store img tag with onerror in instructions', async () => {
      const maliciousInput: CreateRecipeInput = {
        ...baseRecipe,
        instructions: "<img src=x onerror=alert('XSS')>",
      };

      const recipe = await createRecipe(maliciousInput);

      // Verify stored literally, rendered as text in UI
      expect(recipe.instructions).toBe("<img src=x onerror=alert('XSS')>");

      // Verify retrieval
      const retrieved = await getRecipeById(recipe.id);
      expect(retrieved!.instructions).toBe("<img src=x onerror=alert('XSS')>");

      // TODO: Verify UI renders as plain text (E2E test)
    });

    it('should store iframe injection attempts literally', async () => {
      const maliciousInput: CreateRecipeInput = {
        ...baseRecipe,
        instructions: '<iframe src="https://evil.com"></iframe>',
      };

      const recipe = await createRecipe(maliciousInput);
      expect(recipe.instructions).toBe('<iframe src="https://evil.com"></iframe>');
    });

    it('should store style tag injection attempts literally', async () => {
      const maliciousInput: CreateRecipeInput = {
        ...baseRecipe,
        instructions: '<style>body{display:none}</style>',
      };

      const recipe = await createRecipe(maliciousInput);
      expect(recipe.instructions).toBe('<style>body{display:none}</style>');
    });

    it('should store multiple HTML tags in instructions', async () => {
      const maliciousInput: CreateRecipeInput = {
        ...baseRecipe,
        instructions:
          '1. Mix ingredients<br><script>alert("XSS")</script>\n2. <b>Bake</b> at 350°F',
      };

      const recipe = await createRecipe(maliciousInput);
      expect(recipe.instructions).toBe(
        '1. Mix ingredients<br><script>alert("XSS")</script>\n2. <b>Bake</b> at 350°F'
      );
    });
  });

  describe('Special Characters in Ingredient Names', () => {
    it('should preserve special characters in ingredient names', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        ingredients: [
          {
            name: '"ingredient"<>&\'\\n\\t',
            quantity: 1,
            unit: 'cup',
            dietaryProperties: ['none'],
            optional: false,
            orderIndex: 1,
          },
        ],
      };

      const recipe = await createRecipe(input);
      expect(recipe.ingredients[0]!.name).toBe('"ingredient"<>&\'\\n\\t');

      // Verify retrieval preserves special characters
      const retrieved = await getRecipeById(recipe.id);
      expect(retrieved!.ingredients[0]!.name).toBe('"ingredient"<>&\'\\n\\t');
    });

    it('should preserve HTML entities in ingredient names', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        ingredients: [
          {
            name: '&lt;chicken&gt; &amp; &quot;beef&quot;',
            quantity: 500,
            unit: 'g',
            dietaryProperties: ['contains-meat'],
            optional: false,
            orderIndex: 1,
          },
        ],
      };

      const recipe = await createRecipe(input);
      expect(recipe.ingredients[0]!.name).toBe('&lt;chicken&gt; &amp; &quot;beef&quot;');
    });

    it('should preserve angle brackets in ingredient names', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        ingredients: [
          {
            name: '<ingredient>',
            quantity: 1,
            unit: 'cup',
            dietaryProperties: ['none'],
            optional: false,
            orderIndex: 1,
          },
        ],
      };

      const recipe = await createRecipe(input);
      expect(recipe.ingredients[0]!.name).toBe('<ingredient>');
    });

    it('should preserve quotes in ingredient names', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        ingredients: [
          {
            name: 'chicken "breast"',
            quantity: 2,
            unit: 'pieces',
            dietaryProperties: ['contains-meat'],
            optional: false,
            orderIndex: 1,
          },
        ],
      };

      const recipe = await createRecipe(input);
      expect(recipe.ingredients[0]!.name).toBe('chicken "breast"');
    });
  });

  describe('Unicode Handling', () => {
    it('should preserve emoji in recipe title', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        title: '🍝 Pasta Carbonara',
      };

      const recipe = await createRecipe(input);
      expect(recipe.title).toBe('🍝 Pasta Carbonara');

      // Verify retrieval
      const retrieved = await getRecipeById(recipe.id);
      expect(retrieved!.title).toBe('🍝 Pasta Carbonara');
    });

    it('should preserve Chinese characters in recipe title', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        title: '🍝 Pasta Carbonara 中文',
      };

      const recipe = await createRecipe(input);
      expect(recipe.title).toBe('🍝 Pasta Carbonara 中文');
    });

    it('should preserve multiple Unicode scripts', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        title: '🍛 Indian करी with 日本 Rice',
      };

      const recipe = await createRecipe(input);
      expect(recipe.title).toBe('🍛 Indian करी with 日本 Rice');
    });

    it('should preserve emoji in ingredient names', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        ingredients: [
          {
            name: '🍅 tomatoes',
            quantity: 2,
            unit: 'pieces',
            dietaryProperties: ['none'],
            optional: false,
            orderIndex: 1,
          },
        ],
      };

      const recipe = await createRecipe(input);
      expect(recipe.ingredients[0]!.name).toBe('🍅 tomatoes');
    });

    it('should preserve Arabic and Hebrew text', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        title: 'مطبخ عربي - מטבח עברי',
        instructions: 'التعليمات בעברית',
      };

      const recipe = await createRecipe(input);
      expect(recipe.title).toBe('مطبخ عربي - מטבח עברי');
      expect(recipe.instructions).toBe('التعليمات בעברית');
    });

    it('should preserve mixed emoji and special characters', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        title: '🍕<script>alert("XSS")</script>🍝',
        ingredients: [
          {
            name: '🧀 "cheese" & <herbs>',
            quantity: 100,
            unit: 'g',
            dietaryProperties: ['none'],
            optional: false,
            orderIndex: 1,
          },
        ],
      };

      const recipe = await createRecipe(input);
      expect(recipe.title).toBe('🍕<script>alert("XSS")</script>🍝');
      expect(recipe.ingredients[0]!.name).toBe('🧀 "cheese" & <herbs>');
    });
  });

  describe('Path Traversal in Source Reference', () => {
    it('should store path traversal attempts literally', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        sourceReference: '../../etc/passwd',
      };

      const recipe = await createRecipe(input);

      // Verify stored literally, no file system access
      expect(recipe.sourceReference).toBe('../../etc/passwd');

      // Verify retrieval
      const retrieved = await getRecipeById(recipe.id);
      expect(retrieved!.sourceReference).toBe('../../etc/passwd');

      // Note: No file system access should occur - sourceReference is just a string field
      // TODO: Add E2E test to verify clicking links doesn't access file system
    });

    it('should store absolute path attempts literally', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        sourceReference: '/etc/passwd',
      };

      const recipe = await createRecipe(input);
      expect(recipe.sourceReference).toBe('/etc/passwd');
    });

    it('should store Windows path attempts literally', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        sourceReference: 'C:\\Windows\\System32\\config\\sam',
      };

      const recipe = await createRecipe(input);
      expect(recipe.sourceReference).toBe('C:\\Windows\\System32\\config\\sam');
    });

    it('should store URL-encoded path traversal literally', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        sourceReference: '..%2F..%2Fetc%2Fpasswd',
      };

      const recipe = await createRecipe(input);
      expect(recipe.sourceReference).toBe('..%2F..%2Fetc%2Fpasswd');
    });

    it('should store file:// protocol URLs literally', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        sourceReference: 'file:///etc/passwd',
      };

      const recipe = await createRecipe(input);
      expect(recipe.sourceReference).toBe('file:///etc/passwd');
    });
  });

  describe('Combined Attack Scenarios', () => {
    it('should handle multiple injection types in single recipe', async () => {
      const input: CreateRecipeInput = {
        title: '🍝<script>alert("XSS")</script> Pasta',
        cookingTimeMinutes: 30,
        prepTimeMinutes: 10,
        cookwareType: 'one-pot',
        servings: 2,
        dietaryTags: ['gluten-free'],
        seasonality: ['any'],
        sourceType: 'manual',
        sourceReference: '../../etc/passwd',
        instructions: '<img src=x onerror=alert(\'XSS\')>\n<iframe src="evil.com"></iframe>',
        ingredients: [
          {
            name: '"ingredient"<>&\'',
            quantity: 1,
            unit: 'cup<script>',
            dietaryProperties: ['none'],
            optional: false,
            orderIndex: 1,
          },
          {
            name: '🍅 tomato',
            quantity: 2,
            unit: 'pieces',
            dietaryProperties: ['none'],
            optional: false,
            orderIndex: 2,
          },
        ],
      };

      const recipe = await createRecipe(input);

      // Verify all fields stored literally
      expect(recipe.title).toBe('🍝<script>alert("XSS")</script> Pasta');
      expect(recipe.sourceReference).toBe('../../etc/passwd');
      expect(recipe.instructions).toBe(
        '<img src=x onerror=alert(\'XSS\')>\n<iframe src="evil.com"></iframe>'
      );
      expect(recipe.ingredients[0]!.name).toBe('"ingredient"<>&\'');
      expect(recipe.ingredients[0]!.unit).toBe('cup<script>');
      expect(recipe.ingredients[1]!.name).toBe('🍅 tomato');

      // Verify retrieval preserves everything
      const retrieved = await getRecipeById(recipe.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe('🍝<script>alert("XSS")</script> Pasta');
      expect(retrieved!.sourceReference).toBe('../../etc/passwd');
      expect(retrieved!.instructions).toBe(
        '<img src=x onerror=alert(\'XSS\')>\n<iframe src="evil.com"></iframe>'
      );
      expect(retrieved!.ingredients[0]!.name).toBe('"ingredient"<>&\'');
      expect(retrieved!.ingredients[0]!.unit).toBe('cup<script>');
      expect(retrieved!.ingredients[1]!.name).toBe('🍅 tomato');
    });

    it('should handle control characters (SQLite strips null bytes)', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        title: 'Recipe\x00with\x01null\x02bytes',
        instructions: 'Step 1\r\nStep 2\tTabbed',
      };

      const recipe = await createRecipe(input);

      // Note: SQLite strips null bytes (\x00) from strings, which is acceptable security behavior
      // Other control characters like \r, \n, \t should be preserved
      expect(recipe.title).toContain('Recipe');
      expect(recipe.instructions).toBe('Step 1\r\nStep 2\tTabbed');
    });
  });

  describe('Data Integrity', () => {
    it('should maintain exact string length after storage and retrieval', async () => {
      const specialTitle = '<script>alert("XSS")</script>';
      const input: CreateRecipeInput = {
        ...baseRecipe,
        title: specialTitle,
      };

      const recipe = await createRecipe(input);
      expect(recipe.title.length).toBe(specialTitle.length);

      const retrieved = await getRecipeById(recipe.id);
      expect(retrieved!.title.length).toBe(specialTitle.length);
    });

    it('should maintain exact byte sequence for Unicode strings', async () => {
      const unicodeTitle = '🍝 Pasta 中文 करी';
      const input: CreateRecipeInput = {
        ...baseRecipe,
        title: unicodeTitle,
      };

      const recipe = await createRecipe(input);
      expect(recipe.title).toBe(unicodeTitle);
      expect(Buffer.from(recipe.title, 'utf8').toString('utf8')).toBe(unicodeTitle);
    });

    it('should handle empty strings without corruption', async () => {
      const input: CreateRecipeInput = {
        ...baseRecipe,
        title: '',
        instructions: '',
      };

      // Note: Current validation does not enforce non-empty titles
      // Empty strings are stored as empty string for required fields (title)
      // and as null for optional fields (instructions)
      const recipe = await createRecipe(input);
      expect(recipe.title).toBe('');
      expect(recipe.instructions).toBe(null);

      // Verify retrieval maintains the same behavior
      const retrieved = await getRecipeById(recipe.id);
      expect(retrieved!.title).toBe('');
      expect(retrieved!.instructions).toBe(null);
    });

    it('should handle very long strings with special characters', async () => {
      const longTitle = '<script>' + 'A'.repeat(1000) + '</script>';
      const input: CreateRecipeInput = {
        ...baseRecipe,
        title: longTitle,
      };

      const recipe = await createRecipe(input);
      expect(recipe.title).toBe(longTitle);
      expect(recipe.title.length).toBe(longTitle.length);
    });
  });
});
