import { useState, useEffect } from 'react';
import { Checkbox } from '../common/Checkbox';
import { Button } from '../common/Button';
import type { CookwareType, DietaryTag } from '../../../shared/types/recipe';
import { DIETARY_TAG_OPTIONS } from '../../../shared/constants/dietary-tags';

// Local state mirrors RecipeFilter structure
export interface FilterState {
  totalTimeMin: number;
  totalTimeMax: number;
  cookwareTypes: CookwareType[];
  dietaryTags: DietaryTag[];
}

interface FilterControlsProps {
  onFilterChange: (filters: FilterState) => void;
  initialFilters?: FilterState;
}

const COOKWARE_OPTIONS: CookwareType[] = ['one-pot', 'one-pan', 'oven'];

export function FilterControls({ onFilterChange, initialFilters }: FilterControlsProps) {
  const [minTime, setMinTime] = useState(initialFilters?.totalTimeMin ?? 30);
  const [maxTime, setMaxTime] = useState(initialFilters?.totalTimeMax ?? 45);
  const [selectedCookware, setSelectedCookware] = useState<CookwareType[]>(
    initialFilters?.cookwareTypes ?? []
  );
  const [selectedDietary, setSelectedDietary] = useState<DietaryTag[]>(
    initialFilters?.dietaryTags ?? []
  );

  // Sync state with initialFilters when it changes
  useEffect(() => {
    if (initialFilters) {
      setMinTime(initialFilters.totalTimeMin);
      setMaxTime(initialFilters.totalTimeMax);
      setSelectedCookware(initialFilters.cookwareTypes);
      setSelectedDietary(initialFilters.dietaryTags);
    }
  }, [initialFilters]);

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
      totalTimeMin: minTime,
      totalTimeMax: maxTime,
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
      totalTimeMin: 30,
      totalTimeMax: 45,
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
          Total Time (Prep + Cook): {minTime}-{maxTime} minutes
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min="0"
            max="60"
            value={minTime}
            onChange={e => setMinTime(Number(e.target.value))}
            className="flex-1"
          />
          <input
            type="range"
            min="0"
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
