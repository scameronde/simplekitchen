import { useState } from 'react';
import { Checkbox } from '../common/Checkbox';
import { Button } from '../common/Button';
import type { CookwareType, DietaryTag } from '../../../shared/types/recipe';
import { DIETARY_TAG_OPTIONS } from '../../../shared/constants/dietary-tags';

// Local state mirrors RecipeFilter structure
export interface FilterState {
  cookingTimeMin: number;
  cookingTimeMax: number;
  cookwareTypes: CookwareType[];
  dietaryTags: DietaryTag[];
}

interface FilterControlsProps {
  onFilterChange: (filters: FilterState) => void;
}

const COOKWARE_OPTIONS: CookwareType[] = ['one-pot', 'one-pan', 'oven'];

export function FilterControls({ onFilterChange }: FilterControlsProps) {
  const [minTime, setMinTime] = useState(30);
  const [maxTime, setMaxTime] = useState(45);
  const [selectedCookware, setSelectedCookware] = useState<CookwareType[]>([]);
  const [selectedDietary, setSelectedDietary] = useState<DietaryTag[]>([]);

  const handleCookwareToggle = (type: CookwareType) => {
    const updated = selectedCookware.includes(type)
      ? selectedCookware.filter(t => t !== type)
      : [...selectedCookware, type];
    setSelectedCookware(updated);
  };

  const handleDietaryToggle = (tag: DietaryTag) => {
    const updated = selectedDietary.includes(tag)
      ? selectedDietary.filter(t => t !== tag)
      : [...selectedDietary, tag];
    setSelectedDietary(updated);
  };

  const handleApplyFilters = () => {
    onFilterChange({
      cookingTimeMin: minTime,
      cookingTimeMax: maxTime,
      cookwareTypes: selectedCookware,
      dietaryTags: selectedDietary,
    });
  };

  const handleClearFilters = () => {
    setMinTime(30);
    setMaxTime(45);
    setSelectedCookware([]);
    setSelectedDietary([]);
    onFilterChange({
      cookingTimeMin: 30,
      cookingTimeMax: 45,
      cookwareTypes: [],
      dietaryTags: [],
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter Recipes</h2>

      {/* Cooking Time Range */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cooking Time: {minTime}-{maxTime} minutes
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min="15"
            max="60"
            value={minTime}
            onChange={e => setMinTime(Number(e.target.value))}
            className="flex-1"
          />
          <input
            type="range"
            min="15"
            max="60"
            value={maxTime}
            onChange={e => setMaxTime(Number(e.target.value))}
            className="flex-1"
          />
        </div>
      </div>

      {/* Cookware Type */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Cookware Type</label>
        <div className="space-y-2">
          {COOKWARE_OPTIONS.map(type => (
            <Checkbox
              key={type}
              label={type}
              checked={selectedCookware.includes(type)}
              onChange={() => handleCookwareToggle(type)}
            />
          ))}
        </div>
      </div>

      {/* Dietary Tags */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Tags</label>
        <div className="space-y-2">
          {DIETARY_TAG_OPTIONS.map(tag => (
            <Checkbox
              key={tag.value}
              label={tag.label}
              checked={selectedDietary.includes(tag.value)}
              onChange={() => handleDietaryToggle(tag.value)}
            />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <Button onClick={handleApplyFilters} variant="primary">
          Apply Filters
        </Button>
        <Button onClick={handleClearFilters} variant="secondary">
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
