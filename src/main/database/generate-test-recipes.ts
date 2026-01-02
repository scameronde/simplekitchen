/**
 * @module generate-test-recipes
 * Synthetic recipe dataset generator for performance testing.
 * Generates 1000-2000 realistic recipe records with proper validation constraints.
 */

import type {
  CreateRecipeInput,
  CreateIngredientInput,
  DietaryTag,
  CookwareType,
  Season,
} from '../../shared/types/recipe';
import type { DietaryProperty } from '../../shared/types/database';

/**
 * Options for generating test recipes.
 */
export interface GeneratorOptions {
  /** Number of recipes to generate (1000-2000 recommended) */
  count: number;
  /** Optional seed for reproducible randomness */
  seed?: number;
}

/**
 * Ingredient data with dietary properties for realistic generation.
 */
interface IngredientData {
  name: string;
  quantity: number;
  unit: string;
  dietaryProperties: DietaryProperty[];
}

// ============================================================================
// Ingredient Database
// ============================================================================

/**
 * Comprehensive ingredient bank with dietary properties.
 * Used to generate realistic ingredient lists that match dietary constraints.
 */
const INGREDIENT_BANK: IngredientData[] = [
  // Proteins - Vegan/Vegetarian
  { name: 'firm tofu', quantity: 14, unit: 'oz', dietaryProperties: ['none'] },
  { name: 'tempeh', quantity: 8, unit: 'oz', dietaryProperties: ['none'] },
  { name: 'chickpeas', quantity: 15, unit: 'oz', dietaryProperties: ['none'] },
  { name: 'black beans', quantity: 15, unit: 'oz', dietaryProperties: ['none'] },
  { name: 'lentils', quantity: 1, unit: 'cup', dietaryProperties: ['none'] },

  // Proteins - Pescatarian
  { name: 'salmon fillet', quantity: 12, unit: 'oz', dietaryProperties: ['contains-fish'] },
  { name: 'cod fillet', quantity: 12, unit: 'oz', dietaryProperties: ['contains-fish'] },
  { name: 'shrimp', quantity: 12, unit: 'oz', dietaryProperties: ['contains-fish'] },
  { name: 'tuna', quantity: 8, unit: 'oz', dietaryProperties: ['contains-fish'] },

  // Proteins - Non-vegetarian
  { name: 'chicken breast', quantity: 12, unit: 'oz', dietaryProperties: ['contains-meat'] },
  { name: 'chicken thighs', quantity: 1, unit: 'lb', dietaryProperties: ['contains-meat'] },
  { name: 'ground beef', quantity: 1, unit: 'lb', dietaryProperties: ['contains-meat'] },
  { name: 'pork chops', quantity: 12, unit: 'oz', dietaryProperties: ['contains-meat'] },
  { name: 'turkey breast', quantity: 12, unit: 'oz', dietaryProperties: ['contains-meat'] },

  // Dairy products
  { name: 'milk', quantity: 1, unit: 'cup', dietaryProperties: ['contains-lactose'] },
  { name: 'butter', quantity: 2, unit: 'tbsp', dietaryProperties: ['contains-lactose'] },
  { name: 'cheese', quantity: 1, unit: 'cup', dietaryProperties: ['contains-lactose'] },
  { name: 'yogurt', quantity: 1, unit: 'cup', dietaryProperties: ['contains-lactose'] },
  { name: 'cream', quantity: 0.5, unit: 'cup', dietaryProperties: ['contains-lactose'] },
  { name: 'parmesan cheese', quantity: 0.5, unit: 'cup', dietaryProperties: ['contains-lactose'] },

  // Eggs
  { name: 'eggs', quantity: 2, unit: 'whole', dietaryProperties: ['contains-eggs'] },

  // Grains - Gluten-containing
  { name: 'pasta', quantity: 8, unit: 'oz', dietaryProperties: ['contains-gluten'] },
  { name: 'flour', quantity: 1, unit: 'cup', dietaryProperties: ['contains-gluten'] },
  { name: 'bread', quantity: 4, unit: 'slices', dietaryProperties: ['contains-gluten'] },
  { name: 'couscous', quantity: 1, unit: 'cup', dietaryProperties: ['contains-gluten'] },

  // Grains - Gluten-free
  { name: 'rice', quantity: 1, unit: 'cup', dietaryProperties: ['none'] },
  { name: 'quinoa', quantity: 1, unit: 'cup', dietaryProperties: ['none'] },
  { name: 'gluten-free pasta', quantity: 8, unit: 'oz', dietaryProperties: ['none'] },
  { name: 'rice noodles', quantity: 8, unit: 'oz', dietaryProperties: ['none'] },
  { name: 'cornmeal', quantity: 1, unit: 'cup', dietaryProperties: ['none'] },

  // Vegetables
  { name: 'broccoli', quantity: 2, unit: 'cups', dietaryProperties: ['none'] },
  { name: 'bell peppers', quantity: 2, unit: 'whole', dietaryProperties: ['none'] },
  { name: 'zucchini', quantity: 2, unit: 'medium', dietaryProperties: ['none'] },
  { name: 'mushrooms', quantity: 8, unit: 'oz', dietaryProperties: ['none'] },
  { name: 'spinach', quantity: 4, unit: 'cups', dietaryProperties: ['none'] },
  { name: 'tomatoes', quantity: 2, unit: 'medium', dietaryProperties: ['none'] },
  { name: 'onion', quantity: 1, unit: 'medium', dietaryProperties: ['none'] },
  { name: 'garlic', quantity: 3, unit: 'cloves', dietaryProperties: ['none'] },
  { name: 'carrots', quantity: 2, unit: 'medium', dietaryProperties: ['none'] },
  { name: 'asparagus', quantity: 1, unit: 'bunch', dietaryProperties: ['none'] },
  { name: 'kale', quantity: 2, unit: 'cups', dietaryProperties: ['none'] },
  { name: 'sweet potato', quantity: 2, unit: 'medium', dietaryProperties: ['none'] },
  { name: 'eggplant', quantity: 1, unit: 'medium', dietaryProperties: ['none'] },
  { name: 'cauliflower', quantity: 1, unit: 'head', dietaryProperties: ['none'] },
  { name: 'green beans', quantity: 2, unit: 'cups', dietaryProperties: ['none'] },

  // Oils and fats
  { name: 'olive oil', quantity: 2, unit: 'tbsp', dietaryProperties: ['none'] },
  { name: 'vegetable oil', quantity: 2, unit: 'tbsp', dietaryProperties: ['none'] },
  { name: 'sesame oil', quantity: 1, unit: 'tbsp', dietaryProperties: ['none'] },
  { name: 'coconut oil', quantity: 2, unit: 'tbsp', dietaryProperties: ['none'] },

  // Condiments and seasonings
  { name: 'soy sauce', quantity: 2, unit: 'tbsp', dietaryProperties: ['contains-gluten'] },
  { name: 'tamari', quantity: 2, unit: 'tbsp', dietaryProperties: ['none'] },
  { name: 'salt', quantity: 1, unit: 'tsp', dietaryProperties: ['none'] },
  { name: 'black pepper', quantity: 0.5, unit: 'tsp', dietaryProperties: ['none'] },
  { name: 'cumin', quantity: 1, unit: 'tsp', dietaryProperties: ['none'] },
  { name: 'paprika', quantity: 1, unit: 'tsp', dietaryProperties: ['none'] },
  { name: 'oregano', quantity: 1, unit: 'tsp', dietaryProperties: ['none'] },
  { name: 'basil', quantity: 1, unit: 'tsp', dietaryProperties: ['none'] },
  { name: 'thyme', quantity: 1, unit: 'tsp', dietaryProperties: ['none'] },
  { name: 'ginger', quantity: 1, unit: 'tbsp', dietaryProperties: ['none'] },
  { name: 'chili powder', quantity: 1, unit: 'tsp', dietaryProperties: ['none'] },
  { name: 'curry powder', quantity: 1, unit: 'tbsp', dietaryProperties: ['none'] },

  // Liquids
  { name: 'vegetable broth', quantity: 2, unit: 'cups', dietaryProperties: ['none'] },
  { name: 'chicken broth', quantity: 2, unit: 'cups', dietaryProperties: ['contains-meat'] },
  { name: 'coconut milk', quantity: 1, unit: 'can', dietaryProperties: ['none'] },
  { name: 'tomato sauce', quantity: 1, unit: 'cup', dietaryProperties: ['none'] },
  { name: 'lemon juice', quantity: 2, unit: 'tbsp', dietaryProperties: ['none'] },
  { name: 'lime juice', quantity: 2, unit: 'tbsp', dietaryProperties: ['none'] },

  // Nuts and seeds
  { name: 'almonds', quantity: 0.25, unit: 'cup', dietaryProperties: ['none'] },
  { name: 'cashews', quantity: 0.25, unit: 'cup', dietaryProperties: ['none'] },
  { name: 'peanuts', quantity: 0.25, unit: 'cup', dietaryProperties: ['none'] },
  { name: 'sesame seeds', quantity: 2, unit: 'tbsp', dietaryProperties: ['none'] },
  { name: 'sunflower seeds', quantity: 2, unit: 'tbsp', dietaryProperties: ['none'] },
];

