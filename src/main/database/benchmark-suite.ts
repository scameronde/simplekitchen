import { closeDatabase, db } from './init.js';
import { runMigrations } from './migrations.js';
import { createRecipe, getRecipes, getRecipeById } from './dal/recipes.js';
import type {
  CreateRecipeInput,
  RecipeFilter,
  DietaryTag,
  Season,
} from '../../shared/types/recipe.js';

export interface BenchmarkResult {
  name: string;
  duration: number;
  count: number;
  avgTime: number;
  passed: boolean;
  threshold: number;
  unit: string;
}

/**
 * Generate a sample recipe for benchmarking.
 * Cycles through different configurations to create variety.
 */
function generateSampleRecipe(index: number): CreateRecipeInput {
  const cookwareTypes = ['one-pot', 'one-pan', 'oven'] as const;
  const dietaryTagsSets: DietaryTag[][] = [
    ['gluten-free'],
    ['lactose-free'],
    ['vegetarian'],
    ['gluten-free', 'lactose-free'],
    ['vegan'],
    [],
  ];
  const seasonalitySets: Season[][] = [
    ['any'],
    ['spring', 'summer'],
    ['fall', 'winter'],
    ['summer'],
  ];

  const cookingTime = 30 + (index % 16); // Range: 30-45 minutes
  const cookwareType = cookwareTypes[index % cookwareTypes.length]!;
  const dietaryTags = dietaryTagsSets[index % dietaryTagsSets.length]!;
  const seasonality = seasonalitySets[index % seasonalitySets.length]!;

  return {
    title: `Benchmark Recipe ${index + 1}`,
    cookingTimeMinutes: cookingTime,
    prepTimeMinutes: 10 + (index % 10),
    cookwareType,
    servings: 2,
    dietaryTags,
    seasonality,
    sourceType: 'manual',
    instructions: `Step 1: Prepare ingredients. Step 2: Cook for ${cookingTime} minutes. Step 3: Serve.`,
    ingredients: [
      {
        name: `ingredient-${index}-1`,
        quantity: 1,
        unit: 'cup',
        dietaryProperties: [],
        optional: false,
        orderIndex: 1,
      },
      {
        name: `ingredient-${index}-2`,
        quantity: 2,
        unit: 'tbsp',
        dietaryProperties: [],
        optional: false,
        orderIndex: 2,
      },
      {
        name: `ingredient-${index}-3`,
        quantity: 0.5,
        unit: 'lb',
        dietaryProperties: [],
        optional: true,
        orderIndex: 3,
      },
    ],
  };
}

/**
 * Benchmark 1: Recipe Insertion Performance
 * Target: <100ms per recipe
 */
async function benchmarkRecipeInsertion(): Promise<BenchmarkResult> {
  console.log('  Running: Recipe Insertion (1000 recipes)...');
  const start = performance.now();

  for (let i = 0; i < 1000; i++) {
    await createRecipe(generateSampleRecipe(i));
  }

  const duration = performance.now() - start;
  const avgTime = duration / 1000;
  const threshold = 100;

  return {
    name: 'Recipe Insertion (1000 recipes)',
    duration,
    count: 1000,
    avgTime,
    passed: avgTime < threshold,
    threshold,
    unit: 'ms/recipe',
  };
}

/**
 * Benchmark 2: Query All Recipes Performance
 * Target: <1000ms
 */
async function benchmarkQueryAllRecipes(): Promise<BenchmarkResult> {
  console.log('  Running: Query All Recipes...');
  const start = performance.now();

  const recipes = await getRecipes();

  const duration = performance.now() - start;
  const threshold = 1000;

  return {
    name: 'Query All Recipes',
    duration,
    count: recipes.length,
    avgTime: duration,
    passed: duration < threshold,
    threshold,
    unit: 'ms',
  };
}

/**
 * Benchmark 3: Query with Time Filter
 * Target: <1000ms
 */
async function benchmarkQueryTimeFilter(): Promise<BenchmarkResult> {
  console.log('  Running: Query with Time Filter (30-45 min)...');
  const filter: RecipeFilter = {
    cookingTimeMin: 30,
    cookingTimeMax: 45,
  };

  const start = performance.now();
  const recipes = await getRecipes(filter);
  const duration = performance.now() - start;
  const threshold = 1000;

  return {
    name: 'Query with Time Filter (30-45 min)',
    duration,
    count: recipes.length,
    avgTime: duration,
    passed: duration < threshold,
    threshold,
    unit: 'ms',
  };
}

/**
 * Benchmark 4: Query with Cookware Filter
 * Target: <1000ms
 */
