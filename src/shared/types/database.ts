// Database schema types (will be used by Kysely)

export type CookwareType = 'one-pot' | 'one-pan' | 'oven';

export type Season = 'spring' | 'summer' | 'fall' | 'winter' | 'any';

export type SourceType = 'manual' | 'ai-generated' | 'web-imported';

// Dietary restriction enums
export type DietaryTag = 
  | 'gluten-free' 
  | 'lactose-free' 
  | 'vegetarian' 
  | 'vegan' 
  | 'pescatarian';

export type DietaryProperty = 
  | 'contains-gluten' 
  | 'contains-lactose' 
  | 'contains-eggs' 
  | 'contains-fish' 
  | 'contains-meat' 
  | 'none';

// Recipe table
export interface RecipeTable {
  id: string; // UUID primary key
  title: string;
  cooking_time_minutes: number; // Active cooking time (30-45)
  prep_time_minutes: number | null; // Optional prep time
  total_time_minutes: number; // Total time (prep + cook)
  cookware_type: CookwareType;
  servings: number; // Must be 2 per spec
  dietary_tags: string; // JSON array of DietaryTag[]
  seasonality: string; // JSON array of Season[]
  source_type: SourceType;
  source_reference: string | null; // URL if web-imported
  instructions: string | null; // Optional cooking instructions
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

// Ingredient table (one-to-many with Recipe)
export interface IngredientTable {
  id: string; // UUID primary key
  recipe_id: string; // Foreign key to recipes.id
  name: string; // Ingredient name (e.g., "olive oil")
  quantity: number; // Numeric quantity (e.g., 2)
  unit: string; // Unit of measurement (e.g., "tbsp", "cup", "lb")
  dietary_properties: string; // JSON array of DietaryProperty[]
  optional: number; // SQLite boolean (0 or 1)
  order_index: number; // Display order (1, 2, 3...)
}

// Dietary Profile table (singleton - one row only)
export interface DietaryProfileTable {
  id: number; // Always 1 (singleton)
  hard_restrictions: string; // JSON array of DietaryTag[] (e.g., ["gluten-free", "lactose-free"])
  preferences: string; // JSON array of DietaryTag[] (soft preferences)
  explicit_inclusions: string; // JSON array of ingredient names allowed despite restrictions
  explicit_exclusions: string; // JSON array of ingredient names excluded
  updated_at: string; // ISO 8601 timestamp
}

// Kysely database interface (aggregates all tables)
export interface Database {
  recipes: RecipeTable;
  ingredients: IngredientTable;
  dietary_profile: DietaryProfileTable;
}
