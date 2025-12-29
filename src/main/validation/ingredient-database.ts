import type { DietaryProperty } from '../../shared/types/database.js';

// Ingredient dietary property mapping
export interface IngredientData {
  name: string;
  dietaryProperties: DietaryProperty[];
  aliases?: string[]; // Alternative names (e.g., "courgette" for "zucchini")
}

// Static ingredient database (curated, 100% accurate for included items)
export const INGREDIENT_DATABASE: IngredientData[] = [
  // Gluten-containing grains
  { name: 'wheat flour', dietaryProperties: ['contains-gluten'] },
  { name: 'all-purpose flour', dietaryProperties: ['contains-gluten'] },
  { name: 'bread flour', dietaryProperties: ['contains-gluten'] },
  { name: 'whole wheat flour', dietaryProperties: ['contains-gluten'] },
  { name: 'barley', dietaryProperties: ['contains-gluten'] },
  { name: 'rye', dietaryProperties: ['contains-gluten'] },
  { name: 'spelt', dietaryProperties: ['contains-gluten'] },
  { name: 'wheat pasta', dietaryProperties: ['contains-gluten'] },
  { name: 'regular pasta', dietaryProperties: ['contains-gluten'] },
  { name: 'spaghetti', dietaryProperties: ['contains-gluten'] },
  { name: 'bread', dietaryProperties: ['contains-gluten'] },
  { name: 'breadcrumbs', dietaryProperties: ['contains-gluten'] },
  { name: 'panko', dietaryProperties: ['contains-gluten'] },
  { name: 'couscous', dietaryProperties: ['contains-gluten'] },
  { name: 'bulgur', dietaryProperties: ['contains-gluten'] },
  { name: 'semolina', dietaryProperties: ['contains-gluten'] },
  { name: 'soy sauce', dietaryProperties: ['contains-gluten'] }, // Most soy sauce contains wheat

  // Gluten-free grains and flours
  { name: 'rice', dietaryProperties: ['none'] },
  { name: 'brown rice', dietaryProperties: ['none'] },
  { name: 'white rice', dietaryProperties: ['none'] },
  { name: 'rice flour', dietaryProperties: ['none'] },
  { name: 'quinoa', dietaryProperties: ['none'] },
  { name: 'gluten-free pasta', dietaryProperties: ['none'] },
  { name: 'rice noodles', dietaryProperties: ['none'] },
  { name: 'cornmeal', dietaryProperties: ['none'] },
  { name: 'polenta', dietaryProperties: ['none'] },
  { name: 'oats', dietaryProperties: ['none'] }, // Certified GF oats assumed
  { name: 'corn flour', dietaryProperties: ['none'] },
  { name: 'tapioca flour', dietaryProperties: ['none'] },
  { name: 'almond flour', dietaryProperties: ['none'] },
  { name: 'coconut flour', dietaryProperties: ['none'] },
  { name: 'buckwheat', dietaryProperties: ['none'] }, // Despite name, gluten-free

  // Dairy (lactose-containing)
  { name: 'milk', dietaryProperties: ['contains-lactose'] },
  { name: 'whole milk', dietaryProperties: ['contains-lactose'] },
  { name: 'skim milk', dietaryProperties: ['contains-lactose'] },
  { name: '2% milk', dietaryProperties: ['contains-lactose'] },
  { name: 'butter', dietaryProperties: ['contains-lactose'] },
  { name: 'cream', dietaryProperties: ['contains-lactose'] },
  { name: 'heavy cream', dietaryProperties: ['contains-lactose'] },
  { name: 'sour cream', dietaryProperties: ['contains-lactose'] },
  { name: 'cream cheese', dietaryProperties: ['contains-lactose'] },
  { name: 'yogurt', dietaryProperties: ['contains-lactose'] },
  { name: 'greek yogurt', dietaryProperties: ['contains-lactose'] },
  { name: 'cottage cheese', dietaryProperties: ['contains-lactose'] },
  { name: 'ricotta', dietaryProperties: ['contains-lactose'] },
  { name: 'mozzarella', dietaryProperties: ['contains-lactose'] },
  { name: 'cheddar', dietaryProperties: ['contains-lactose'] }, // Fresh cheddar contains lactose
  { name: 'cheese', dietaryProperties: ['contains-lactose'] }, // Generic cheese assumed to contain lactose
  { name: 'ice cream', dietaryProperties: ['contains-lactose'] },

  // Aged cheese (very low lactose, often tolerated - user can add to explicit_inclusions if desired)
  { name: 'parmesan', dietaryProperties: ['contains-lactose'] }, // Conservative: still flag it
  { name: 'aged cheddar', dietaryProperties: ['contains-lactose'] }, // Conservative

  // Dairy alternatives (lactose-free)
  { name: 'almond milk', dietaryProperties: ['none'] },
  { name: 'oat milk', dietaryProperties: ['none'] },
  { name: 'coconut milk', dietaryProperties: ['none'] },
  { name: 'soy milk', dietaryProperties: ['none'] },
  { name: 'cashew milk', dietaryProperties: ['none'] },
  { name: 'coconut cream', dietaryProperties: ['none'] },
  { name: 'vegan butter', dietaryProperties: ['none'] },
  { name: 'margarine', dietaryProperties: ['none'] }, // Most margarine is dairy-free
  { name: 'olive oil', dietaryProperties: ['none'] },
  { name: 'coconut oil', dietaryProperties: ['none'] },
  { name: 'vegetable oil', dietaryProperties: ['none'] },
  { name: 'canola oil', dietaryProperties: ['none'] },
  { name: 'avocado oil', dietaryProperties: ['none'] },

  // Meats and fish (no gluten or lactose)
  { name: 'chicken', dietaryProperties: ['contains-meat'] },
  { name: 'chicken breast', dietaryProperties: ['contains-meat'] },
  { name: 'chicken thigh', dietaryProperties: ['contains-meat'] },
  { name: 'ground chicken', dietaryProperties: ['contains-meat'] },
  { name: 'beef', dietaryProperties: ['contains-meat'] },
  { name: 'ground beef', dietaryProperties: ['contains-meat'] },
  { name: 'steak', dietaryProperties: ['contains-meat'] },
  { name: 'pork', dietaryProperties: ['contains-meat'] },
  { name: 'pork chop', dietaryProperties: ['contains-meat'] },
  { name: 'bacon', dietaryProperties: ['contains-meat'] },
  { name: 'sausage', dietaryProperties: ['contains-meat'] },
  { name: 'turkey', dietaryProperties: ['contains-meat'] },
  { name: 'ground turkey', dietaryProperties: ['contains-meat'] },
  { name: 'salmon', dietaryProperties: ['contains-fish'] },
  { name: 'tuna', dietaryProperties: ['contains-fish'] },
  { name: 'cod', dietaryProperties: ['contains-fish'] },
  { name: 'shrimp', dietaryProperties: ['contains-fish'] },
  { name: 'fish', dietaryProperties: ['contains-fish'] },

  // Eggs
  { name: 'egg', dietaryProperties: ['contains-eggs'] },
  { name: 'eggs', dietaryProperties: ['contains-eggs'] },
  { name: 'egg whites', dietaryProperties: ['contains-eggs'] },
  { name: 'egg yolks', dietaryProperties: ['contains-eggs'] },

  // Vegetables (no restrictions)
  { name: 'tomato', dietaryProperties: ['none'] },
  { name: 'tomatoes', dietaryProperties: ['none'] },
  { name: 'onion', dietaryProperties: ['none'] },
  { name: 'onions', dietaryProperties: ['none'] },
  { name: 'garlic', dietaryProperties: ['none'] },
  { name: 'bell pepper', dietaryProperties: ['none'] },
  { name: 'red bell pepper', dietaryProperties: ['none'] },
  { name: 'green bell pepper', dietaryProperties: ['none'] },
  { name: 'broccoli', dietaryProperties: ['none'] },
  { name: 'carrot', dietaryProperties: ['none'] },
  { name: 'carrots', dietaryProperties: ['none'] },
  { name: 'zucchini', dietaryProperties: ['none'], aliases: ['courgette'] },
  { name: 'spinach', dietaryProperties: ['none'] },
  { name: 'kale', dietaryProperties: ['none'] },
  { name: 'lettuce', dietaryProperties: ['none'] },
  { name: 'cucumber', dietaryProperties: ['none'] },
  { name: 'mushroom', dietaryProperties: ['none'] },
  { name: 'mushrooms', dietaryProperties: ['none'] },
  { name: 'eggplant', dietaryProperties: ['none'], aliases: ['aubergine'] },
  { name: 'potato', dietaryProperties: ['none'] },
  { name: 'potatoes', dietaryProperties: ['none'] },
  { name: 'sweet potato', dietaryProperties: ['none'] },
  { name: 'cauliflower', dietaryProperties: ['none'] },
  { name: 'asparagus', dietaryProperties: ['none'] },
  { name: 'green beans', dietaryProperties: ['none'] },

  // Legumes (no gluten or lactose)
  { name: 'chickpeas', dietaryProperties: ['none'] },
  { name: 'black beans', dietaryProperties: ['none'] },
  { name: 'kidney beans', dietaryProperties: ['none'] },
  { name: 'lentils', dietaryProperties: ['none'] },
  { name: 'red lentils', dietaryProperties: ['none'] },
  { name: 'green lentils', dietaryProperties: ['none'] },
  { name: 'tofu', dietaryProperties: ['none'] },
  { name: 'tempeh', dietaryProperties: ['none'] },

  // Herbs and spices (no restrictions)
  { name: 'basil', dietaryProperties: ['none'] },
  { name: 'oregano', dietaryProperties: ['none'] },
  { name: 'parsley', dietaryProperties: ['none'] },
  { name: 'cilantro', dietaryProperties: ['none'], aliases: ['coriander'] },
  { name: 'thyme', dietaryProperties: ['none'] },
  { name: 'rosemary', dietaryProperties: ['none'] },
  { name: 'paprika', dietaryProperties: ['none'] },
  { name: 'cumin', dietaryProperties: ['none'] },
  { name: 'chili powder', dietaryProperties: ['none'] },
  { name: 'black pepper', dietaryProperties: ['none'] },
  { name: 'salt', dietaryProperties: ['none'] },
  { name: 'ginger', dietaryProperties: ['none'] },
  { name: 'turmeric', dietaryProperties: ['none'] },

  // Condiments and sauces
  { name: 'vinegar', dietaryProperties: ['none'] },
  { name: 'balsamic vinegar', dietaryProperties: ['none'] },
  { name: 'red wine vinegar', dietaryProperties: ['none'] },
  { name: 'apple cider vinegar', dietaryProperties: ['none'] },
  { name: 'lemon juice', dietaryProperties: ['none'] },
  { name: 'lime juice', dietaryProperties: ['none'] },
  { name: 'tomato paste', dietaryProperties: ['none'] },
  { name: 'tomato sauce', dietaryProperties: ['none'] },
  { name: 'tamari', dietaryProperties: ['none'] }, // Gluten-free soy sauce
  { name: 'coconut aminos', dietaryProperties: ['none'] }, // Soy sauce alternative
  { name: 'hot sauce', dietaryProperties: ['none'] },
  { name: 'mustard', dietaryProperties: ['none'] },
  { name: 'honey', dietaryProperties: ['none'] },
  { name: 'maple syrup', dietaryProperties: ['none'] },

  // Nuts and seeds (no gluten or lactose)
  { name: 'almonds', dietaryProperties: ['none'] },
  { name: 'cashews', dietaryProperties: ['none'] },
  { name: 'walnuts', dietaryProperties: ['none'] },
  { name: 'peanuts', dietaryProperties: ['none'] },
  { name: 'peanut butter', dietaryProperties: ['none'] },
  { name: 'sunflower seeds', dietaryProperties: ['none'] },
  { name: 'sesame seeds', dietaryProperties: ['none'] },
  { name: 'chia seeds', dietaryProperties: ['none'] },
  { name: 'flaxseed', dietaryProperties: ['none'] },
];

// Lookup ingredient by name (case-insensitive, checks aliases)
export function lookupIngredient(name: string): IngredientData | null {
  const normalized = name.toLowerCase().trim();

  return (
    INGREDIENT_DATABASE.find(item => {
      if (item.name.toLowerCase() === normalized) return true;
      if (item.aliases?.some(alias => alias.toLowerCase() === normalized)) return true;
      return false;
    }) || null
  );
}

// Get dietary properties for ingredient name (returns 'unknown' if not in database)
export function getIngredientProperties(name: string): DietaryProperty[] | 'unknown' {
  const item = lookupIngredient(name);
  return item ? item.dietaryProperties : 'unknown';
}

// Check if ingredient is known to be safe (no restrictions)
export function isKnownSafe(name: string): boolean {
  const properties = getIngredientProperties(name);
  if (properties === 'unknown') return false;
  return properties.length === 0 || (properties.length === 1 && properties[0] === 'none');
}

// Get count of known ingredients
export function getKnownIngredientCount(): number {
  return INGREDIENT_DATABASE.length;
}