async function benchmarkQueryCookwareFilter(): Promise<BenchmarkResult> {
  console.log('  Running: Query with Cookware Filter (one-pan)...');
  const filter: RecipeFilter = {
    cookwareTypes: ['one-pan'],
  };

  const start = performance.now();
  const recipes = await getRecipes(filter);
  const duration = performance.now() - start;
  const threshold = 1000;

  return {
    name: 'Query with Cookware Filter (one-pan)',
    duration,
    count: recipes.length,
    avgTime: duration,
    passed: duration < threshold,
    threshold,
    unit: 'ms',
  };
}

/**
 * Benchmark 5: Query with Dietary Tag Filter
 * Target: <1000ms
 */
async function benchmarkQueryDietaryFilter(): Promise<BenchmarkResult> {
  console.log('  Running: Query with Dietary Tag Filter (gluten-free)...');
  const filter: RecipeFilter = {
    dietaryTags: ['gluten-free'],
  };

  const start = performance.now();
  const recipes = await getRecipes(filter);
  const duration = performance.now() - start;
  const threshold = 1000;

  return {
    name: 'Query with Dietary Tag Filter (gluten-free)',
    duration,
    count: recipes.length,
    avgTime: duration,
    passed: duration < threshold,
    threshold,
    unit: 'ms',
  };
}

/**
 * Benchmark 6: Query Ingredients for Recipe
 * Target: <500ms
 */
async function benchmarkQueryIngredients(): Promise<BenchmarkResult> {
  console.log('  Running: Query Ingredients for Recipe...');

  // Get a random recipe ID
  const recipes = await getRecipes();
  const recipeId = recipes[Math.floor(Math.random() * recipes.length)]?.id;

  if (!recipeId) {
    throw new Error('No recipes found for ingredient query benchmark');
  }

  const start = performance.now();
  const recipe = await getRecipeById(recipeId);
  const duration = performance.now() - start;
  const threshold = 500;

  return {
    name: 'Query Ingredients for Recipe',
    duration,
    count: recipe?.ingredients.length ?? 0,
    avgTime: duration,
    passed: duration < threshold,
    threshold,
    unit: 'ms',
  };
}

/**
 * Benchmark 7: Query Recipes by Ingredient Name
 * Target: <500ms
 */
async function benchmarkQueryByIngredient(): Promise<BenchmarkResult> {
  console.log('  Running: Query Recipes by Ingredient Name...');
  const ingredientName = 'ingredient-0-1'; // Common ingredient from generated recipes

  const start = performance.now();

  // Query recipes that have this ingredient
  const recipesWithIngredient = await db
    .selectFrom('recipes')
    .innerJoin('ingredients', 'recipes.id', 'ingredients.recipe_id')
    .select('recipes.id')
    .where('ingredients.name', '=', ingredientName)
    .execute();

  const duration = performance.now() - start;
  const threshold = 500;

  return {
    name: 'Query Recipes by Ingredient Name',
    duration,
    count: recipesWithIngredient.length,
    avgTime: duration,
    passed: duration < threshold,
    threshold,
    unit: 'ms',
  };
}

/**
 * Benchmark 8: Full-Text Search by Title
 * Target: <1000ms
 */
async function benchmarkFullTextSearch(): Promise<BenchmarkResult> {
  console.log('  Running: Full-Text Search by Title...');
  const searchTerm = 'Recipe 1'; // Should match "Recipe 1", "Recipe 10", "Recipe 100", etc.

  const start = performance.now();

  // Search recipes by title substring
  const matchingRecipes = await db
    .selectFrom('recipes')
    .selectAll()
    .where('title', 'like', `%${searchTerm}%`)
    .execute();

  const duration = performance.now() - start;
  const threshold = 1000;

  return {
    name: 'Full-Text Search by Title Substring',
    duration,
    count: matchingRecipes.length,
    avgTime: duration,
    passed: duration < threshold,
    threshold,
    unit: 'ms',
  };
}

/**
 * Benchmark 9: Complex Multi-Filter Query
 * Target: <1000ms
 */
async function benchmarkComplexQuery(): Promise<BenchmarkResult> {
  console.log('  Running: Complex Multi-Filter Query...');
  const filter: RecipeFilter = {
    cookingTimeMin: 30,
    cookingTimeMax: 40,
    cookwareTypes: ['one-pan', 'one-pot'],
    dietaryTags: ['gluten-free'],
  };

  const start = performance.now();
  const recipes = await getRecipes(filter);
  const duration = performance.now() - start;
  const threshold = 1000;

  return {
    name: 'Complex Multi-Filter Query',
    duration,
    count: recipes.length,
    avgTime: duration,
    passed: duration < threshold,
    threshold,
    unit: 'ms',
  };
}

