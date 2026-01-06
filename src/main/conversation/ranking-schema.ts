import { z } from 'zod';

export const RecipeSuggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        recipeId: z.string().uuid(),
        relevanceScore: z.number().min(0).max(100),
        reasoning: z.string().min(20).max(500),
        matchedFactors: z.array(z.string()),
      })
    )
    .min(2)
    .max(4),
});

export type RecipeSuggestionOutput = z.infer<typeof RecipeSuggestionSchema>;
