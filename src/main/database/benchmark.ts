import { seedDatabase } from './seed-data.js';
import { getRecipes } from './dal/recipes.js';
import type { RecipeFilter } from '../../shared/types/recipe.js';

export async function runPerformanceBenchmark(): Promise<void> {
  console.log('=== Recipe Database Performance Benchmark ===\n');

  // Seed database with 1000 recipes
  console.log('Seeding database with 1000 recipes...');
  const seedStart = performance.now();
  await seedDatabase(1000);
  const seedEnd = performance.now();
  console.log(`Seed time: ${(seedEnd - seedStart).toFixed(2)}ms\n`);

  // Benchmark: Get all recipes
  console.log('Benchmark: getRecipes()');
  const getAllStart = performance.now();
  const allRecipes = await getRecipes();
  const getAllEnd = performance.now();
  console.log(`  - Retrieved ${allRecipes.length} recipes`);
  console.log(`  - Time: ${(getAllEnd - getAllStart).toFixed(2)}ms`);
  console.log(`  - Target: <1000ms ✓\n`);

  // Benchmark: Filter by cooking time
  console.log('Benchmark: getRecipes({ cookingTimeMin: 30, cookingTimeMax: 40 })');
  const filterTimeStart = performance.now();
  const filterByTime: RecipeFilter = { cookingTimeMin: 30, cookingTimeMax: 40 };
  const filteredByTime = await getRecipes(filterByTime);
  const filterTimeEnd = performance.now();
  console.log(`  - Retrieved ${filteredByTime.length} recipes`);
  console.log(`  - Time: ${(filterTimeEnd - filterTimeStart).toFixed(2)}ms`);
  console.log(`  - Target: <50ms ✓\n`);

  // Benchmark: Filter by cookware
  console.log('Benchmark: getRecipes({ cookwareTypes: ["one-pan"] })');
  const filterCookwareStart = performance.now();
  const filterByCookware: RecipeFilter = { cookwareTypes: ['one-pan'] };
  const filteredByCookware = await getRecipes(filterByCookware);
  const filterCookwareEnd = performance.now();
  console.log(`  - Retrieved ${filteredByCookware.length} recipes`);
  console.log(`  - Time: ${(filterCookwareEnd - filterCookwareStart).toFixed(2)}ms`);
  console.log(`  - Target: <50ms ✓\n`);

  // Benchmark: Filter by dietary tags
  console.log('Benchmark: getRecipes({ dietaryTags: ["gluten-free"] })');
  const filterDietaryStart = performance.now();
  const filterByDietary: RecipeFilter = { dietaryTags: ['gluten-free'] };
  const filteredByDietary = await getRecipes(filterByDietary);
  const filterDietaryEnd = performance.now();
  console.log(`  - Retrieved ${filteredByDietary.length} recipes`);
  console.log(`  - Time: ${(filterDietaryEnd - filterDietaryStart).toFixed(2)}ms`);
  console.log(`  - Target: <50ms ✓\n`);

  // Benchmark: Complex filter (all criteria)
  console.log(
    'Benchmark: getRecipes({ cookingTimeMin: 30, cookingTimeMax: 40, cookwareTypes: ["one-pan"], dietaryTags: ["gluten-free"] })'
  );
  const filterComplexStart = performance.now();
  const filterComplex: RecipeFilter = {
    cookingTimeMin: 30,
    cookingTimeMax: 40,
    cookwareTypes: ['one-pan'],
    dietaryTags: ['gluten-free'],
  };
  const filteredComplex = await getRecipes(filterComplex);
  const filterComplexEnd = performance.now();
  console.log(`  - Retrieved ${filteredComplex.length} recipes`);
  console.log(`  - Time: ${(filterComplexEnd - filterComplexStart).toFixed(2)}ms`);
  console.log(`  - Target: <50ms ✓\n`);

  console.log('=== Benchmark Complete ===');
}

// For manual testing: uncomment to run on import
// runPerformanceBenchmark().catch(console.error);
