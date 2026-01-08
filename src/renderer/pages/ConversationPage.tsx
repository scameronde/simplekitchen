import React, { useReducer, useEffect, useRef } from 'react';
import type { ConversationMessage } from '../../shared/types/conversation';
import type { Recipe } from '../../shared/types/recipe';
import { RecipeSuggestionCard } from '../components/Conversation/RecipeSuggestionCard';
import { FeedbackDialog } from '../components/Conversation/FeedbackDialog';

// Recipe suggestion structure based on ranking-schema.ts
interface RecipeSuggestion {
  recipeId: string;
  relevanceScore: number;
  reasoning: string;
  matchedFactors: string[];
}

// Extended message type to support suggestions
interface ConversationMessageWithSuggestions extends ConversationMessage {
  suggestions?: RecipeSuggestion[];
}

interface ConversationState {
  sessionId: string | null;
  messages: ConversationMessageWithSuggestions[];
  isLoading: boolean;
  error: string | null;
  inputValue: string;
  fetchedRecipes: Record<string, Recipe>; // Cache for fetched recipe data
  feedbackDialog: {
    isOpen: boolean;
    recipeId: string | null;
    recipeName: string | null;
  };
}

type ConversationAction =
  | { type: 'session_started'; sessionId: string }
  | { type: 'add_user_message'; content: string }
  | { type: 'add_ai_message'; content: string; timestamp: Date }
  | {
      type: 'add_ai_message_with_suggestions';
      content: string;
      timestamp: Date;
      suggestions: RecipeSuggestion[];
    }
  | { type: 'set_loading'; isLoading: boolean }
  | { type: 'set_error'; error: string }
  | { type: 'set_input'; value: string }
  | { type: 'set_fetched_recipe'; recipeId: string; recipe: Recipe }
  | { type: 'open_feedback_dialog'; recipeId: string; recipeName: string }
  | { type: 'close_feedback_dialog' };

function conversationReducer(
  state: ConversationState,
  action: ConversationAction
): ConversationState {
  switch (action.type) {
    case 'session_started':
      return { ...state, sessionId: action.sessionId };
    case 'add_user_message':
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'user', content: action.content, timestamp: new Date() },
        ],
        isLoading: true,
        inputValue: '',
      };
    case 'add_ai_message':
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'assistant', content: action.content, timestamp: action.timestamp },
        ],
        isLoading: false,
      };
    case 'add_ai_message_with_suggestions':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: 'assistant',
            content: action.content,
            timestamp: action.timestamp,
            suggestions: action.suggestions,
          },
        ],
        isLoading: false,
      };
    case 'set_fetched_recipe':
      return {
        ...state,
        fetchedRecipes: {
          ...state.fetchedRecipes,
          [action.recipeId]: action.recipe,
        },
      };
    case 'set_loading':
      return { ...state, isLoading: action.isLoading };
    case 'set_error':
      return { ...state, error: action.error, isLoading: false };
    case 'set_input':
      return { ...state, inputValue: action.value };
    case 'open_feedback_dialog':
      return {
        ...state,
        feedbackDialog: {
          isOpen: true,
          recipeId: action.recipeId,
          recipeName: action.recipeName,
        },
      };
    case 'close_feedback_dialog':
      return {
        ...state,
        feedbackDialog: {
          isOpen: false,
          recipeId: null,
          recipeName: null,
        },
      };
    default:
      return state;
  }
}

