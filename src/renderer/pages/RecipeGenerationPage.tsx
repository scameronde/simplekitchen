import React, { useState } from 'react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { RecipeDietaryTags } from '../components/RecipeForm/RecipeDietaryTags';
import { RecipeSeasonality } from '../components/RecipeForm/RecipeSeasonality';
import { RecipeBasicInfo } from '../components/RecipeForm/RecipeBasicInfo';
import { IngredientList } from '../components/RecipeForm/IngredientList';
import { ValidationErrors } from '../components/RecipeForm/ValidationErrors';
import { determineDietaryProperties } from '../utils/ingredient-classifier';
import type { RecipeGenerationCriteria, RecipeGenerationError } from '../../shared/types/ai';
import type {
  CreateRecipeInput,
  CookwareType,
  DietaryTag,
  Season,
} from '../../shared/types/recipe';

type Mode = 'criteria' | 'review';

export function RecipeGenerationPage() {
  // Mode state
  const [mode, setMode] = useState<Mode>('criteria');

  // Criteria form state
  const [criteria, setCriteria] = useState<RecipeGenerationCriteria>({
    cuisine: '',
    mainIngredient: '',
    dietaryTags: [],
    seasonality: [],
    cookwareType: undefined,
    flavorProfile: '',
    skillLevel: undefined,
  });

  // Generated recipe state (stored for potential future use)
  const [_generatedRecipe, setGeneratedRecipe] = useState<CreateRecipeInput | null>(null);

  // Review form state (for editing generated recipe)
  const [reviewFormData, setReviewFormData] = useState({
    title: '',
    cookingTimeMinutes: '',
    prepTimeMinutes: '',
    cookwareType: '',
    dietaryTags: [] as DietaryTag[],
    seasonality: [] as Season[],
    instructions: '',
  });
  const [reviewIngredients, setReviewIngredients] = useState([
    { name: '', quantity: '', unit: '', optional: false },
  ]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RecipeGenerationError | null>(null);
  const [saveErrors, setSaveErrors] = useState<Array<{ field: string; message: string }>>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Criteria form handlers
  const handleCriteriaChange = (field: keyof RecipeGenerationCriteria, value: string) => {
    setCriteria(prev => ({ ...prev, [field]: value }));
  };

  const handleDietaryTagsChange = (tags: string[]) => {
    setCriteria(prev => ({ ...prev, dietaryTags: tags as DietaryTag[] }));
  };

  const handleSeasonalityChange = (seasons: string[]) => {
    setCriteria(prev => ({ ...prev, seasonality: seasons as Season[] }));
  };

  const handleCookwareTypeChange = (type: CookwareType | '') => {
    setCriteria(prev => ({ ...prev, cookwareType: type || undefined }));
  };

  const handleSkillLevelChange = (level: string) => {
    setCriteria(prev => ({
      ...prev,
      skillLevel: level ? (level as 'beginner' | 'intermediate' | 'advanced') : undefined,
    }));
  };

  // Generate recipe handler
  const handleGenerateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Build criteria object with only non-empty values
    const criteriaToSend: RecipeGenerationCriteria = {
      dietaryTags: criteria.dietaryTags,
    };

    if (criteria.cuisine?.trim()) criteriaToSend.cuisine = criteria.cuisine.trim();
    if (criteria.mainIngredient?.trim())
      criteriaToSend.mainIngredient = criteria.mainIngredient.trim();
    if (criteria.seasonality && criteria.seasonality.length > 0)
      criteriaToSend.seasonality = criteria.seasonality;
    if (criteria.cookwareType) criteriaToSend.cookwareType = criteria.cookwareType;
    if (criteria.flavorProfile?.trim())
      criteriaToSend.flavorProfile = criteria.flavorProfile.trim();
    if (criteria.skillLevel) criteriaToSend.skillLevel = criteria.skillLevel;

    const result = await window.electron.recipeAPI.generateRecipe(criteriaToSend);
    setLoading(false);

    if (result.success && result.recipe) {
      setGeneratedRecipe(result.recipe);
      // Populate review form with generated data
      setReviewFormData({
        title: result.recipe.title,
        cookingTimeMinutes: result.recipe.cookingTimeMinutes.toString(),
        prepTimeMinutes: result.recipe.prepTimeMinutes?.toString() || '',
        cookwareType: result.recipe.cookwareType,
        dietaryTags: result.recipe.dietaryTags,
        seasonality: result.recipe.seasonality,
        instructions: result.recipe.instructions || '',
      });
      setReviewIngredients(
        result.recipe.ingredients.map(ing => ({
          name: ing.name,
          quantity: ing.quantity.toString(),
          unit: ing.unit,
          optional: ing.optional || false,
        }))
      );
      setMode('review');
    } else if (result.error) {
      setError(result.error);
    }
  };

  // Review form handlers
  const handleReviewFieldChange = (field: string, value: string | string[]) => {
    setReviewFormData(prev => ({ ...prev, [field]: value }));
  };

  // Save recipe handler
  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveErrors([]);
    setSaveSuccess(false);

    const input: CreateRecipeInput = {
      title: reviewFormData.title,
      cookingTimeMinutes: parseInt(reviewFormData.cookingTimeMinutes),
      prepTimeMinutes: reviewFormData.prepTimeMinutes
        ? parseInt(reviewFormData.prepTimeMinutes)
        : undefined,
      cookwareType: reviewFormData.cookwareType as CookwareType,
      servings: 2,
      dietaryTags: reviewFormData.dietaryTags,
      seasonality: reviewFormData.seasonality.length > 0 ? reviewFormData.seasonality : ['any'],
      sourceType: 'ai-generated',
      instructions: reviewFormData.instructions || undefined,
      ingredients: reviewIngredients.map((ing, i) => ({
        name: ing.name,
        quantity: parseFloat(ing.quantity),
        unit: ing.unit,
        dietaryProperties: determineDietaryProperties(ing.name),
        optional: ing.optional,
        orderIndex: i + 1,
      })),
    };

    const result = await window.electron.recipeAPI.create(input);
    setSaving(false);

    if (result.success) {
      setSaveSuccess(true);
      // Reset to criteria mode after successful save
      setTimeout(() => {
        setMode('criteria');
        setSaveSuccess(false);
        setGeneratedRecipe(null);
        // Optionally reset criteria
        setCriteria({
          cuisine: '',
          mainIngredient: '',
          dietaryTags: [],
          seasonality: [],
          cookwareType: undefined,
          flavorProfile: '',
          skillLevel: undefined,
        });
      }, 2000);
    } else {
      setSaveErrors(result.errors || []);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Regenerate handler
  const handleRegenerate = () => {
    setMode('criteria');
    setGeneratedRecipe(null);
    setError(null);
    setSaveErrors([]);
    setSaveSuccess(false);
  };

  // Render criteria input mode
  if (mode === 'criteria') {
    return (
      <div className="container mx-auto px-4 py-8">
        <form
          onSubmit={handleGenerateRecipe}
          className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg"
        >
          <h1 className="text-3xl font-bold mb-6 text-gray-900">Generate Recipe with AI</h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{error.message}</p>
                  {error.details && <p className="text-sm text-red-700 mt-1">{error.details}</p>}
                  {error.retryAfter && (
                    <p className="text-sm text-red-700 mt-1">
                      Please retry after {error.retryAfter} seconds
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <Input
              label="Cuisine (optional)"
              type="text"
              placeholder="e.g., Italian, Thai, Mexican"
              value={criteria.cuisine || ''}
              onChange={e => handleCriteriaChange('cuisine', e.target.value)}
            />

            <Input
              label="Main Ingredient (optional)"
              type="text"
              placeholder="e.g., chicken, tofu, pasta"
              value={criteria.mainIngredient || ''}
              onChange={e => handleCriteriaChange('mainIngredient', e.target.value)}
            />

            <RecipeDietaryTags
              selectedTags={criteria.dietaryTags}
              onChange={handleDietaryTagsChange}
            />

            <RecipeSeasonality
              selectedSeasons={criteria.seasonality || []}
              onChange={handleSeasonalityChange}
            />

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cookware Type (optional)
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cookwareType"
                    value=""
                    checked={!criteria.cookwareType}
                    onChange={e => handleCookwareTypeChange(e.target.value as '')}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Any</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cookwareType"
                    value="one-pot"
                    checked={criteria.cookwareType === 'one-pot'}
                    onChange={e => handleCookwareTypeChange(e.target.value as CookwareType)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">One-Pot</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cookwareType"
                    value="one-pan"
                    checked={criteria.cookwareType === 'one-pan'}
                    onChange={e => handleCookwareTypeChange(e.target.value as CookwareType)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">One-Pan</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cookwareType"
                    value="oven"
                    checked={criteria.cookwareType === 'oven'}
                    onChange={e => handleCookwareTypeChange(e.target.value as CookwareType)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Oven</span>
                </label>
              </div>
            </div>

            <Input
              label="Flavor Profile (optional)"
              type="text"
              placeholder="e.g., spicy, savory, comfort food"
              value={criteria.flavorProfile || ''}
              onChange={e => handleCriteriaChange('flavorProfile', e.target.value)}
            />

            <Select
              label="Skill Level (optional)"
              value={criteria.skillLevel || ''}
              onChange={e => handleSkillLevelChange(e.target.value)}
              options={[
                { value: 'beginner', label: 'Beginner' },
                { value: 'intermediate', label: 'Intermediate' },
                { value: 'advanced', label: 'Advanced' },
              ]}
            />
          </div>

          <div className="flex justify-end mt-6">
            <Button type="submit" loading={loading}>
              Generate Recipe
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // Render review mode
  return (
    <div className="container mx-auto px-4 py-8">
      <form
        onSubmit={handleSaveRecipe}
        className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg"
      >
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Review Generated Recipe</h1>

        {saveSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">Recipe saved successfully!</p>
              </div>
            </div>
          </div>
        )}

        <ValidationErrors errors={saveErrors} />

        <RecipeBasicInfo formData={reviewFormData} onChange={handleReviewFieldChange} />

        <RecipeDietaryTags
          selectedTags={reviewFormData.dietaryTags}
          onChange={tags => handleReviewFieldChange('dietaryTags', tags)}
        />

        <RecipeSeasonality
          selectedSeasons={reviewFormData.seasonality}
          onChange={seasons => handleReviewFieldChange('seasonality', seasons)}
        />

        <IngredientList ingredients={reviewIngredients} setIngredients={setReviewIngredients} />

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Instructions (optional)
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={5}
            placeholder="Enter cooking instructions..."
            value={reviewFormData.instructions}
            onChange={e => handleReviewFieldChange('instructions', e.target.value)}
          />
        </div>

        <div className="flex justify-between">
          <Button type="button" variant="secondary" onClick={handleRegenerate}>
            Regenerate
          </Button>
          <Button type="submit" loading={saving}>
            Save Recipe
          </Button>
        </div>
      </form>
    </div>
  );
}
