import type { Recipe } from '../../../shared/types/recipe';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: (id: string) => void; // Changed from number to string
}

export function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  return (
    <div
      data-testid="recipe-card"
      onClick={() => onClick(recipe.id)}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer p-6 border border-gray-200"
    >
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{recipe.title}</h3>

      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
        <div className="flex items-center">
          <span className="font-medium">⏱️ {recipe.cookingTimeMinutes} min</span>
        </div>
        <div className="flex items-center">
          <span className="font-medium">
            {recipe.cookwareType === 'one-pot' && '🍲 One Pot'}
            {recipe.cookwareType === 'one-pan' && '🍳 One Pan'}
            {recipe.cookwareType === 'oven' && '🔥 Oven'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {recipe.dietaryTags.map(tag => (
          <span
            key={tag}
            className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
