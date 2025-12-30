import React, { useState } from 'react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { RecipeBasicInfo } from '../components/RecipeForm/RecipeBasicInfo';
import { RecipeDietaryTags } from '../components/RecipeForm/RecipeDietaryTags';
import { RecipeSeasonality } from '../components/RecipeForm/RecipeSeasonality';
import { IngredientList } from '../components/RecipeForm/IngredientList';
import { ValidationErrors } from '../components/RecipeForm/ValidationErrors';
import { determineDietaryProperties } from '../utils/ingredient-classifier';
import type {
  CreateRecipeInput,
  CookwareType,
  DietaryTag,
  Season,
} from '../../shared/types/recipe';

type Mode = 'import' | 'review';

export function RecipeImportPage() {
  // Mode state
  const [mode, setMode] = useState<Mode>('import');

  // Import form state
  const [url, setUrl] = useState('');

  // Review form state (for editing imported recipe)
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
  const [error, setError] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Array<{ field: string; message: string }>>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Import handler
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await window.electron.recipeAPI.importRecipe(url);
    setLoading(false);

    if (result.success && result.recipe) {
      // Populate review form with imported data
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
    } else if (result.errors && result.errors.length > 0) {
      setError(result.errors.map(e => `${e.field}: ${e.message}`).join('; '));
    } else {
      setError('Failed to import recipe. Please check the URL and try again.');
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
      sourceType: 'web-imported',
      sourceReference: url,
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
      // Reset to import mode after successful save
      setTimeout(() => {
        setMode('import');
        setSaveSuccess(false);
        setUrl('');
      }, 2000);
    } else {
      setSaveErrors(result.errors || []);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Cancel handler
  const handleCancel = () => {
    setMode('import');
    setError(null);
    setSaveErrors([]);
    setSaveSuccess(false);
  };

  // Render import mode
  if (mode === 'import') {
    return (
      <div className="container mx-auto px-4 py-8">
        <form
          onSubmit={handleImport}
          className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg"
        >
          <h1 className="text-3xl font-bold mb-6 text-gray-900">Import Recipe from Web</h1>

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
                  <p className="text-sm font-medium text-red-800">{error}</p>
                  <div className="mt-3 text-sm text-red-700">
                    <p className="mb-2">Alternatives:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Try another recipe URL</li>
                      <li>
                        Use{' '}
                        <a href="/add-recipe" className="underline hover:text-red-600">
                          manual entry
                        </a>{' '}
                        to create a recipe
                      </li>
                      <li>
                        Use{' '}
                        <a href="/generate-recipe" className="underline hover:text-red-600">
                          AI generation
                        </a>{' '}
                        to create a recipe
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <Input
              label="Recipe URL"
              type="url"
              placeholder="https://www.example.com/recipe/..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end mt-6">
            <Button type="submit" loading={loading}>
              Import Recipe
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
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Review Imported Recipe</h1>

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
          <Button type="button" variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save Recipe
          </Button>
        </div>
      </form>
    </div>
  );
}
