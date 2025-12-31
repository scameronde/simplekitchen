import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isTestEnvironment, isUnitTest, isE2ETest, getTestMockData } from './test-env.js';

describe('Environment Detection Utility', () => {
  beforeEach(() => {
    // Reset environment to a clean state before each test
    vi.stubEnv('NODE_ENV', '');
    vi.stubEnv('VITEST', '');
    vi.stubEnv('PLAYWRIGHT_TEST', '');
    vi.stubEnv('E2E_TEST', '');
  });

  afterEach(() => {
    // Restore original environment
    vi.unstubAllEnvs();
  });

  describe('isUnitTest()', () => {
    it('should return true when VITEST is set to "true"', () => {
      vi.stubEnv('VITEST', 'true');
      expect(isUnitTest()).toBe(true);
    });

    it('should return false when only NODE_ENV is set to "test" (requires VITEST)', () => {
      vi.stubEnv('NODE_ENV', 'test');
      expect(isUnitTest()).toBe(false);
    });

    it('should return false when neither VITEST nor NODE_ENV are set to test values', () => {
      expect(isUnitTest()).toBe(false);
    });
  });

  describe('isE2ETest()', () => {
    it('should return true when PLAYWRIGHT_TEST is set to "true"', () => {
      vi.stubEnv('PLAYWRIGHT_TEST', 'true');
      expect(isE2ETest()).toBe(true);
    });

    it('should return true when E2E_TEST is set to "true"', () => {
      vi.stubEnv('E2E_TEST', 'true');
      expect(isE2ETest()).toBe(true);
    });

    it('should return false when neither PLAYWRIGHT_TEST nor E2E_TEST are set', () => {
      expect(isE2ETest()).toBe(false);
    });
  });

  describe('isTestEnvironment()', () => {
    it('should return true when VITEST is set to "true"', () => {
      vi.stubEnv('VITEST', 'true');
      expect(isTestEnvironment()).toBe(true);
    });

    it('should return false when only NODE_ENV is set to "test" (no longer triggers test mode)', () => {
      vi.stubEnv('NODE_ENV', 'test');
      expect(isTestEnvironment()).toBe(false);
    });

    it('should return true when PLAYWRIGHT_TEST is set to "true"', () => {
      vi.stubEnv('PLAYWRIGHT_TEST', 'true');
      expect(isTestEnvironment()).toBe(true);
    });

    it('should return true when E2E_TEST is set to "true"', () => {
      vi.stubEnv('E2E_TEST', 'true');
      expect(isTestEnvironment()).toBe(true);
    });

    it('should return true when multiple test environment variables are set', () => {
      vi.stubEnv('NODE_ENV', 'test');
      vi.stubEnv('PLAYWRIGHT_TEST', 'true');
      expect(isTestEnvironment()).toBe(true);
    });

    it('should return false when no test environment variables are set', () => {
      // Environment already reset in beforeEach
      expect(isTestEnvironment()).toBe(false);
    });

    it('should return false when NODE_ENV is set to "production"', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(isTestEnvironment()).toBe(false);
    });

    it('should return false when NODE_ENV is set to "development"', () => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(isTestEnvironment()).toBe(false);
    });

    it('should return false when PLAYWRIGHT_TEST is set to "false"', () => {
      vi.stubEnv('PLAYWRIGHT_TEST', 'false');
      expect(isTestEnvironment()).toBe(false);
    });

    it('should return false when E2E_TEST is set to "false"', () => {
      vi.stubEnv('E2E_TEST', 'false');
      expect(isTestEnvironment()).toBe(false);
    });

    it('should be case-sensitive for environment variable values', () => {
      vi.stubEnv('PLAYWRIGHT_TEST', 'True');
      expect(isTestEnvironment()).toBe(false);
    });

    it('should handle undefined environment variables gracefully', () => {
      // This should return false as all env vars are unset
      expect(isTestEnvironment()).toBe(false);
    });
  });

  describe('getTestMockData()', () => {
    it('should return a valid mock data structure', () => {
      const mockData = getTestMockData();
      expect(mockData).toBeDefined();
      expect(typeof mockData).toBe('object');
    });

    it('should return mock recipes array with expected structure', () => {
      const mockData = getTestMockData();
      expect(Array.isArray(mockData.recipes)).toBe(true);
      expect(mockData.recipes.length).toBeGreaterThan(0);

      mockData.recipes.forEach(recipe => {
        expect(recipe).toHaveProperty('id');
        expect(recipe).toHaveProperty('title');
        expect(recipe).toHaveProperty('cookingTimeMinutes');
        expect(recipe).toHaveProperty('servings');
        expect(typeof recipe.id).toBe('string');
        expect(typeof recipe.title).toBe('string');
        expect(typeof recipe.cookingTimeMinutes).toBe('number');
        expect(typeof recipe.servings).toBe('number');
      });
    });

    it('should return mock dietary profiles array with expected structure', () => {
      const mockData = getTestMockData();
      expect(Array.isArray(mockData.dietaryProfiles)).toBe(true);
      expect(mockData.dietaryProfiles.length).toBeGreaterThan(0);

      mockData.dietaryProfiles.forEach(profile => {
        expect(profile).toHaveProperty('id');
        expect(profile).toHaveProperty('name');
        expect(profile).toHaveProperty('restrictions');
        expect(typeof profile.id).toBe('string');
        expect(typeof profile.name).toBe('string');
        expect(Array.isArray(profile.restrictions)).toBe(true);
      });
    });

    it('should return test flags with expected structure', () => {
      const mockData = getTestMockData();
      expect(mockData.testFlags).toBeDefined();
      expect(mockData.testFlags).toHaveProperty('isTestMode');
      expect(mockData.testFlags).toHaveProperty('timestamp');
      expect(mockData.testFlags.isTestMode).toBe(true);
      expect(typeof mockData.testFlags.timestamp).toBe('string');
    });

    it('should return consistent mock recipes data structure', () => {
      const mockData1 = getTestMockData();
      const mockData2 = getTestMockData();

      expect(mockData1.recipes.length).toBe(mockData2.recipes.length);
      mockData1.recipes.forEach((recipe, index) => {
        const recipe2 = mockData2.recipes[index];
        if (recipe2) {
          expect(recipe.id).toBe(recipe2.id);
          expect(recipe.title).toBe(recipe2.title);
          expect(recipe.cookingTimeMinutes).toBe(recipe2.cookingTimeMinutes);
          expect(recipe.servings).toBe(recipe2.servings);
        }
      });
    });

    it('should return consistent mock dietary profiles data structure', () => {
      const mockData1 = getTestMockData();
      const mockData2 = getTestMockData();

      expect(mockData1.dietaryProfiles.length).toBe(mockData2.dietaryProfiles.length);
      mockData1.dietaryProfiles.forEach((profile, index) => {
        const profile2 = mockData2.dietaryProfiles[index];
        if (profile2) {
          expect(profile.id).toBe(profile2.id);
          expect(profile.name).toBe(profile2.name);
          expect(profile.restrictions).toEqual(profile2.restrictions);
        }
      });
    });

    it('should have valid recipe IDs', () => {
      const mockData = getTestMockData();
      mockData.recipes.forEach(recipe => {
        expect(recipe.id).toMatch(/^test-recipe-\d+$/);
      });
    });

    it('should have valid dietary profile IDs', () => {
      const mockData = getTestMockData();
      mockData.dietaryProfiles.forEach(profile => {
        expect(profile.id).toMatch(/^test-profile-\d+$/);
      });
    });

    it('should have valid cooking time values', () => {
      const mockData = getTestMockData();
      mockData.recipes.forEach(recipe => {
        expect(recipe.cookingTimeMinutes).toBeGreaterThan(0);
      });
    });

    it('should have valid servings values', () => {
      const mockData = getTestMockData();
      mockData.recipes.forEach(recipe => {
        expect(recipe.servings).toBeGreaterThan(0);
      });
    });

    it('should return timestamp in ISO format', () => {
      const mockData = getTestMockData();
      const timestamp = mockData.testFlags.timestamp;
      // Valid ISO 8601 string should be parseable
      expect(() => new Date(timestamp)).not.toThrow();
      // Should be a recent timestamp (within last minute)
      const now = new Date();
      const mockTime = new Date(timestamp);
      const timeDifference = now.getTime() - mockTime.getTime();
      expect(timeDifference).toBeLessThan(60000); // Within 60 seconds
    });
  });

  describe('Integration Tests', () => {
    it('should return correct data regardless of environment', () => {
      vi.stubEnv('NODE_ENV', 'test');
      const mockData = getTestMockData();
      expect(mockData).toBeDefined();
      expect(mockData.recipes.length).toBeGreaterThan(0);
    });

    it('should be callable independently without side effects', () => {
      const data1 = getTestMockData();
      const isTest1 = isTestEnvironment();

      const data2 = getTestMockData();
      const isTest2 = isTestEnvironment();

      // Functions should not affect each other
      expect(data1).toEqual(data2);
      expect(isTest1).toBe(isTest2);
    });
  });
});
