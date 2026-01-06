import { registerRecipeHandlers } from './recipe-handlers.js';
import { registerRecipeAIHandlers } from './recipe-ai-handlers.js';
import { registerRecipeImportHandlers } from './recipe-import-handlers.js';
import { registerConversationHandlers } from './conversation-handlers.js';

export function registerAllHandlers() {
  registerRecipeHandlers();
  registerRecipeAIHandlers();
  registerRecipeImportHandlers();
  registerConversationHandlers();
}
