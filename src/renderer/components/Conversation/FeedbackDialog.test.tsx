import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackDialog } from './FeedbackDialog';

describe('FeedbackDialog', () => {
  it('should render when open', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();

    render(
      <FeedbackDialog
        isOpen={true}
        recipeName="Chicken Pasta"
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText(/Why not "Chicken Pasta"/)).toBeInTheDocument();
    expect(screen.getByText('Missing ingredient')).toBeInTheDocument();
    expect(screen.getByText('Not in the mood')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();

    render(
      <FeedbackDialog
        isOpen={false}
        recipeName="Chicken Pasta"
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.queryByText(/Why not/)).not.toBeInTheDocument();
  });

  it('should call onSubmit with reason when quick-reply clicked', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn();

    render(
      <FeedbackDialog
        isOpen={true}
        recipeName="Test Recipe"
        onClose={vi.fn()}
        onSubmit={mockOnSubmit}
      />
    );

    await user.click(screen.getByText('Missing ingredient'));
    await user.click(screen.getByText('Submit'));

    expect(mockOnSubmit).toHaveBeenCalledWith('Missing ingredient');
  });

  it('should call onSubmit with undefined when Skip clicked', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn();

    render(
      <FeedbackDialog
        isOpen={true}
        recipeName="Test Recipe"
        onClose={vi.fn()}
        onSubmit={mockOnSubmit}
      />
    );

    await user.click(screen.getByText('Skip'));

    expect(mockOnSubmit).toHaveBeenCalledWith(undefined);
  });

  it('should show custom input when Other selected', async () => {
    const user = userEvent.setup();

    render(
      <FeedbackDialog isOpen={true} recipeName="Test Recipe" onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    await user.click(screen.getByText('Other'));

    expect(screen.getByPlaceholderText(/Don't like mushrooms/)).toBeInTheDocument();
  });

  it('should submit custom reason when Other selected and text entered', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn();

    render(
      <FeedbackDialog
        isOpen={true}
        recipeName="Test Recipe"
        onClose={vi.fn()}
        onSubmit={mockOnSubmit}
      />
    );

    await user.click(screen.getByText('Other'));
    await user.type(screen.getByPlaceholderText(/Don't like/), 'Allergic to peanuts');
    await user.click(screen.getByText('Submit'));

    expect(mockOnSubmit).toHaveBeenCalledWith('Allergic to peanuts');
  });

  it('should disable submit when Other selected but no text entered', async () => {
    const user = userEvent.setup();

    render(
      <FeedbackDialog isOpen={true} recipeName="Test Recipe" onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    await user.click(screen.getByText('Other'));

    const submitButton = screen.getByText('Submit');
    expect(submitButton).toBeDisabled();
  });
});