/**
 * Run all performance benchmarks and return results.
 */
export async function runPerformanceBenchmarks(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  console.log('=== Performance Benchmark Suite ===\n');
  console.log('Phase 1: Database Setup');
  console.log('  Initializing database...');
  runMigrations();
  console.log('  Database ready.\n');

  try {
    console.log('Phase 2: Recipe Insertion Performance');
    const insertionResult = await benchmarkRecipeInsertion();
    results.push(insertionResult);
    console.log(`  ✓ Complete: ${insertionResult.avgTime.toFixed(2)}ms per recipe\n`);

    console.log('Phase 3: Recipe Query Performance');
    const queryAllResult = await benchmarkQueryAllRecipes();
    results.push(queryAllResult);
    console.log(`  ✓ Complete: ${queryAllResult.duration.toFixed(2)}ms\n`);

    const timeFilterResult = await benchmarkQueryTimeFilter();
    results.push(timeFilterResult);
    console.log(`  ✓ Complete: ${timeFilterResult.duration.toFixed(2)}ms\n`);

    const cookwareFilterResult = await benchmarkQueryCookwareFilter();
    results.push(cookwareFilterResult);
    console.log(`  ✓ Complete: ${cookwareFilterResult.duration.toFixed(2)}ms\n`);

    const dietaryFilterResult = await benchmarkQueryDietaryFilter();
    results.push(dietaryFilterResult);
    console.log(`  ✓ Complete: ${dietaryFilterResult.duration.toFixed(2)}ms\n`);

    const complexQueryResult = await benchmarkComplexQuery();
    results.push(complexQueryResult);
    console.log(`  ✓ Complete: ${complexQueryResult.duration.toFixed(2)}ms\n`);

    console.log('Phase 4: Ingredient Query Performance');
    const ingredientsResult = await benchmarkQueryIngredients();
    results.push(ingredientsResult);
    console.log(`  ✓ Complete: ${ingredientsResult.duration.toFixed(2)}ms\n`);

    const byIngredientResult = await benchmarkQueryByIngredient();
    results.push(byIngredientResult);
    console.log(`  ✓ Complete: ${byIngredientResult.duration.toFixed(2)}ms\n`);

    console.log('Phase 5: Full-Text Search Performance');
    const searchResult = await benchmarkFullTextSearch();
    results.push(searchResult);
    console.log(`  ✓ Complete: ${searchResult.duration.toFixed(2)}ms\n`);

    console.log('=== Benchmark Results Summary ===\n');
    printResults(results);

    return results;
  } finally {
    console.log('\nPhase 6: Cleanup');
    console.log('  Closing database...');
    closeDatabase();
    console.log('  Database closed.\n');
  }
}

/**
 * Print benchmark results in a readable table format.
 */
function printResults(results: BenchmarkResult[]): void {
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│                      BENCHMARK RESULTS                          │');
  console.log('├─────────────────────────────────────────────────────────────────┤');

  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    const statusColor = result.passed ? '\x1b[32m' : '\x1b[31m'; // Green or Red
    const resetColor = '\x1b[0m';

    console.log(`│ ${result.name.padEnd(45)} │`);
    console.log(
      `│   Count: ${String(result.count).padEnd(10)} Duration: ${result.duration.toFixed(2).padStart(10)}ms │`
    );

    if (result.unit === 'ms/recipe') {
      console.log(
        `│   Avg: ${result.avgTime.toFixed(2).padStart(8)}ms/recipe  Threshold: <${result.threshold}ms/recipe │`
      );
    } else {
      console.log(
        `│   Total: ${result.duration.toFixed(2).padStart(10)}ms  Threshold: <${result.threshold}ms       │`
      );
    }

    console.log(
      `│   Status: ${statusColor}${status}${resetColor}                                             │`
    );
    console.log('├─────────────────────────────────────────────────────────────────┤');
  }

  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const overallStatus =
    passCount === totalCount ? '✓ ALL PASSED' : `⚠ ${passCount}/${totalCount} PASSED`;
  const overallColor = passCount === totalCount ? '\x1b[32m' : '\x1b[33m'; // Green or Yellow
  const resetColor = '\x1b[0m';

  console.log(
    `│ ${overallColor}${overallStatus}${resetColor}                                                    │`
  );
  console.log('└─────────────────────────────────────────────────────────────────┘');
}

// Execute when run directly with tsx
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceBenchmarks().catch(console.error);
}
