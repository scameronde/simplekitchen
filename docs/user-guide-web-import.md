# User Guide: Web Recipe Import

## Overview

Web Recipe Import lets you quickly add recipes from your favorite cooking websites directly into SimpleKitchen. Instead of typing everything manually, simply paste a recipe URL and the app extracts all the details automatically.

### Why Use Web Import?

- **Fast**: Import recipes in seconds instead of manual entry
- **Accurate**: No typing errors for ingredients or instructions
- **Convenient**: Works with thousands of popular cooking websites
- **Flexible**: Edit imported recipes to match your preferences

## How to Import a Recipe

### Step 1: Navigate to Web Import

From the main menu, click **"Import from Web"**.

### Step 2: Find a Recipe URL

Visit your favorite cooking website and find a recipe you like. Copy the recipe's web address (URL) from your browser's address bar.

**Popular websites with web import support:**

- AllRecipes (allrecipes.com)
- Food Network (foodnetwork.com)
- New York Times Cooking (cooking.nytimes.com)
- Bon Appétit (bonappetit.com)
- Serious Eats (seriouseats.com)
- Tasty (tasty.co)
- BBC Good Food (bbcgoodfood.com)
- RecipeGirl (recipegirl.com)
- And many more!

### Step 3: Paste the URL

In the SimpleKitchen web import form, paste the recipe URL into the text field. The URL should look something like:

- `https://www.allrecipes.com/recipe/12345/chicken-parmesan/`
- `https://cooking.nytimes.com/recipes/12345-pasta-carbonara`

### Step 4: Wait for Processing

Click the **"Import Recipe"** button. SimpleKitchen will download the recipe from the website and extract all the details. This typically takes 3-10 seconds.

You'll see a loading message while the app processes the recipe.

### Step 5: Review the Imported Recipe

Once imported, the recipe appears in an editable form showing:

- **Recipe Title**: The recipe name
- **Cooking Time**: Time needed to cook the recipe
- **Prep Time** (if available): Time to prepare ingredients
- **Servings**: How many people it feeds
- **Cookware Type**: The type of cookware needed
- **Dietary Tags**: Any dietary information detected
- **Ingredients**: A complete list with quantities
- **Instructions**: Step-by-step cooking directions

Take a moment to review everything. Does the cooking time match? Are all ingredients listed correctly? This is important before saving.

### Step 6: Edit if Needed

You can modify any field that doesn't look right:

- **Adjust cooking time** if the imported value seems off
- **Change cookware type** if it's not what you have available
- **Add or remove ingredients** if something is missing or extra
- **Edit ingredient quantities** if they need adjustment for your needs
- **Modify instructions** if you prefer different wording
- **Add dietary tags** if SimpleKitchen didn't detect them

### Step 7: Save to Your Collection

Once you're happy with the recipe, click **"Save Recipe"**.

If the recipe meets SimpleKitchen's requirements, it will be added to your collection with a green confirmation message. You can now view it in your recipe list.

## Supported Websites

Web import works best with websites that include recipe information in a standard format (called Schema.org markup). Here are some of the most popular sites known to work well:

### Major Recipe Sites

- AllRecipes
- Food Network
- New York Times Cooking
- Bon Appétit
- Serious Eats
- Tasty
- BBC Good Food
- RecipeGirl
- Budget Bytes
- The Kitchn

### Blog-Based Recipes

Many food blogs also support web import, including popular cooking blogs and personal recipe websites.

### How to Check if a Site is Compatible

Most major recipe websites will work. If you're unsure, try importing! The app will let you know if the site isn't compatible.

## Troubleshooting

### "No recipe found" Error

**Cause**: The website doesn't include recipe information in a format SimpleKitchen can read, or the page isn't a recipe page.

**Solutions**:

- Double-check that the URL points to a recipe page (not a blog post or article)
- Try a different recipe from the same website
- If the website is very old or small, it may not include the required recipe format
- Try an alternative approach: Manual entry or AI generation

### "Invalid URL" Error

**Cause**: The URL format isn't correct or the website is unreachable.

**Solutions**:

- Make sure you copied the complete URL including `https://`
- Check that there are no extra spaces before or after the URL
- Verify the website is accessible (try opening the URL in your browser)
- Make sure you're using the full recipe page URL, not a shortened link

### Network Error or "Website unreachable"

**Cause**: SimpleKitchen can't connect to the website, possibly due to internet issues or the site being temporarily down.

**Solutions**:

- Check that you have an active internet connection
- Wait a few minutes and try again (the website may be temporarily unavailable)
- Try a different recipe from the same website to see if it's a widespread issue
- If other websites work, the original site may be having problems

### "Failed to extract recipe data"

**Cause**: The website loaded but SimpleKitchen couldn't find the recipe information within it.

