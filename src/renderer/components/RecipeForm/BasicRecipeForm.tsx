import React, { useState } from 'react';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { determineDietaryProperties } from '../../utils/ingredient-classifier';
import type { CreateRecipeInput } from '../../../shared/types/recipe';
import type { CookwareType } from '../../../shared/types/database';

export function BasicRecipeForm() {
  const [title, setTitle] = useState('');
  const [cookingTimeMinutes, setCookingTimeMinutes] = useState('');
  const [cookwareType, setCookwareType] = useState<CookwareType | ''>('');
  const [ingredientName, setIngredientName] = useState('');
  const [ingredientQuantity, setIngredientQuantity] = useState('');
  const [ingredientUnit, setIngredientUnit] = useState('');

  const [errors, setErrors] = useState<Array<{ field: string; message: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);
    setSuccess(false);

    const input: CreateRecipeInput = {
      title,
      cookingTimeMinutes: parseInt(cookingTimeMinutes),
      cookwareType: cookwareType as CookwareType,
      servings: 2,
      dietaryTags: [],
      seasonality: ['any'],
      sourceType: 'manual',
      ingredients: [
        {
          name: ingredientName,
          quantity: parseFloat(ingredientQuantity),
          unit: ingredientUnit,
          dietaryProperties: determineDietaryProperties(ingredientName),
          optional: false,
          orderIndex: 1,
        },
      ],
    };

    const result = await window.electron.recipeAPI.create(input);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      // Reset form
      setTitle('');
      setCookingTimeMinutes('');
      setCookwareType('');
      setIngredientName('');
      setIngredientQuantity('');
      setIngredientUnit('');
    } else {
      setErrors(result.errors || []);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">Add New Recipe (Basic)</h1>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded text-green-800">
          Recipe added successfully!
        </div>
      )}

      {errors.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="text-red-800 font-semibold mb-2">Please fix the following errors:</h3>
          <ul className="list-disc list-inside text-red-700 text-sm">
            {errors.map((error, i) => (
              <li key={i}>
                <strong>{error.field}:</strong> {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Input label="Recipe Title" value={title} onChange={e => setTitle(e.target.value)} required />

      <Input
        label="Cooking Time (minutes)"
        type="number"
        value={cookingTimeMinutes}
        onChange={e => setCookingTimeMinutes(e.target.value)}
        required
      />

      <Select
        label="Cookware Type"
        value={cookwareType}
        onChange={e => setCookwareType(e.target.value as CookwareType)}
        options={[
          { value: 'one-pot', label: 'One Pot' },
          { value: 'one-pan', label: 'One Pan' },
          { value: 'oven', label: 'Oven' },
        ]}
        required
      />

      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Ingredient</h3>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="Name"
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={ingredientName}
            onChange={e => setIngredientName(e.target.value)}
            required
          />
          <input
            type="number"
            placeholder="Quantity"
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={ingredientQuantity}
            onChange={e => setIngredientQuantity(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Unit"
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={ingredientUnit}
            onChange={e => setIngredientUnit(e.target.value)}
            required
          />
        </div>
      </div>

      <Button type="submit" loading={loading}>
        Save Recipe
      </Button>
    </form>
  );
}
