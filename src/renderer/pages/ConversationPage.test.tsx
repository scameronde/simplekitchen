import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConversationPage } from './ConversationPage';
import type { Recipe } from '../../shared/types/recipe';
import type { RecipeSuggestion } from '../../shared/types/conversation';

describe('ConversationPage - Transition Detection', () => {
  // Mock recipe data
  const mockRecipe: Recipe = {
    id: 'recipe-123',
    title: 'Quick Vegetable Stir-Fry',
    cookingTimeMinutes: 20,
    prepTimeMinutes: 10,
    totalTimeMinutes: 30,
    cookwareType: 'one-pan',
    servings: 2,
    dietaryTags: ['vegetarian', 'vegan'],
    seasonality: ['spring', 'summer'],
    sourceType: 'ai-generated',
    sourceReference: null,
    instructions: 'Stir-fry vegetables until tender.',
    ingredients: [
      {
        id: 'ing-1',
        recipeId: 'recipe-123',
        name: 'bell peppers',
        quantity: 2,
        unit: 'whole',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 0,
      },
      {
        id: 'ing-2',
        recipeId: 'recipe-123',
        name: 'broccoli',
        quantity: 200,
        unit: 'g',
        dietaryProperties: ['none'],
        optional: false,
        orderIndex: 1,
      },
    ],
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
  };

  const mockSuggestion: RecipeSuggestion = {
    recipeId: 'recipe-123',
    relevanceScore: 0.95,
    reasoning: 'Perfect for your low energy level and time constraints',
    matchedFactors: ['quick', 'low-energy', 'one-pan'],
  };

  // Mock functions
  let mockStartSession: ReturnType<typeof vi.fn>;
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let mockGetSuggestions: ReturnType<typeof vi.fn>;
  let mockGetById: ReturnType<typeof vi.fn>;
  let mockRejectRecipe: ReturnType<typeof vi.fn>;
  let mockRefine: ReturnType<typeof vi.fn>;
  let mockAbandonSession: ReturnType<typeof vi.fn>;
  let mockCreate: ReturnType<typeof vi.fn>;
  let mockGetAll: ReturnType<typeof vi.fn>;
  let mockFilter: ReturnType<typeof vi.fn>;
  let mockGenerateRecipe: ReturnType<typeof vi.fn>;
  let mockImportRecipe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock scrollIntoView (not available in test environment)
    HTMLElement.prototype.scrollIntoView = vi.fn();

    // Initialize mock functions
    mockStartSession = vi.fn();
    mockSendMessage = vi.fn();
    mockGetSuggestions = vi.fn();
    mockGetById = vi.fn();
    mockRejectRecipe = vi.fn();
    mockRefine = vi.fn();
    mockAbandonSession = vi.fn();
    mockCreate = vi.fn();
    mockGetAll = vi.fn();
    mockFilter = vi.fn();
    mockGenerateRecipe = vi.fn();
    mockImportRecipe = vi.fn();

    // Setup window.electron mock
    window.electron = {
      platform: 'test',
      versions: { node: '', chrome: '', electron: '' },
      recipeAPI: {
        create: mockCreate,
        getAll: mockGetAll,
        getById: mockGetById,
        filter: mockFilter,
        generateRecipe: mockGenerateRecipe,
        importRecipe: mockImportRecipe,
      },
      conversationAPI: {
        startSession: mockStartSession,
        sendMessage: mockSendMessage,
        getSuggestions: mockGetSuggestions,
        rejectRecipe: mockRejectRecipe,
        refine: mockRefine,
        abandonSession: mockAbandonSession,
      },
    };
  });

  it('should fetch and display suggestions when AI signals transition', async () => {
    const user = userEvent.setup();

    // Mock session start
    mockStartSession.mockResolvedValue({
      success: true,
      sessionId: 'test-session-123',
    });

    // Mock sendMessage with shouldTransition: true
    mockSendMessage.mockResolvedValue({
      success: true,
      aiMessage: "I understand you're tired. Let me suggest some quick recipes.",
      timestamp: new Date(),
      shouldTransition: true,
    });

    // Mock getSuggestions
    mockGetSuggestions.mockResolvedValue({
      success: true,
      suggestions: [mockSuggestion],
      aiMessage: 'Here are some recipes for you:',
    });

    // Mock getById for recipe details
    mockGetById.mockResolvedValue({
      success: true,
      recipe: mockRecipe,
    });

    render(<ConversationPage />);

    // Wait for session to start
    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalled();
    });

    // Type a message
    const input = screen.getByPlaceholderText('Tell me about your day...');
    await user.type(input, "I'm tired and don't have much time");

    // Submit message
    const sendButton = screen.getByText('Send');
    await user.click(sendButton);

    // Wait for sendMessage to be called
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-session-123',
        "I'm tired and don't have much time"
      );
    });

    // Verify getSuggestions was called
    await waitFor(() => {
      expect(mockGetSuggestions).toHaveBeenCalledWith('test-session-123');
    });

    // Wait for AI message to appear
    await waitFor(() => {
      expect(
        screen.getByText("I understand you're tired. Let me suggest some quick recipes.")
      ).toBeInTheDocument();
    });

    // Wait for suggestions message to appear
    await waitFor(() => {
      expect(screen.getByText('Here are some recipes for you:')).toBeInTheDocument();
    });

    // Wait for recipe card to be fetched and displayed
    await waitFor(() => {
      expect(mockGetById).toHaveBeenCalledWith('recipe-123');
    });

    // Verify recipe title is displayed
    await waitFor(() => {
      expect(screen.getByText('Quick Vegetable Stir-Fry')).toBeInTheDocument();
    });
  });

  it('should NOT fetch suggestions when AI does not signal transition', async () => {
    const user = userEvent.setup();

    // Mock session start
    mockStartSession.mockResolvedValue({
      success: true,
      sessionId: 'test-session-456',
    });

    // Mock sendMessage WITHOUT shouldTransition (or shouldTransition: false)
    mockSendMessage.mockResolvedValue({
      success: true,
      aiMessage: 'Tell me more about your preferences.',
      timestamp: new Date(),
      shouldTransition: false,
    });

    render(<ConversationPage />);

    // Wait for session to start
    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalled();
    });

    // Type a message
    const input = screen.getByPlaceholderText('Tell me about your day...');
    await user.type(input, 'I like pasta');

    // Submit message
    const sendButton = screen.getByText('Send');
    await user.click(sendButton);

    // Wait for sendMessage to be called
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('test-session-456', 'I like pasta');
    });

    // Wait for AI response to appear
    await waitFor(() => {
      expect(screen.getByText('Tell me more about your preferences.')).toBeInTheDocument();
    });

    // Verify getSuggestions was NOT called
    expect(mockGetSuggestions).not.toHaveBeenCalled();

    // Verify no recipe cards are displayed
    expect(screen.queryByText('Quick Vegetable Stir-Fry')).not.toBeInTheDocument();
  });

  it('should display error if getSuggestions fails', async () => {
    const user = userEvent.setup();

    // Mock session start
    mockStartSession.mockResolvedValue({
      success: true,
      sessionId: 'test-session-789',
    });

    // Mock sendMessage with shouldTransition: true
    mockSendMessage.mockResolvedValue({
      success: true,
      aiMessage: 'Let me find some recipes for you.',
      timestamp: new Date(),
      shouldTransition: true,
    });

    // Mock getSuggestions to fail
    mockGetSuggestions.mockResolvedValue({
      success: false,
      error: 'No recipes match your criteria',
    });

    render(<ConversationPage />);

    // Wait for session to start
    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalled();
    });

    // Type a message
    const input = screen.getByPlaceholderText('Tell me about your day...');
    await user.type(input, 'I want something quick');

    // Submit message
    const sendButton = screen.getByText('Send');
    await user.click(sendButton);

    // Wait for sendMessage to be called
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('test-session-789', 'I want something quick');
    });

    // Wait for AI response to appear
    await waitFor(() => {
      expect(screen.getByText('Let me find some recipes for you.')).toBeInTheDocument();
    });

    // Verify getSuggestions was called
    await waitFor(() => {
      expect(mockGetSuggestions).toHaveBeenCalledWith('test-session-789');
    });

    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByText('No recipes match your criteria')).toBeInTheDocument();
    });

    // Verify no recipe cards are displayed
    expect(screen.queryByText('Quick Vegetable Stir-Fry')).not.toBeInTheDocument();
  });
});
