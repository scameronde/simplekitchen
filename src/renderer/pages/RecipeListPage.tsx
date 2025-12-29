import { useState, useEffect } from 'react';
import { FilterControls, type FilterState } from '../components/RecipeList/FilterControls';
import { RecipeGrid } from '../components/RecipeList/RecipeGrid';
import type { Recipe } from '../../shared/types/recipe';

interface RecipeListPageProps {
  onRecipeClick: (id: string) => void; // CORRECTED: string not number
}

export function RecipeListPage({ onRecipeClick }: RecipeListPageProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all recipes on mount
  useEffect(() => {
    loadAllRecipes();
  }, []);

  const loadAllRecipes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await window.electron.recipeAPI.getAll();
      if (response.success && response.recipe) {
        // CORRECTED: response.recipe not response.data
        setRecipes(response.recipe);
      } else {
        setError(response.errors?.[0]?.message || 'Failed to load recipes'); // CORRECTED: use errors array
      }
    } catch (err) {
      console.error('Failed to load recipes:', err);
      setError('Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = async (filters: FilterState) => {
    setLoading(true);
    setError(null);
    try {
      const response = await window.electron.recipeAPI.filter({
        cookingTimeMin: filters.cookingTimeMin, // CORRECTED: field name
        cookingTimeMax: filters.cookingTimeMax, // CORRECTED: field name
        cookwareTypes: filters.cookwareTypes.length > 0 ? filters.cookwareTypes : undefined,
        dietaryTags: filters.dietaryTags.length > 0 ? filters.dietaryTags : undefined,
      });
      if (response.success && response.recipe) {
        // CORRECTED: response.recipe not response.data
        setRecipes(response.recipe);
      } else {
        setError(response.errors?.[0]?.message || 'Failed to filter recipes'); // CORRECTED: use errors array
      }
    } catch (err) {
      console.error('Failed to filter recipes:', err);
      setError('Failed to filter recipes');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-center text-gray-500">Loading recipes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-center text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">My Recipes</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <FilterControls onFilterChange={handleFilterChange} />
        </div>

        <div className="lg:col-span-3">
          <RecipeGrid recipes={recipes} onRecipeClick={onRecipeClick} />
        </div>
      </div>
    </div>
  );
}
