import type { 
  CookwareType, 
  Season, 
  SourceType, 
  DietaryTag, 
  DietaryProperty 
} from './database';

// Application-level Recipe (JSON fields parsed)
export interface Recipe {
  id: string;
  title: string;
  cookingTimeMinutes: number;
  prepTimeMinutes: number | null;
  totalTimeMinutes: number;
  cookwareType: CookwareType;
  servings: number;
  dietaryTags: DietaryTag[];
  seasonality: Season[];
  sourceType: SourceType;
  sourceReference: string | null;
  instructions: string | null;
  ingredients: Ingredient[]; // Nested ingredients
  createdAt: Date;
  updatedAt: Date;
}

// Application-level Ingredient
export interface Ingredient {
  id: string;
  recipeId: string;
  name: string;
  quantity: number;
  unit: string;
  dietaryProperties: DietaryProperty[];
  optional: boolean;
  orderIndex: number;
}

// Application-level Dietary Profile
export interface DietaryProfile {
  id: number;
  hardRestrictions: DietaryTag[];
  preferences: DietaryTag[];
  explicitInclusions: string[]; // Ingredient names
  explicitExclusions: string[]; // Ingredient names
  updatedAt: Date;
}

// Recipe creation input (no ID, no timestamps)
export interface CreateRecipeInput {
  title: string;
  cookingTimeMinutes: number;
  prepTimeMinutes?: number;
  cookwareType: CookwareType;
  servings: number;
  dietaryTags: DietaryTag[];
  seasonality: Season[];
  sourceType: SourceType;
  sourceReference?: string;
  instructions?: string;
  ingredients: CreateIngredientInput[];
}

// Ingredient creation input (no ID, no recipeId)
export interface CreateIngredientInput {
  name: string;
  quantity: number;
  unit: string;
  dietaryProperties: DietaryProperty[];
  optional?: boolean;
  orderIndex: number;
}

// Recipe update input (partial fields allowed)
export interface UpdateRecipeInput {
  title?: string;
  cookingTimeMinutes?: number;
  prepTimeMinutes?: number;
  cookwareType?: CookwareType;
  dietaryTags?: DietaryTag[];
  seasonality?: Season[];
  instructions?: string;
  ingredients?: CreateIngredientInput[]; // Replace all ingredients if provided
}

// Recipe filter criteria
export interface RecipeFilter {
  cookingTimeMin?: number;
  cookingTimeMax?: number;
  cookwareTypes?: CookwareType[];
  dietaryTags?: DietaryTag[]; // Recipes must have ALL specified tags
  seasonality?: Season[]; // Recipes matching ANY specified season
  sourceTypes?: SourceType[];
}
