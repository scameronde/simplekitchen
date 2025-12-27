import React, { useState } from 'react';
import { ValidationErrors } from './ValidationErrors';
import { RecipeBasicInfo } from './RecipeBasicInfo';
import { RecipeDietaryTags } from './RecipeDietaryTags';
import { RecipeSeasonality } from './RecipeSeasonality';
import { IngredientList } from './IngredientList';
import { Button } from '../common/Button';
import { determineDietaryProperties } from '../../utils/ingredient-classifier';
import type { CreateRecipeInput, CookwareType } from '../../../shared/types/recipe';

export function RecipeForm() {
  const [formData, setFormData] = useState({
    title: '',
    cookingTimeMinutes: '',
    prepTimeMinutes: '',
    cookwareType: '',
    dietaryTags: [] as string[],
    seasonality: [] as string[],
    instructions: '',
  });

  const [ingredients, setIngredients] = useState([
    { name: '', quantity: '', unit: '', optional: false },
  ]);

  const [errors, setErrors] = useState<Array<{ field: string; message: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFieldChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);
    setSuccess(false);

    const input: CreateRecipeInput = {
      title: formData.title,
      cookingTimeMinutes: parseInt(formData.cookingTimeMinutes),
      prepTimeMinutes: formData.prepTimeMinutes ? parseInt(formData.prepTimeMinutes) : undefined,
      cookwareType: formData.cookwareType as CookwareType,
      servings: 2,
      dietaryTags: formData.dietaryTags as any[],
      seasonality: formData.seasonality.length > 0 ? (formData.seasonality as any[]) : ['any'],
      sourceType: 'manual',
      instructions: formData.instructions || undefined,
      ingredients: ingredients.map((ing, i) => ({
        name: ing.name,
        quantity: parseFloat(ing.quantity),
        unit: ing.unit,
        dietaryProperties: determineDietaryProperties(ing.name),
        optional: ing.optional,
        orderIndex: i + 1,
      })),
    };

    const result = await window.electron.recipeAPI.create(input);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      // Reset form
      setFormData({
        title: '',
        cookingTimeMinutes: '',
        prepTimeMinutes: '',
        cookwareType: '',
        dietaryTags: [],
        seasonality: [],
        instructions: '',
      });
      setIngredients([{ name: '', quantity: '', unit: '', optional: false }]);
    } else {
      setErrors(result.errors || []);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Add New Recipe</h1>

      {success && (
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
              <p className="text-sm font-medium text-green-800">Recipe added successfully!</p>
            </div>
          </div>
        </div>
      )}

      <ValidationErrors errors={errors} />

      <RecipeBasicInfo formData={formData} onChange={handleFieldChange} />

      <RecipeDietaryTags
        selectedTags={formData.dietaryTags}
        onChange={tags => handleFieldChange('dietaryTags', tags)}
      />

      <RecipeSeasonality
        selectedSeasons={formData.seasonality}
        onChange={seasons => handleFieldChange('seasonality', seasons)}
      />

      <IngredientList ingredients={ingredients} setIngredients={setIngredients} />

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Instructions (optional)
        </label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={5}
          placeholder="Enter cooking instructions..."
          value={formData.instructions}
          onChange={e => handleFieldChange('instructions', e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Save Recipe
        </Button>
      </div>
    </form>
  );
}