export function ConversationPage() {
  const [state, dispatch] = useReducer(conversationReducer, {
    sessionId: null,
    messages: [],
    isLoading: false,
    error: null,
    inputValue: '',
    fetchedRecipes: {},
    feedbackDialog: { isOpen: false, recipeId: null, recipeName: null },
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize session on mount
  useEffect(() => {
    async function initSession() {
      const result = await window.electron.conversationAPI.startSession();
      if (result.success && result.sessionId) {
        dispatch({ type: 'session_started', sessionId: result.sessionId });
      } else {
        dispatch({ type: 'set_error', error: result.error || 'Failed to start session' });
      }
    }
    initSession();

    // Cleanup on unmount
    return () => {
      if (state.sessionId) {
        window.electron.conversationAPI.abandonSession(state.sessionId);
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // Fetch recipe details for suggestions
  useEffect(() => {
    const fetchRecipeDetails = async () => {
      // Find all messages with suggestions
      for (const message of state.messages) {
        if (message.suggestions) {
          for (const suggestion of message.suggestions) {
            // Only fetch if not already in cache
            if (!state.fetchedRecipes[suggestion.recipeId]) {
              try {
                const result = await window.electron.recipeAPI.getById(suggestion.recipeId);
                if (result.success && result.recipe) {
                  dispatch({
                    type: 'set_fetched_recipe',
                    recipeId: suggestion.recipeId,
                    recipe: result.recipe,
                  });
                }
              } catch (error) {
                console.error(`Failed to fetch recipe ${suggestion.recipeId}:`, error);
              }
            }
          }
        }
      }
    };

    fetchRecipeDetails();
  }, [state.messages, state.fetchedRecipes]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.inputValue.trim() || !state.sessionId) return;

    const messageContent = state.inputValue;
    dispatch({ type: 'add_user_message', content: messageContent });

    const result = await window.electron.conversationAPI.sendMessage(
      state.sessionId,
      messageContent
    );
    if (result.success && result.aiMessage) {
      // Check if AI wants to show suggestions
      if (result.shouldTransition && state.sessionId) {
        // Skip adding the conversational message - it will be shown with recipes
        dispatch({ type: 'set_loading', isLoading: true });

        try {
          const suggestionsResult = await window.electron.conversationAPI.getSuggestions(
            state.sessionId
          );

          if (suggestionsResult.success && suggestionsResult.suggestions) {
            // Display AI message with recipe suggestions
            dispatch({
              type: 'add_ai_message_with_suggestions',
              content: suggestionsResult.aiMessage || 'Here are some recipes for you:',
              timestamp: new Date(),
              suggestions: suggestionsResult.suggestions,
            });
          } else {
            // Display error if suggestion fetch failed
            dispatch({
              type: 'set_error',
              error: suggestionsResult.error || 'Failed to fetch suggestions',
            });
          }
        } catch (error) {
          dispatch({
            type: 'set_error',
            error: 'Failed to fetch suggestions. Please try again.',
          });
        } finally {
          dispatch({ type: 'set_loading', isLoading: false });
        }
      } else {
        // Not transitioning yet - display the conversational message
        dispatch({
          type: 'add_ai_message',
          content: result.aiMessage,
          timestamp: result.timestamp || new Date(),
        });
      }
    } else {
      dispatch({ type: 'set_error', error: result.error || 'Failed to send message' });
    }
  };

  const handleReject = (recipeId: string, recipeName: string) => {
    dispatch({ type: 'open_feedback_dialog', recipeId, recipeName });
  };

  const handleFeedbackSubmit = async (reason?: string) => {
    if (!state.sessionId || !state.feedbackDialog.recipeId) return;

    dispatch({ type: 'close_feedback_dialog' });

    // Step 1: Record rejection
    const rejectResult = await window.electron.conversationAPI.rejectRecipe(
      state.sessionId,
      state.feedbackDialog.recipeId,
      reason
    );

    if (!rejectResult.success) {
      dispatch({ type: 'set_error', error: rejectResult.error || 'Failed to record rejection' });
      return;
    }

    // Step 2: Trigger refinement
    dispatch({ type: 'set_loading', isLoading: true });

    const refineResult = await window.electron.conversationAPI.refine(state.sessionId);

    if (refineResult.success) {
      if (refineResult.suggestions) {
        // New suggestions available
        dispatch({
          type: 'add_ai_message_with_suggestions',
          content: refineResult.aiMessage || 'Here are some other options:',
          timestamp: new Date(),
          suggestions: refineResult.suggestions,
        });
      } else {
        // Escalation message (no new suggestions)
        dispatch({
          type: 'add_ai_message',
          content: refineResult.aiMessage || 'Let me help you find a different approach.',
          timestamp: new Date(),
        });
      }
    } else {
      dispatch({ type: 'set_error', error: refineResult.error || 'Failed to refine suggestions' });
    }
  };

  const handleFeedbackCancel = () => {
    dispatch({ type: 'close_feedback_dialog' });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-lg p-6 h-[600px] flex flex-col">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">What's for dinner?</h1>

        {state.error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{state.error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto mb-4 space-y-3">
          {state.messages.map((msg, idx) => (
            <div key={idx}>
              {/* Regular message bubble */}
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] px-4 py-2 rounded-lg ${
                    msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  <p>{msg.content}</p>
                </div>
              </div>

              {/* Recipe suggestions (if present) */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-4 space-y-3">
                  {msg.suggestions.map((suggestion, suggestionIdx) => {
                    const recipe = state.fetchedRecipes[suggestion.recipeId];

                    // Show loading state while fetching recipe
                    if (!recipe) {
                      return (
                        <div
                          key={suggestionIdx}
                          className="bg-gray-100 rounded-lg p-6 animate-pulse"
                        >
                          <div className="h-6 bg-gray-300 rounded w-3/4 mb-3"></div>
                          <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
                          <div className="h-4 bg-gray-300 rounded w-full"></div>
                        </div>
                      );
                    }

                    return (
                      <RecipeSuggestionCard
                        key={suggestionIdx}
                        recipe={recipe}
                        reasoning={suggestion.reasoning}
                        matchedFactors={suggestion.matchedFactors}
                        onSelect={() => {
                          // TODO: Phase 4/5 - Implement recipe selection
                          console.log('Recipe selected:', recipe.id, recipe.title);
                        }}
                        onReject={() => {
                          handleReject(recipe.id, recipe.title);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {state.isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg">
                <p className="italic">AI is thinking...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Tell me about your day..."
            value={state.inputValue}
            onChange={e => dispatch({ type: 'set_input', value: e.target.value })}
            disabled={state.isLoading || !state.sessionId}
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
            disabled={state.isLoading || !state.inputValue.trim() || !state.sessionId}
          >
            Send
          </button>
        </form>

        {/* Feedback Dialog */}
        <FeedbackDialog
          isOpen={state.feedbackDialog.isOpen}
          recipeName={state.feedbackDialog.recipeName || ''}
          onClose={handleFeedbackCancel}
          onSubmit={handleFeedbackSubmit}
        />
      </div>
    </div>
  );
}
