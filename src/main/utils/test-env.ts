/**
 * Environment detection utility for test-specific code paths.
 * Provides functions to detect if the application is running in a test environment
 * and retrieve predefined mock data for testing purposes.
 */

/**
 * Checks if the application is running in a unit test environment (Vitest).
 * Returns true if any of the following conditions are met:
 * - VITEST is set to 'true'
 * - NODE_ENV is set to 'test' (fallback for older configurations)
 *
 * @returns {boolean} True if running in unit test environment, false otherwise
 */
export function isUnitTest(): boolean {
  return process.env.VITEST === 'true';
}

/**
 * Checks if the application is running in an E2E test environment (Playwright).
 * Returns true if any of the following conditions are met:
 * - PLAYWRIGHT_TEST is set to 'true'
 * - E2E_TEST is set to 'true'
 *
 * @returns {boolean} True if running in E2E test environment, false otherwise
 */
export function isE2ETest(): boolean {
  return process.env.PLAYWRIGHT_TEST === 'true' || process.env.E2E_TEST === 'true';
}

/**
 * Checks if the application is running in any test environment.
 * Returns true if either unit tests or E2E tests are running.
 *
 * @returns {boolean} True if running in any test environment, false otherwise
 */
export function isTestEnvironment(): boolean {
  return isUnitTest() || isE2ETest();
}

/**
 * Mock data structure for testing purposes.
 */
interface TestMockData {
  recipes: Array<{
    id: string;
    title: string;
    cookingTimeMinutes: number;
    servings: number;
  }>;
  dietaryProfiles: Array<{
    id: string;
    name: string;
    restrictions: string[];
  }>;
  testFlags: {
    isTestMode: boolean;
    timestamp: string;
  };
}

/**
 * Returns predefined mock data for use in tests.
 * This data structure is consistent and predictable for testing scenarios.
 *
 * @returns {TestMockData} Mock data object containing recipes, dietary profiles, and test flags
 */
export function getTestMockData(): TestMockData {
  return {
    recipes: [
      {
        id: 'test-recipe-1',
        title: 'Test Pasta Carbonara',
        cookingTimeMinutes: 20,
        servings: 2,
      },
      {
        id: 'test-recipe-2',
        title: 'Test Vegetable Stir Fry',
        cookingTimeMinutes: 15,
        servings: 3,
      },
      {
        id: 'test-recipe-3',
        title: 'Test Grilled Chicken',
        cookingTimeMinutes: 30,
        servings: 4,
      },
    ],
    dietaryProfiles: [
      {
        id: 'test-profile-1',
        name: 'No Restrictions',
        restrictions: [],
      },
      {
        id: 'test-profile-2',
        name: 'Vegetarian',
        restrictions: ['meat', 'fish'],
      },
      {
        id: 'test-profile-3',
        name: 'Vegan',
        restrictions: ['meat', 'fish', 'dairy', 'eggs'],
      },
    ],
    testFlags: {
      isTestMode: true,
      timestamp: new Date().toISOString(),
    },
  };
}
