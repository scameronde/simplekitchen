import { z } from 'zod';

export const IngredientGenerationSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(50),
  dietaryProperties: z.array(
    z.enum([
      'contains-gluten',
      'contains-lactose',
      'contains-eggs',
      'contains-fish',
      'contains-meat',
      'none',
    ])
  ),
  optional: z.boolean().default(false),
  orderIndex: z.number().int().min(0),
});

export const RecipeGenerationSchema = z.object({
  title: z.string().min(1).max(200),
  cookingTimeMinutes: z.number().int().min(30).max(45),
  prepTimeMinutes: z.number().int().min(0).max(30).nullable(),
  cookwareType: z.enum(['one-pot', 'one-pan', 'oven']),
  servings: z.literal(2),
  dietaryTags: z.array(
    z.enum(['gluten-free', 'lactose-free', 'vegetarian', 'vegan', 'pescatarian'])
  ),
  seasonality: z.array(z.enum(['spring', 'summer', 'fall', 'winter', 'any'])),
  instructions: z.string().min(50).max(5000).nullable(),
  ingredients: z.array(IngredientGenerationSchema).min(1).max(30),
});

export type RecipeGenerationOutput = z.infer<typeof RecipeGenerationSchema>;
export type IngredientGenerationOutput = z.infer<typeof IngredientGenerationSchema>;
