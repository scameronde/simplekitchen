import { db } from '../init.js';
import { randomUUID } from 'crypto';
import { sql } from 'kysely';
import type {
  Recipe,
  CreateRecipeInput,
  UpdateRecipeInput,
  RecipeFilter,
} from '../../../shared/types/recipe.js';
import type { RecipeTable } from '../../../shared/types/database.js';
import { validateRecipeOrThrow } from '../../validation/index.js';

// Helper: Convert database row to application Recipe (deserialize JSON, parse dates)
function dbToRecipe(row: RecipeTable, ingredients: Recipe['ingredients']): Recipe {
  return {
    id: row.id,
    title: row.title,
    cookingTimeMinutes: row.cooking_time_minutes,
    prepTimeMinutes: row.prep_time_minutes,
    totalTimeMinutes: row.total_time_minutes,
    cookwareType: row.cookware_type,
    servings: row.servings,
    dietaryTags: JSON.parse(row.dietary_tags),
    seasonality: JSON.parse(row.seasonality),
    sourceType: row.source_type,
    sourceReference: row.source_reference,
    instructions: row.instructions,
    ingredients, // Will be populated by caller
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// Create new recipe with ingredients (transactional)
export async function createRecipe(input: CreateRecipeInput): Promise<Recipe> {
  const recipeId = randomUUID();
  const now = new Date().toISOString();

  const totalTime = (input.prepTimeMinutes || 0) + input.cookingTimeMinutes;

  // Validate recipe before persisting
  await validateRecipeOrThrow(input);

  // Insert recipe
  await db
    .insertInto('recipes')
    .values({
      id: recipeId,
      title: input.title,
      cooking_time_minutes: input.cookingTimeMinutes,
      prep_time_minutes: input.prepTimeMinutes || null,
      total_time_minutes: totalTime,
      cookware_type: input.cookwareType,
      servings: input.servings,
      dietary_tags: JSON.stringify(input.dietaryTags),
      seasonality: JSON.stringify(input.seasonality),
      source_type: input.sourceType,
      source_reference: input.sourceReference || null,
      instructions: input.instructions || null,
      created_at: now,
      updated_at: now,
    })
    .execute();

  // Insert ingredients
  const ingredientRows = input.ingredients.map((ing, index) => ({
    id: randomUUID(),
    recipe_id: recipeId,
    name: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    dietary_properties: JSON.stringify(ing.dietaryProperties),
    optional: ing.optional ? 1 : 0,
    order_index: ing.orderIndex ?? index + 1,
  }));

  if (ingredientRows.length > 0) {
    await db.insertInto('ingredients').values(ingredientRows).execute();
  }

  // Return created recipe
  const recipe = await getRecipeById(recipeId);
  if (!recipe) throw new Error('Failed to create recipe');
  return recipe;
}

// Get recipe by ID (with ingredients)
export async function getRecipeById(id: string): Promise<Recipe | null> {
  const recipeRow = await db
    .selectFrom('recipes')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();

  if (!recipeRow) return null;

  const ingredientRows = await db
    .selectFrom('ingredients')
    .selectAll()
    .where('recipe_id', '=', id)
    .orderBy('order_index', 'asc')
    .execute();

  const ingredients = ingredientRows.map(ing => ({
    id: ing.id,
    recipeId: ing.recipe_id,
    name: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    dietaryProperties: JSON.parse(ing.dietary_properties),
    optional: ing.optional === 1,
    orderIndex: ing.order_index,
  }));

  return dbToRecipe(recipeRow, ingredients);
}

// Get all recipes (with optional filtering)
export async function getRecipes(filter?: RecipeFilter): Promise<Recipe[]> {
  let query = db.selectFrom('recipes').selectAll();

  // Apply filters
  if (filter) {
    if (filter.cookingTimeMin !== undefined) {
      query = query.where('cooking_time_minutes', '>=', filter.cookingTimeMin);
    }
    if (filter.cookingTimeMax !== undefined) {
      query = query.where('cooking_time_minutes', '<=', filter.cookingTimeMax);
    }
    if (filter.cookwareTypes && filter.cookwareTypes.length > 0) {
      query = query.where('cookware_type', 'in', filter.cookwareTypes);
    }
    if (filter.sourceTypes && filter.sourceTypes.length > 0) {
      query = query.where('source_type', 'in', filter.sourceTypes);
    }

    // Apply dietary tags filter (check if ALL selected tags are present)
    if (filter.dietaryTags && filter.dietaryTags.length > 0) {
      for (const tag of filter.dietaryTags) {
        // SQLite JSON array contains check using LIKE pattern
        query = query.where(sql<boolean>`dietary_tags LIKE ${'%"' + tag + '"%'}`);
      }
    }

    // Apply seasonality filter (check if ANY selected season matches)
    if (filter.seasonality && filter.seasonality.length > 0) {
      query = query.where(({ eb, or }) => {
        const seasonalityConditions = filter.seasonality!.map(season =>
          eb(sql<string>`seasonality`, 'like', `%"${season}"%`)
        );
        return or(seasonalityConditions);
      });
    }
  }

  const recipeRows = await query.execute();

  // Fetch ingredients for all recipes (N+1 query for now, will optimize in Phase 4)
  const recipes: Recipe[] = [];
  for (const row of recipeRows) {
    const recipe = await getRecipeById(row.id);
    if (recipe) recipes.push(recipe);
  }

  return recipes;
}

// Update recipe
export async function updateRecipe(id: string, input: UpdateRecipeInput): Promise<Recipe | null> {
  const existing = await getRecipeById(id);
  if (!existing) return null;

  // Validate recipe before persisting
  await validateRecipeOrThrow(input);

  const now = new Date().toISOString();

  // Build update object
  const updates: Partial<RecipeTable> = { updated_at: now };
  if (input.title !== undefined) updates.title = input.title;
  if (input.cookingTimeMinutes !== undefined) {
    updates.cooking_time_minutes = input.cookingTimeMinutes;
    const prepTime = input.prepTimeMinutes ?? existing.prepTimeMinutes ?? 0;
    updates.total_time_minutes = prepTime + input.cookingTimeMinutes;
  }
  if (input.prepTimeMinutes !== undefined) {
    updates.prep_time_minutes = input.prepTimeMinutes;
    updates.total_time_minutes = input.prepTimeMinutes + existing.cookingTimeMinutes;
  }
  if (input.cookwareType !== undefined) updates.cookware_type = input.cookwareType;
  if (input.dietaryTags !== undefined) updates.dietary_tags = JSON.stringify(input.dietaryTags);
  if (input.seasonality !== undefined) updates.seasonality = JSON.stringify(input.seasonality);
  if (input.instructions !== undefined) updates.instructions = input.instructions;

  // Update recipe
  await db.updateTable('recipes').set(updates).where('id', '=', id).execute();

  // If ingredients provided, replace all
  if (input.ingredients !== undefined) {
    // Delete old ingredients
    await db.deleteFrom('ingredients').where('recipe_id', '=', id).execute();

    // Insert new ingredients
    const ingredientRows = input.ingredients.map((ing, index) => ({
      id: randomUUID(),
      recipe_id: id,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      dietary_properties: JSON.stringify(ing.dietaryProperties),
      optional: ing.optional ? 1 : 0,
      order_index: ing.orderIndex ?? index + 1,
    }));

    if (ingredientRows.length > 0) {
      await db.insertInto('ingredients').values(ingredientRows).execute();
    }
  }

  // Return updated recipe
  return getRecipeById(id);
}

// Delete recipe (cascade deletes ingredients via foreign key)
export async function deleteRecipe(id: string): Promise<boolean> {
  const result = await db.deleteFrom('recipes').where('id', '=', id).execute();
  return result.length > 0;
}

// Get recipe count (for stats)
export async function getRecipeCount(): Promise<number> {
  const result = await db
    .selectFrom('recipes')
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst();
  return Number(result?.count ?? 0);
}
