import React, { useReducer, useEffect, useRef } from 'react';
import type { ConversationMessage } from '../../shared/types/conversation';

interface ConversationState {
  sessionId: string | null;
  messages: ConversationMessage[];
  isLoading: boolean;
  error: string | null;
  inputValue: string;
}

type ConversationAction =
  | { type: 'session_started'; sessionId: string }
  | { type: 'add_user_message'; content: string }
  | { type: 'add_ai_message'; content: string; timestamp: Date }
  | { type: 'set_loading'; isLoading: boolean }
  | { type: 'set_error'; error: string }
  | { type: 'set_input'; value: string };

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
    case 'set_loading':
      return { ...state, isLoading: action.isLoading };
    case 'set_error':
      return { ...state, error: action.error, isLoading: false };
    case 'set_input':
      return { ...state, inputValue: action.value };
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
      dispatch({
        type: 'add_ai_message',
        content: result.aiMessage,
        timestamp: result.timestamp || new Date(),
      });
    } else {
      dispatch({ type: 'set_error', error: result.error || 'Failed to send message' });
    }
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
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-lg ${
                  msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900'
                }`}
              >
                <p>{msg.content}</p>
              </div>
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
      </div>
    </div>
  );
}
