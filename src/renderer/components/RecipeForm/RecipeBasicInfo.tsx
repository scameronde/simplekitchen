import { Input } from '../common/Input';
import { Select } from '../common/Select';

interface RecipeBasicInfoProps {
  formData: {
    title: string;
    cookingTimeMinutes: string;
    prepTimeMinutes: string;
    cookwareType: string;
  };
  onChange: (field: string, value: string) => void;
}

export function RecipeBasicInfo({ formData, onChange }: RecipeBasicInfoProps) {
  return (
    <div className="space-y-4">
      <Input
        label="Recipe Title"
        value={formData.title}
        onChange={e => onChange('title', e.target.value)}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Cooking Time (minutes)"
          type="number"
          value={formData.cookingTimeMinutes}
          onChange={e => onChange('cookingTimeMinutes', e.target.value)}
          required
          placeholder="30-45"
        />
        <Input
          label="Prep Time (minutes)"
          type="number"
          value={formData.prepTimeMinutes}
          onChange={e => onChange('prepTimeMinutes', e.target.value)}
          placeholder="Optional"
        />
      </div>

      <Select
        label="Cookware Type"
        value={formData.cookwareType}
        onChange={e => onChange('cookwareType', e.target.value)}
        options={[
          { value: 'one-pot', label: 'One Pot' },
          { value: 'one-pan', label: 'One Pan' },
          { value: 'oven', label: 'Oven' },
        ]}
        required
      />

      <div className="text-sm text-gray-600">
        <strong>Servings:</strong> 2 people (fixed)
      </div>
    </div>
  );
}