// ============================================================================
// Word Banks for Title Generation
// ============================================================================

const PROTEINS = [
  'Chicken',
  'Tofu',
  'Salmon',
  'Beef',
  'Tempeh',
  'Shrimp',
  'Lentils',
  'Chickpeas',
  'Turkey',
  'Cod',
];

const VEGETABLES = [
  'Broccoli',
  'Asparagus',
  'Bell Peppers',
  'Zucchini',
  'Mushrooms',
  'Spinach',
  'Kale',
  'Carrots',
  'Green Beans',
  'Cauliflower',
];

const CUISINES = [
  'Italian',
  'Thai',
  'Mexican',
  'Indian',
  'Japanese',
  'Mediterranean',
  'Chinese',
  'Korean',
  'Vietnamese',
  'Middle Eastern',
];

const DISHES = [
  'Stir-Fry',
  'Curry',
  'Pasta',
  'Soup',
  'Bowl',
  'Casserole',
  'Skillet',
  'Bake',
  'Risotto',
  'Pilaf',
];

const TITLE_TEMPLATES = [
  (protein: string, vegetable: string) => `One-Pan ${protein} with ${vegetable}`,
  (protein: string, vegetable: string) => `Quick ${protein} and ${vegetable} Stir-Fry`,
  (cuisine: string, dish: string) => `${cuisine} ${dish}`,
  (protein: string, dish: string) => `${protein} ${dish}`,
  (vegetable: string, dish: string) => `${vegetable} ${dish}`,
  (protein: string, vegetable: string) => `Roasted ${protein} and ${vegetable}`,
  (cuisine: string, protein: string) => `${cuisine}-Style ${protein}`,
  (protein: string, vegetable: string) => `${protein} ${vegetable} Medley`,
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Seeded random number generator for reproducible results.
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Generate a random number between 0 and 1 using seed.
   */
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Get a random integer between min (inclusive) and max (exclusive).
   */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Choose a random element from an array.
   */
  choice<T>(array: T[]): T {
    return array[this.int(0, array.length)]!;
  }
}

