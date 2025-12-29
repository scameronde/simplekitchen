import { registerRecipeHandlers } from './recipe-handlers.js';
import { registerRecipeAIHandlers } from './recipe-ai-handlers.js';

export function registerAllHandlers() {
  registerRecipeHandlers();
  registerRecipeAIHandlers();
}
