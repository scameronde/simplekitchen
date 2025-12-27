import React from 'react';
import { BasicRecipeForm } from '../components/RecipeForm/BasicRecipeForm';

export function AddRecipePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <BasicRecipeForm />
    </div>
  );
}