/**
 * Random number generator (uses Math.random or seeded generator).
 */
let rng: SeededRandom | null = null;

function randomInt(min: number, max: number): number {
  if (rng) {
    return rng.int(min, max);
  }
  return Math.floor(Math.random() * (max - min)) + min;
}

function randomChoice<T>(array: T[]): T {
  if (rng) {
    return rng.choice(array);
  }
  return array[randomInt(0, array.length)]!;
}

// ============================================================================
// Generator Functions
// ============================================================================

/**
 * Generate a realistic recipe title using templates and word banks.
 */
function generateRecipeTitle(index: number): string {
  const template = TITLE_TEMPLATES[index % TITLE_TEMPLATES.length]!;
  const protein = randomChoice(PROTEINS);
  const vegetable = randomChoice(VEGETABLES);
  const cuisine = randomChoice(CUISINES);
  const dish = randomChoice(DISHES);

  // Templates expect different parameters
  if (template.length === 2) {
    // Two parameter templates (protein, vegetable) or (cuisine, dish) etc.
    const firstParam = index % 2 === 0 ? protein : cuisine;
    const secondParam = index % 2 === 0 ? vegetable : dish;
    return template(firstParam, secondParam);
  }

  return template(protein, vegetable);
}

/**
 * Generate dietary tags with logical consistency.
 * Ensures vegan implies vegetarian and lactose-free.
 */
function generateDietaryTags(): DietaryTag[] {
  const tags: DietaryTag[] = [];
  const tagPool: DietaryTag[] = ['gluten-free', 'lactose-free', 'vegetarian', 'vegan'];

  // Randomly decide how many tags (0-3)
  const tagCount = randomInt(0, 4);

  if (tagCount === 0) {
    return tags;
  }

  // Special case: vegan
  if (randomInt(0, 10) < 2) {
    // 20% chance of vegan
    tags.push('vegan');
    tags.push('vegetarian'); // Vegan implies vegetarian
    tags.push('lactose-free'); // Vegan implies lactose-free
    if (randomInt(0, 2) === 0) {
      tags.push('gluten-free'); // 50% chance of also gluten-free
    }
    return tags;
  }

  // Special case: pescatarian
  if (randomInt(0, 10) < 2) {
    // 20% chance of pescatarian
    tags.push('pescatarian');
    if (randomInt(0, 2) === 0) {
      tags.push('gluten-free');
    }
    if (randomInt(0, 2) === 0) {
      tags.push('lactose-free');
    }
    return tags;
  }

  // Random combination of tags
  const shuffled = [...tagPool].sort(() => (rng ? rng.next() - 0.5 : Math.random() - 0.5));
  for (let i = 0; i < tagCount && i < shuffled.length; i++) {
    const tag = shuffled[i]!;
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }

  // Ensure vegan implies vegetarian
  if (tags.includes('vegan') && !tags.includes('vegetarian')) {
    tags.push('vegetarian');
  }

  return tags;
}

