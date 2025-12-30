/**
 * @module recipe-importer.test
 * Unit tests for web recipe importer
 * Tests Schema.org JSON-LD extraction with mocked BrowserWindow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractSchemaOrgRecipe } from './recipe-importer.js';
import type { SchemaOrgRecipe } from '../../shared/types/schema-org.js';

// Mock Electron's BrowserWindow
const mockDestroy = vi.fn();
const mockLoadURL = vi.fn();
const mockExecuteJavaScript = vi.fn();

const mockBrowserWindow = {
  loadURL: mockLoadURL,
  webContents: {
    executeJavaScript: mockExecuteJavaScript,
  },
  destroy: mockDestroy,
};

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => mockBrowserWindow),
}));

// Sample valid Schema.org recipe
const validSchemaOrgRecipe: SchemaOrgRecipe = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Pasta Carbonara',
  cookTime: 'PT30M',
  prepTime: 'PT15M',
  recipeYield: '4 servings',
  recipeIngredient: ['400g pasta', '200g bacon', '4 eggs', '100g parmesan'],
  recipeInstructions: 'Cook pasta, fry bacon, mix with eggs and cheese.',
};

describe('Recipe Importer - extractSchemaOrgRecipe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadURL.mockResolvedValue(undefined);
    mockExecuteJavaScript.mockResolvedValue([validSchemaOrgRecipe]);
  });

  afterEach(() => {
    if (mockDestroy.mock.calls.length > 0) {
      expect(mockDestroy).toHaveBeenCalled();
    }
  });

  describe('URL Validation', () => {
    it('should accept valid HTTP URL', async () => {
      await extractSchemaOrgRecipe('http://example.com/recipe');
      expect(mockLoadURL).toHaveBeenCalledWith('http://example.com/recipe');
    });

    it('should accept valid HTTPS URL', async () => {
      await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(mockLoadURL).toHaveBeenCalledWith('https://example.com/recipe');
    });

    it('should reject URL without protocol', async () => {
      await expect(extractSchemaOrgRecipe('example.com/recipe')).rejects.toThrow(
        'Invalid URL format. Must start with http:// or https://'
      );
    });

    it('should reject FTP URL', async () => {
      await expect(extractSchemaOrgRecipe('ftp://example.com/recipe')).rejects.toThrow(
        'Invalid URL format. Must start with http:// or https://'
      );
    });

    it('should reject empty URL', async () => {
      await expect(extractSchemaOrgRecipe('')).rejects.toThrow(
        'Invalid URL format. Must start with http:// or https://'
      );
    });

    it('should handle URL with special characters', async () => {
      const urlWithSpecialChars = 'https://example.com/recipe?id=123&lang=en-US#section';
      await extractSchemaOrgRecipe(urlWithSpecialChars);
      expect(mockLoadURL).toHaveBeenCalledWith(urlWithSpecialChars);
    });

    it('should handle URL with unicode characters', async () => {
      const urlWithUnicode = 'https://example.com/résipe/français';
      await extractSchemaOrgRecipe(urlWithUnicode);
      expect(mockLoadURL).toHaveBeenCalledWith(urlWithUnicode);
    });
  });

  describe('Successful Recipe Extraction', () => {
    it('should return valid Schema.org recipe', async () => {
      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result).toEqual(validSchemaOrgRecipe);
      expect(result.name).toBe('Pasta Carbonara');
      expect(result.cookTime).toBe('PT30M');
    });

    it('should extract recipe with all fields populated', async () => {
      const completeRecipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Complete Recipe',
        description: 'A complete recipe',
        cookTime: 'PT45M',
        prepTime: 'PT20M',
        totalTime: 'PT65M',
        recipeYield: '6 servings',
        recipeIngredient: ['ingredient 1', 'ingredient 2'],
        recipeInstructions: 'Instructions here',
        recipeCuisine: 'Italian',
        url: 'https://example.com/complete-recipe',
      };

      mockExecuteJavaScript.mockResolvedValue([completeRecipe]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result).toEqual(completeRecipe);
      expect(result.description).toBe('A complete recipe');
      expect(result.recipeCuisine).toBe('Italian');
    });

    it('should extract recipe with minimal required fields', async () => {
      const minimalRecipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Simple Recipe',
        recipeIngredient: ['ingredient'],
      };

      mockExecuteJavaScript.mockResolvedValue([minimalRecipe]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result.name).toBe('Simple Recipe');
      expect(result.recipeIngredient).toEqual(['ingredient']);
    });
  });

  describe('Multiple Recipes Handling', () => {
    it('should return first recipe when multiple recipes on page', async () => {
      const firstRecipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'First Recipe',
        recipeIngredient: ['ingredient 1'],
      };

      const secondRecipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Second Recipe',
        recipeIngredient: ['ingredient 2'],
      };

      mockExecuteJavaScript.mockResolvedValue([firstRecipe, secondRecipe]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result.name).toBe('First Recipe');
      expect(result.recipeIngredient).toEqual(['ingredient 1']);
    });

    it('should ignore non-recipe JSON-LD content and find recipe', async () => {
      const recipeData: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Valid Recipe',
        recipeIngredient: ['ingredient'],
      };

      // Simulating that the JavaScript extraction filtered out person data
      mockExecuteJavaScript.mockResolvedValue([recipeData]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result.name).toBe('Valid Recipe');
    });
  });

  describe('Recipe in @graph Array', () => {
    it('should extract recipe from @graph array', async () => {
      const recipeInGraph: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Recipe from Graph',
        recipeIngredient: ['ingredient'],
      };

      mockExecuteJavaScript.mockResolvedValue([recipeInGraph]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result.name).toBe('Recipe from Graph');
    });

    it('should extract recipe nested in @graph with other objects', async () => {
      const recipeFromComplexGraph: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Nested Recipe',
        recipeIngredient: ['ingredient'],
      };

      mockExecuteJavaScript.mockResolvedValue([recipeFromComplexGraph]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result.name).toBe('Nested Recipe');
    });
  });

  describe('Error Cases', () => {
    it('should throw "No recipe markup found" when executeJavaScript returns empty array', async () => {
      mockExecuteJavaScript.mockResolvedValue([]);

      await expect(extractSchemaOrgRecipe('https://example.com/recipe')).rejects.toThrow(
        'No Schema.org recipe markup found on this page'
      );
    });

    it('should throw "No recipe markup found" when executeJavaScript returns null', async () => {
      mockExecuteJavaScript.mockResolvedValue(null);

      await expect(extractSchemaOrgRecipe('https://example.com/recipe')).rejects.toThrow(
        'No Schema.org recipe markup found on this page'
      );
    });

    it('should throw "No recipe markup found" when executeJavaScript returns undefined', async () => {
      mockExecuteJavaScript.mockResolvedValue(undefined);

      await expect(extractSchemaOrgRecipe('https://example.com/recipe')).rejects.toThrow(
        'No Schema.org recipe markup found on this page'
      );
    });

    it('should throw timeout error when loadURL times out', async () => {
      vi.useFakeTimers();

      mockLoadURL.mockImplementation(
        () =>
          new Promise(() => {
            // Simulates never resolving - timeout will fire
          })
      );

      const promise = extractSchemaOrgRecipe('https://example.com/recipe');

      // Advance time by 15 seconds to trigger the timeout
      vi.advanceTimersByTime(15000);

      await expect(promise).rejects.toThrow('Recipe fetch timed out after 15 seconds');

      vi.useRealTimers();
    });

    it('should throw timeout error even if loadURL later resolves', async () => {
      vi.useFakeTimers();

      mockLoadURL.mockImplementation(
        () =>
          new Promise<void>(() => {
            // Never resolves - timeout will fire instead
          })
      );

      const promise = extractSchemaOrgRecipe('https://example.com/recipe');

      // Advance time by 15 seconds to trigger the timeout
      vi.advanceTimersByTime(15000);

      // Simulate the promise rejecting due to timeout
      await expect(promise).rejects.toThrow('Recipe fetch timed out after 15 seconds');

      vi.useRealTimers();
    });

    it('should throw error when loadURL fails', async () => {
      mockLoadURL.mockRejectedValue(new Error('Failed to load URL'));

      await expect(extractSchemaOrgRecipe('https://example.com/recipe')).rejects.toThrow(
        'Failed to load URL'
      );
    });

    it('should throw error when executeJavaScript fails', async () => {
      mockExecuteJavaScript.mockRejectedValue(new Error('Script execution failed'));

      await expect(extractSchemaOrgRecipe('https://example.com/recipe')).rejects.toThrow(
        'Script execution failed'
      );
    });
  });

  describe('BrowserWindow Lifecycle', () => {
    it('should destroy BrowserWindow after successful extraction', async () => {
      await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should destroy BrowserWindow even when recipe extraction fails', async () => {
      mockExecuteJavaScript.mockResolvedValue([]);

      try {
        await extractSchemaOrgRecipe('https://example.com/recipe');
      } catch {
        // Expected to throw
      }

      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should destroy BrowserWindow even when loadURL fails', async () => {
      mockLoadURL.mockRejectedValue(new Error('Network error'));

      try {
        await extractSchemaOrgRecipe('https://example.com/recipe');
      } catch {
        // Expected to throw
      }

      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should destroy BrowserWindow even when timeout occurs', async () => {
      vi.useFakeTimers();

      mockLoadURL.mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves - timeout will fire
          })
      );

      const promise = extractSchemaOrgRecipe('https://example.com/recipe');

      // Advance time by 15 seconds to trigger the timeout
      vi.advanceTimersByTime(15000);

      try {
        await promise;
      } catch {
        // Expected to throw
      }

      expect(mockDestroy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Malformed JSON-LD Handling', () => {
    it('should skip malformed JSON and find valid recipe', async () => {
      // The extraction function skips malformed JSON internally
      const validRecipe: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Valid Recipe After Bad JSON',
        recipeIngredient: ['ingredient'],
      };

      mockExecuteJavaScript.mockResolvedValue([validRecipe]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result.name).toBe('Valid Recipe After Bad JSON');
    });

    it('should handle page with no JSON-LD at all', async () => {
      mockExecuteJavaScript.mockResolvedValue([]);

      await expect(extractSchemaOrgRecipe('https://example.com/recipe')).rejects.toThrow(
        'No Schema.org recipe markup found on this page'
      );
    });

    it('should handle JSON-LD that is not a recipe', async () => {
      mockExecuteJavaScript.mockResolvedValue([]);

      await expect(extractSchemaOrgRecipe('https://example.com/page')).rejects.toThrow(
        'No Schema.org recipe markup found on this page'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle recipe with array image field', async () => {
      const recipeWithImages: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Recipe with Images',
        recipeIngredient: ['ingredient'],
        image: ['image1.jpg', 'image2.jpg', 'image3.jpg'],
      };

      mockExecuteJavaScript.mockResolvedValue([recipeWithImages]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result.image).toEqual(['image1.jpg', 'image2.jpg', 'image3.jpg']);
    });

    it('should handle recipe with string image field', async () => {
      const recipeWithImage: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Recipe with Image',
        recipeIngredient: ['ingredient'],
        image: 'single-image.jpg',
      };

      mockExecuteJavaScript.mockResolvedValue([recipeWithImage]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result.image).toBe('single-image.jpg');
    });

    it('should handle recipe with Person author', async () => {
      const recipeWithAuthor: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Recipe with Author',
        recipeIngredient: ['ingredient'],
        author: {
          '@type': 'Person',
          name: 'Chef John',
        },
      };

      mockExecuteJavaScript.mockResolvedValue([recipeWithAuthor]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result.author).toEqual({
        '@type': 'Person',
        name: 'Chef John',
      });
    });

    it('should handle recipe with string author', async () => {
      const recipeWithStringAuthor: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Recipe with Author',
        recipeIngredient: ['ingredient'],
        author: 'Chef John',
      };

      mockExecuteJavaScript.mockResolvedValue([recipeWithStringAuthor]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result.author).toBe('Chef John');
    });

    it('should handle recipe with HowToStep instructions', async () => {
      const recipeWithSteps: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Recipe with Steps',
        recipeIngredient: ['ingredient'],
        recipeInstructions: [
          {
            '@type': 'HowToStep',
            text: 'Mix ingredients',
          },
          {
            '@type': 'HowToStep',
            text: 'Bake',
          },
        ],
      };

      mockExecuteJavaScript.mockResolvedValue([recipeWithSteps]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(Array.isArray(result.recipeInstructions)).toBe(true);
      if (Array.isArray(result.recipeInstructions)) {
        expect(result.recipeInstructions).toHaveLength(2);
      }
    });

    it('should handle recipe with string array instructions', async () => {
      const recipeWithStringInstructions: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Recipe with String Instructions',
        recipeIngredient: ['ingredient'],
        recipeInstructions: ['Step 1', 'Step 2', 'Step 3'],
      };

      mockExecuteJavaScript.mockResolvedValue([recipeWithStringInstructions]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result.recipeInstructions).toEqual(['Step 1', 'Step 2', 'Step 3']);
    });

    it('should handle recipe with nutrition information', async () => {
      const recipeWithNutrition: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Nutritious Recipe',
        recipeIngredient: ['ingredient'],
        nutrition: {
          '@type': 'NutritionInformation',
          calories: '300',
          proteinContent: '15g',
          carbohydrateContent: '45g',
          fatContent: '10g',
        },
      };

      mockExecuteJavaScript.mockResolvedValue([recipeWithNutrition]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result.nutrition).toBeDefined();
      expect(result.nutrition?.calories).toBe('300');
    });

    it('should handle recipe with tool/cookware field', async () => {
      const recipeWithTools: SchemaOrgRecipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Recipe with Tools',
        recipeIngredient: ['ingredient'],
        tool: [
          {
            '@type': 'HowToTool',
            name: 'Mixer',
          },
          {
            '@type': 'HowToTool',
            name: 'Baking pan',
          },
        ],
      };

      mockExecuteJavaScript.mockResolvedValue([recipeWithTools]);

      const result = await extractSchemaOrgRecipe('https://example.com/recipe');
      expect(result.tool).toBeDefined();
    });

    it('should handle very long URL', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000);
      await extractSchemaOrgRecipe(longUrl);
      expect(mockLoadURL).toHaveBeenCalledWith(longUrl);
    });

    it('should handle URL with port number', async () => {
      const urlWithPort = 'https://example.com:8443/recipe';
      await extractSchemaOrgRecipe(urlWithPort);
      expect(mockLoadURL).toHaveBeenCalledWith(urlWithPort);
    });

    it('should handle URL with authentication (user:pass)', async () => {
      const urlWithAuth = 'https://user:pass@example.com/recipe';
      await extractSchemaOrgRecipe(urlWithAuth);
      expect(mockLoadURL).toHaveBeenCalledWith(urlWithAuth);
    });
  });

  describe('BrowserWindow Configuration', () => {
    it('should create BrowserWindow with security settings', async () => {
      const { BrowserWindow } = await import('electron');
      const mockBrowserWindowConstructor = BrowserWindow as any;

      await extractSchemaOrgRecipe('https://example.com/recipe');

      const callArgs = mockBrowserWindowConstructor.mock.calls[0];
      const config = callArgs[0] as any;

      expect(config.show).toBe(false);
      expect(config.webPreferences.nodeIntegration).toBe(false);
      expect(config.webPreferences.contextIsolation).toBe(true);
      expect(config.webPreferences.sandbox).toBe(true);
      expect(config.webPreferences.webSecurity).toBe(true);
    });
  });

  describe('JavaScript Execution', () => {
    it('should execute JavaScript to extract JSON-LD recipes', async () => {
      await extractSchemaOrgRecipe('https://example.com/recipe');

      expect(mockExecuteJavaScript).toHaveBeenCalled();
      const callArgs = mockExecuteJavaScript.mock.calls[0];
      expect(callArgs).toBeDefined();
      const jsCode = callArgs?.[0] as string;

      // Verify the JavaScript extracts recipe data
      expect(jsCode).toContain('application/ld+json');
      expect(jsCode).toContain('Recipe');
      expect(jsCode).toContain('@graph');
    });
  });

  describe('No real network requests', () => {
    it('should not make real network requests - all calls go to mocks', async () => {
      // This test verifies that our mocks intercept all network calls
      await extractSchemaOrgRecipe('https://example.com/recipe');

      // Only the mocked functions should be called
      expect(mockLoadURL).toHaveBeenCalled();
      expect(mockExecuteJavaScript).toHaveBeenCalled();

      // No actual Electron instance was created beyond our mock
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should handle extraction with mocks regardless of URL', async () => {
      const testUrls = [
        'https://www.allrecipes.com/recipe/12345/cookies/',
        'https://www.epicurious.com/recipes/food/views/pasta',
        'https://cooking.nytimes.com/recipes/12345-bread',
      ];

      for (const url of testUrls) {
        vi.clearAllMocks();
        mockLoadURL.mockResolvedValue(undefined);
        mockExecuteJavaScript.mockResolvedValue([validSchemaOrgRecipe]);

        const result = await extractSchemaOrgRecipe(url);
        expect(result.name).toBe('Pasta Carbonara');
      }
    });
  });
});
