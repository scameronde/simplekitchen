import { createRecipe } from './dal/recipes.js';
import type { CreateRecipeInput } from '../../shared/types/recipe.js';

const SAMPLE_RECIPES: CreateRecipeInput[] = [
  {
    title: 'Quick Chicken Stir-Fry',
    cookingTimeMinutes: 30,
    prepTimeMinutes: 15,
    cookwareType: 'one-pan',
    servings: 2,
    dietaryTags: ['gluten-free', 'lactose-free'],
    seasonality: ['any'],
    sourceType: 'manual',
    ingredients: [
      {
        name: 'chicken breast',
        quantity: 1,
        unit: 'lb',
        dietaryProperties: [],
        optional: false,
        orderIndex: 1,
      },
      {
        name: 'bell peppers',
        quantity: 2,
        unit: 'whole',
        dietaryProperties: [],
        optional: false,
        orderIndex: 2,
      },
      {
        name: 'soy sauce',
        quantity: 2,
        unit: 'tbsp',
        dietaryProperties: [],
        optional: false,
        orderIndex: 3,
      },
      {
        name: 'olive oil',
        quantity: 1,
        unit: 'tbsp',
        dietaryProperties: [],
        optional: false,
        orderIndex: 4,
      },
    ],
    instructions:
      'Heat oil in pan. Cook chicken until done. Add vegetables and sauce. Stir-fry for 5 minutes.',
  },
  {
    title: 'One-Pot Pasta Primavera',
    cookingTimeMinutes: 35,
    prepTimeMinutes: 10,
    cookwareType: 'one-pot',
    servings: 2,
    dietaryTags: ['vegetarian', 'lactose-free'],
    seasonality: ['spring', 'summer'],
    sourceType: 'manual',
    ingredients: [
      {
        name: 'gluten-free pasta',
        quantity: 8,
        unit: 'oz',
        dietaryProperties: [],
        optional: false,
        orderIndex: 1,
      },
      {
        name: 'zucchini',
        quantity: 1,
        unit: 'whole',
        dietaryProperties: [],
        optional: false,
        orderIndex: 2,
      },
      {
        name: 'cherry tomatoes',
        quantity: 1,
        unit: 'cup',
        dietaryProperties: [],
        optional: false,
        orderIndex: 3,
      },
      {
        name: 'olive oil',
        quantity: 2,
        unit: 'tbsp',
        dietaryProperties: [],
        optional: false,
        orderIndex: 4,
      },
      {
        name: 'garlic',
        quantity: 3,
        unit: 'cloves',
        dietaryProperties: [],
        optional: false,
        orderIndex: 5,
      },
    ],
    instructions:
      'Boil pasta with vegetables in one pot. Drain and toss with olive oil and garlic.',
  },
  {
    title: 'Baked Salmon with Vegetables',
    cookingTimeMinutes: 40,
    prepTimeMinutes: 10,
    cookwareType: 'oven',
    servings: 2,
    dietaryTags: ['gluten-free', 'lactose-free', 'pescatarian'],
    seasonality: ['any'],
    sourceType: 'manual',
    ingredients: [
      {
        name: 'salmon fillet',
        quantity: 12,
        unit: 'oz',
        dietaryProperties: [],
        optional: false,
        orderIndex: 1,
      },
      {
        name: 'asparagus',
        quantity: 1,
        unit: 'bunch',
        dietaryProperties: [],
        optional: false,
        orderIndex: 2,
      },
      {
        name: 'lemon',
        quantity: 1,
        unit: 'whole',
        dietaryProperties: [],
        optional: false,
        orderIndex: 3,
      },
      {
        name: 'olive oil',
        quantity: 2,
        unit: 'tbsp',
        dietaryProperties: [],
        optional: false,
        orderIndex: 4,
      },
    ],
    instructions:
      'Place salmon and vegetables on baking sheet. Drizzle with oil and lemon. Bake at 400°F for 20 minutes.',
  },
];

export async function seedDatabase(count: number = 10): Promise<void> {
  console.log(`Seeding database with ${count} recipes...`);

  for (let i = 0; i < count; i++) {
    const recipe = SAMPLE_RECIPES[i % SAMPLE_RECIPES.length]!;
    const uniqueRecipe: CreateRecipeInput = {
      title: `${recipe.title} (${i + 1})`,
      cookingTimeMinutes: recipe.cookingTimeMinutes,
      prepTimeMinutes: recipe.prepTimeMinutes,
      cookwareType: recipe.cookwareType,
      servings: recipe.servings,
      dietaryTags: recipe.dietaryTags,
      seasonality: recipe.seasonality,
      sourceType: recipe.sourceType,
      sourceReference: recipe.sourceReference,
      instructions: recipe.instructions,
      ingredients: recipe.ingredients,
    };

    try {
      await createRecipe(uniqueRecipe);
    } catch (error) {
      console.error(`Failed to seed recipe ${i + 1}:`, error);
    }
  }

  console.log(`Successfully seeded ${count} recipes.`);
}

// Execute when run directly with tsx
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase(50).catch(console.error);
}
