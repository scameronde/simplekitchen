# User Guide: AI Recipe Generation

## Setup

### 1. Obtain OpenAI API Key

1. Visit https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-proj-...`)

### 2. Configure SimpleKitchen

1. Copy `.env.example` to `.env` in the project root
2. Open `.env` in a text editor
3. Replace `YOUR_KEY_HERE` with your OpenAI API key
4. Save the file
5. Restart SimpleKitchen

**IMPORTANT**: Never share your API key or commit the `.env` file to version control.

## Generating Recipes

### Step 1: Navigate to AI Generation

Click "Generate with AI" in the main menu.

### Step 2: Enter Criteria

Fill in your preferences:

- **Cuisine** (optional): e.g., "Italian", "Thai", "Mexican"
- **Main Ingredient** (optional): e.g., "chicken", "tofu"
- **Dietary Tags** (required): Select all that apply
- **Seasonality** (optional): Choose preferred seasons
- **Cookware Type** (optional): Select preferred cookware or leave as "Any"
- **Flavor Profile** (optional): e.g., "spicy", "comfort food"
- **Skill Level** (optional): Beginner, Intermediate, or Advanced

### Step 3: Generate

Click "Generate Recipe". This typically takes 5-15 seconds.

### Step 4: Review & Edit

The generated recipe appears in an editable form. You can:

- Edit any field (title, ingredients, instructions, etc.)
- Add or remove ingredients
- Adjust quantities

### Step 5: Save or Regenerate

- Click "Save to Collection" to add the recipe
- Click "Regenerate" to try again with the same or different criteria

## Cost Information

AI recipe generation costs approximately **$0.001 per recipe** (less than 1/10th of a cent) using OpenAI's gpt-4o-mini model.

**Monthly estimates**:

- 100 recipes: ~$0.08
- 1,000 recipes: ~$0.82

You can monitor your usage at: https://platform.openai.com/account/usage

## Common Errors

### "Invalid OpenAI API key"

- **Cause**: API key not configured or incorrect
- **Solution**: Check `.env` file, verify key is correct, restart app

### "Rate limit exceeded"

- **Cause**: Too many requests in a short time
- **Solution**: Wait the indicated time (usually 60 seconds) and try again

### "Network error"

- **Cause**: No internet connection or OpenAI API is down
- **Solution**: Check internet connection, try again later

### "Generated recipe failed validation"

- **Cause**: AI generated a recipe that violates constraints (rare)
- **Solution**: Click "Regenerate" to try again

## Tips

- Be specific with criteria for better results (e.g., "spicy Thai noodles" vs "Thai food")
- If you don't like the first result, try "Regenerate" - AI output varies
- You can always edit the generated recipe before saving
- Leave criteria fields blank for more creative freedom

## Privacy & Security

- Your API key is stored locally and never transmitted to SimpleKitchen servers
- Recipe generation requests go directly to OpenAI
- SimpleKitchen does not log or store your prompts or generated recipes beyond your local database
