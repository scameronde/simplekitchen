import React from 'react';

interface IngredientRowProps {
  index: number;
  ingredient: { name: string; quantity: string; unit: string; optional: boolean };
  onChange: (index: number, field: string, value: string | boolean) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export function IngredientRow({
  index,
  ingredient,
  onChange,
  onRemove,
  canRemove,
}: IngredientRowProps) {
  return (
    <div className="grid grid-cols-12 gap-2 mb-2">
      <input
        type="text"
        placeholder="Name"
        className="col-span-5 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={ingredient.name}
        onChange={e => onChange(index, 'name', e.target.value)}
        required
      />
      <input
        type="number"
        step="0.01"
        placeholder="Qty"
        className="col-span-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={ingredient.quantity}
        onChange={e => onChange(index, 'quantity', e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Unit"
        className="col-span-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={ingredient.unit}
        onChange={e => onChange(index, 'unit', e.target.value)}
        required
      />
      <label className="col-span-2 flex items-center text-sm">
        <input
          type="checkbox"
          className="mr-1"
          checked={ingredient.optional}
          onChange={e => onChange(index, 'optional', e.target.checked)}
        />
        Optional
      </label>
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="col-span-1 text-red-600 hover:text-red-800 font-bold"
          title="Remove ingredient"
        >
          ×
        </button>
      )}
    </div>
  );
}
