import { registerRecipeHandlers } from './recipe-handlers.js';
import { registerRecipeAIHandlers } from './recipe-ai-handlers.js';
import { registerRecipeImportHandlers } from './recipe-import-handlers.js';
import { registerConversationHandlers } from './conversation-handlers.js';
import { registerTestHelpers } from './test-helpers.js';

export function registerAllHandlers() {
  registerRecipeHandlers();
  registerRecipeAIHandlers();
  registerRecipeImportHandlers();
  registerConversationHandlers();
  registerTestHelpers(); // Only registers if E2E_TEST=true
}
