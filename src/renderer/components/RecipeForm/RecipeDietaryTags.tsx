import { Checkbox } from '../common/Checkbox';
import { DIETARY_TAG_OPTIONS } from '../../../shared/constants/dietary-tags';

interface RecipeDietaryTagsProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export function RecipeDietaryTags({ selectedTags, onChange }: RecipeDietaryTagsProps) {
  const handleToggle = (tag: string) => {
    const updated = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    onChange(updated);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Tags</label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {DIETARY_TAG_OPTIONS.map(tag => (
          <Checkbox
            key={tag.value}
            label={tag.label}
            checked={selectedTags.includes(tag.value)}
            onChange={() => handleToggle(tag.value)}
          />
        ))}
      </div>
    </div>
  );
}