/**
 * Filter ingredients based on dietary tags.
 */
function filterIngredientsByDietaryTags(
  ingredients: IngredientData[],
  dietaryTags: DietaryTag[]
): IngredientData[] {
  return ingredients.filter(ingredient => {
    // Check each dietary property
    for (const prop of ingredient.dietaryProperties) {
      if (prop === 'none') continue;

      // Gluten-free check
      if (dietaryTags.includes('gluten-free') && prop === 'contains-gluten') {
        return false;
      }

      // Lactose-free check
      if (dietaryTags.includes('lactose-free') && prop === 'contains-lactose') {
        return false;
      }

      // Vegan check (strictest)
      if (dietaryTags.includes('vegan')) {
        if (
          prop === 'contains-meat' ||
          prop === 'contains-fish' ||
          prop === 'contains-eggs' ||
          prop === 'contains-lactose'
        ) {
          return false;
        }
      }

      // Vegetarian check
      if (dietaryTags.includes('vegetarian')) {
        if (prop === 'contains-meat' || prop === 'contains-fish') {
          return false;
        }
      }

      // Pescatarian check
      if (dietaryTags.includes('pescatarian') && prop === 'contains-meat') {
        return false;
      }
    }

    return true;
  });
}

/**
 * Generate a list of ingredients for a recipe.
 */
function generateIngredients(count: number, dietaryTags: DietaryTag[]): CreateIngredientInput[] {
  const filtered = filterIngredientsByDietaryTags(INGREDIENT_BANK, dietaryTags);

  if (filtered.length === 0) {
    // Fallback to basic vegan ingredients if filtering is too strict
    return [
      {
        name: 'olive oil',
        quantity: 2,
        unit: 'tbsp',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 1,
      },
      {
        name: 'salt',
        quantity: 1,
        unit: 'tsp',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 2,
      },
    ];
  }

  const ingredients: CreateIngredientInput[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let randomIndex: number;

    // Avoid duplicate ingredients
    do {
      randomIndex = randomInt(0, filtered.length);
      attempts++;
    } while (usedIndices.has(randomIndex) && attempts < 20);

    if (attempts >= 20) {
      // If we can't find unique ingredients, allow duplicates
      randomIndex = randomInt(0, filtered.length);
    }

    usedIndices.add(randomIndex);

    const ingredient = filtered[randomIndex]!;
    ingredients.push({
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      dietaryProperties: ingredient.dietaryProperties,
      optional: randomInt(0, 10) < 1, // 10% chance of optional
      orderIndex: i + 1,
    });
  }

  return ingredients;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Generate a synthetic dataset of test recipes.
 *
 * @param options - Generation options (count, seed)
 * @returns Array of recipe creation inputs
 *
 * @example
 * ```typescript
 * const recipes = generateTestRecipes({ count: 1000, seed: 12345 });
 * for (const recipe of recipes) {
 *   await createRecipe(recipe);
 * }
 * ```
 */
export function generateTestRecipes(options: GeneratorOptions): CreateRecipeInput[] {
  const { count, seed } = options;

  // Initialize seeded RNG if seed provided
  if (seed !== undefined) {
    rng = new SeededRandom(seed);
  } else {
    rng = null;
  }

  const recipes: CreateRecipeInput[] = [];
  const cookingTimes = [30, 35, 40, 45];
  const cookwareTypes: CookwareType[] = ['one-pot', 'one-pan', 'oven'];
  const seasons: Season[] = ['spring', 'summer', 'fall', 'winter', 'any'];

  for (let i = 0; i < count; i++) {
    const dietaryTags = generateDietaryTags();
    const ingredientCount = randomInt(4, 9); // 4-8 ingredients

    recipes.push({
      title: generateRecipeTitle(i),
      cookingTimeMinutes: randomChoice(cookingTimes),
      prepTimeMinutes: randomInt(0, 2) === 0 ? randomInt(5, 15) : undefined, // 50% have prep time
      cookwareType: randomChoice(cookwareTypes),
      servings: 2, // Per constraint
      dietaryTags,
      seasonality: [randomChoice(seasons)],
      sourceType: 'manual',
      sourceReference: undefined,
      instructions: undefined,
      ingredients: generateIngredients(ingredientCount, dietaryTags),
    });
  }

  return recipes;
}