**Solutions**:

- Make sure you're on the actual recipe page (not an article or list)
- Try refreshing the website in your browser, then copy the URL again
- Some websites require JavaScript to load content—try manual entry instead
- Contact SimpleKitchen support if a major recipe site isn't working

### "Recipe failed validation" or Constraint Error

**Cause**: The imported recipe doesn't meet SimpleKitchen's requirements (e.g., total time (prep + cook) outside 0-60 minutes, or contains ingredients with gluten/lactose).

**Solutions**:

- **Total Time**: Adjust prep and/or cooking time so total is 0-60 minutes
  - If the recipe is too slow (over 60 minutes total), try searching for a quicker version of the recipe
- **Cookware Type**: Change the cookware type to one-pot, one-pan, or oven
  - If the recipe requires other cookware, use manual entry instead
- **Ingredients with Allergens**:
  - Remove ingredients containing lactose (butter, milk, cheese, cream, yogurt)
  - Remove ingredients containing gluten (wheat flour, bread, regular pasta)
  - Replace with alternatives: dairy-free butter, almond milk, gluten-free pasta
- **Servings**: Adjust to exactly 2 people (you may need to scale quantities)

If the recipe requires too many changes, manual entry or AI generation might be easier.

## Limitations

### When Web Import May Not Work

1. **Websites without Recipe Markup**: Very small or old websites that don't use standard recipe formats can't be imported. Manual entry is your best option.

2. **Content Behind Paywalls**: Some sites (like certain magazine websites) require a subscription to view recipes. If you can't see the recipe without logging in, you may need to manually enter it.

3. **Javascript-Heavy Websites**: A few modern websites load recipe information using JavaScript in a way that web import can't read. Try refreshing the page or manual entry.

4. **Websites Blocking Automated Access**: Some sites specifically prevent automated tools from accessing their content. Use manual entry instead.

5. **Video-Only Recipes**: If a recipe only exists as a video without text, you'll need to manually enter it.

### Recipe Adjustments May Be Needed

- **Cooking Time**: Imported times may be approximate—adjust based on your experience
- **Ingredients**: Some websites list optional or decorative ingredients you might not want
- **Quantities**: May need adjustment based on your equipment or preferences
- **Instructions**: May need clarification or simplification
- **Serving Size**: SimpleKitchen requires exactly 2 servings; you may need to scale the recipe

## When to Use Each Method

### Use Web Import When:

- You found a recipe online and want to add it quickly
- The website is a major recipe site (AllRecipes, Food Network, etc.)
- The recipe fits SimpleKitchen's requirements (0-60 min, appropriate cookware)

### Use Manual Entry When:

- The website doesn't support web import
- The recipe needs significant modifications
- You're adapting a recipe from a cookbook
- You want complete control over how the recipe is entered

### Use AI Generation When:

- You need recipe ideas based on ingredients or preferences
- You want creative variations on existing recipes
- You don't have a specific recipe in mind

## Tips for Best Results

- **Try major recipe sites first**: They're more likely to work
- **Check the cooking time**: If it seems wrong, adjust before saving
- **Review the ingredient list**: Remove anything you don't want
- **Verify servings**: Make sure the recipe is adjusted to 2 people
- **Test dietary tags**: SimpleKitchen tries to detect dietary information automatically, but you can add more
- **Keep instructions clear**: Feel free to reword instructions if the imported version is confusing
- **Save frequently**: You can always re-import if you need the original

## Common Questions

### Can I import the same recipe twice?

Yes, you can import recipes multiple times. SimpleKitchen will treat them as separate recipes, so you could have different versions (original and your modified version).

### Does web import work on mobile?

Web import works the same way on mobile as desktop—paste the URL and import!

### Can I undo an import?

Once imported and saved, the recipe is in your collection. You can delete it from your recipe list if you change your mind.

### Why didn't some ingredients get detected?

SimpleKitchen's ingredient database covers common cooking ingredients. Rare or specialty items might not be recognized. You can still use them—they just won't show dietary information.

### Do I need internet to view imported recipes?

No! Once a recipe is imported and saved to your collection, it's stored locally. You only need internet during the import process.

## Still Having Issues?

If you encounter a problem not covered here:

1. **Try a different recipe** from the same website to see if it's a one-time issue
2. **Use manual entry** as a workaround
3. **Check your internet connection** to make sure it's stable
4. **Refer to the main user guide** for general SimpleKitchen help

## Next Steps

- **View Your Collection**: Click "View Recipes" to see all imported recipes
- **Browse and Filter**: Use filters to find recipes by cooking time, cookware, or dietary tags
- **Explore Other Methods**: Try manual entry or AI generation if web import doesn't work for your recipe
