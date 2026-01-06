import type { Recipe } from '../../../shared/types/recipe';

interface RecipeSuggestionCardProps {
  recipe: Recipe;
  reasoning: string;
  matchedFactors: string[];
  onSelect: () => void;
  onReject: () => void;
}

export function RecipeSuggestionCard({
  recipe,
  reasoning,
  matchedFactors,
  onSelect,
  onReject,
}: RecipeSuggestionCardProps) {
  // Get first 5 ingredients for summary
  const ingredientSummary = recipe.ingredients
    .slice(0, 5)
    .map(ing => ing.name)
    .join(', ');

  // Get cookware emoji
  const getCookwareEmoji = (cookwareType: string) => {
    switch (cookwareType) {
      case 'one-pot':
        return '🍲';
      case 'one-pan':
        return '🍳';
      case 'oven':
        return '🔥';
      default:
        return '🍴';
    }
  };

  return (
    <div
      data-testid="recipe-suggestion-card"
      className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-4"
    >
      {/* Recipe Title */}
      <h3 className="text-lg font-semibold mb-2 text-gray-900">{recipe.title}</h3>

      {/* Cooking Time and Cookware */}
      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
        <div className="flex items-center">
          <span className="font-medium">🕐 {recipe.totalTimeMinutes} min</span>
        </div>
        <div className="flex items-center">
          <span className="font-medium">
            {getCookwareEmoji(recipe.cookwareType)} {recipe.cookwareType === 'one-pot' && 'One Pot'}
            {recipe.cookwareType === 'one-pan' && 'One Pan'}
            {recipe.cookwareType === 'oven' && 'Oven'}
          </span>
        </div>
      </div>

      {/* Key Ingredients */}
      {ingredientSummary && (
        <div className="text-sm text-gray-700 mb-3">
          <span className="font-medium">Key ingredients: </span>
          {ingredientSummary}
          {recipe.ingredients.length > 5 && '...'}
        </div>
      )}

      {/* AI Reasoning */}
      <div
        className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-3"
        role="note"
        aria-label="AI reasoning for suggestion"
      >
        <p className="text-sm italic text-gray-700">{reasoning}</p>
      </div>

      {/* Matched Factors */}
      {matchedFactors.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-600 mb-2">Matched factors:</p>
          <div className="flex flex-wrap gap-2">
            {matchedFactors.map((factor, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
              >
                {factor}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onSelect}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
          aria-label={`Select recipe: ${recipe.title}`}
        >
          Select this recipe
        </button>
        <button
          onClick={onReject}
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded transition-colors"
          aria-label={`Reject recipe: ${recipe.title}`}
        >
          Not this one
        </button>
      </div>
    </div>
  );
}
