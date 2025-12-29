import { useState, useEffect } from 'react';
import { Button } from '../components/common/Button';
import type { Recipe } from '../../shared/types/recipe';

interface RecipeDetailPageProps {
  recipeId: string;
  onBack: () => void;
}

export function RecipeDetailPage({ recipeId, onBack }: RecipeDetailPageProps) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecipe();
  }, [recipeId]);

  const loadRecipe = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await window.electron.recipeAPI.getById(recipeId);
      if (response.success && response.recipe) {
        setRecipe(response.recipe);
      } else {
        setError(response.errors?.[0]?.message || 'Recipe not found');
      }
    } catch (err) {
      console.error('Failed to load recipe:', err);
      setError('Failed to load recipe');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-center text-gray-500">Loading recipe...</p>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-center text-red-600">{error || 'Recipe not found'}</p>
        <div className="text-center mt-4">
          <Button onClick={onBack} variant="secondary">
            Back to Recipes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Button onClick={onBack} variant="secondary">
          ← Back to Recipes
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8">
        {/* Header */}
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{recipe.title}</h1>

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 mb-6 text-sm text-gray-600">
          <div className="flex items-center">
            <span className="font-medium">⏱️ Cooking Time:</span>
            <span className="ml-2">{recipe.cookingTimeMinutes} minutes</span>
          </div>
          {recipe.prepTimeMinutes && (
            <div className="flex items-center">
              <span className="font-medium">🔪 Prep Time:</span>
              <span className="ml-2">{recipe.prepTimeMinutes} minutes</span>
            </div>
          )}
          <div className="flex items-center">
            <span className="font-medium">🍽️ Servings:</span>
            <span className="ml-2">{recipe.servings}</span>
          </div>
          <div className="flex items-center">
            <span className="font-medium">
              {recipe.cookwareType === 'one-pot' && '🍲 One Pot'}
              {recipe.cookwareType === 'one-pan' && '🍳 One Pan'}
              {recipe.cookwareType === 'oven' && '🔥 Oven'}
            </span>
          </div>
        </div>

        {/* Dietary Tags */}
        {recipe.dietaryTags.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Dietary Tags</h2>
            <div className="flex flex-wrap gap-2">
              {recipe.dietaryTags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Seasonality */}
        {recipe.seasonality.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Seasonality</h2>
            <div className="flex flex-wrap gap-2">
              {recipe.seasonality.map(season => (
                <span
                  key={season}
                  className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded"
                >
                  {season}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ingredients */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index} className="flex items-start">
                <span className="text-gray-700">
                  {ingredient.quantity} {ingredient.unit} {ingredient.name}
                  {ingredient.optional && (
                    <span className="text-gray-500 italic ml-2">(optional)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Instructions */}
        {recipe.instructions && (
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Instructions</h2>
            <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
              {recipe.instructions}
            </div>
          </div>
        )}

        {/* Source */}
        {recipe.sourceReference && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Source:{' '}
              <a
                href={recipe.sourceReference}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {recipe.sourceReference}
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
