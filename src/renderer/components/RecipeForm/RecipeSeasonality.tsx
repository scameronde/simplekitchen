import { Checkbox } from '../common/Checkbox';

const SEASONS = [
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
  { value: 'winter', label: 'Winter' },
  { value: 'any', label: 'Any Season' },
];

interface RecipeSeasonalityProps {
  selectedSeasons: string[];
  onChange: (seasons: string[]) => void;
}

export function RecipeSeasonality({ selectedSeasons, onChange }: RecipeSeasonalityProps) {
  const handleToggle = (season: string) => {
    const updated = selectedSeasons.includes(season)
      ? selectedSeasons.filter(s => s !== season)
      : [...selectedSeasons, season];
    onChange(updated);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">Seasonality</label>
      <div className="flex flex-wrap gap-4">
        {SEASONS.map(season => (
          <Checkbox
            key={season.value}
            label={season.label}
            checked={selectedSeasons.includes(season.value)}
            onChange={() => handleToggle(season.value)}
          />
        ))}
      </div>
    </div>
  );
}
