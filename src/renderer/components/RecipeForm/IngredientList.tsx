import React from 'react';
import { IngredientRow } from './IngredientRow';

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
  optional: boolean;
}

interface IngredientListProps {
  ingredients: Ingredient[];
  setIngredients: (ingredients: Ingredient[]) => void;
}

export function IngredientList({ ingredients, setIngredients }: IngredientListProps) {
  const handleChange = (index: number, field: string, value: string | boolean) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value } as Ingredient;
    setIngredients(updated);
  };

  const handleRemove = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    setIngredients([...ingredients, { name: '', quantity: '', unit: '', optional: false }]);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Ingredients <span className="text-red-500">*</span>
      </label>
      {ingredients.map((ingredient, index) => (
        <IngredientRow
          key={index}
          index={index}
          ingredient={ingredient}
          onChange={handleChange}
          onRemove={handleRemove}
          canRemove={ingredients.length > 1}
        />
      ))}
      <button
        type="button"
        onClick={handleAdd}
        className="mt-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        + Add Ingredient
      </button>
    </div>
  );
}
