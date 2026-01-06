import { useState } from 'react';

interface FeedbackDialogProps {
  isOpen: boolean;
  recipeName: string;
  onClose: () => void;
  onSubmit: (reason?: string) => void;
}

export function FeedbackDialog({ isOpen, recipeName, onClose, onSubmit }: FeedbackDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');

  // Quick-reply reasons
  const quickReasons = [
    'Missing ingredient',
    'Not in the mood',
    'Too complex',
    'Takes too long',
    'Other',
  ];

  const handleSubmit = () => {
    const finalReason = selectedReason === 'Other' ? customReason : selectedReason;
    onSubmit(finalReason || undefined);
    handleClose();
  };

  const handleSkip = () => {
    onSubmit(undefined); // No reason provided
    handleClose();
  };

  const handleClose = () => {
    setSelectedReason(null);
    setCustomReason('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold mb-4 text-gray-900">Why not "{recipeName}"?</h3>
        <p className="text-sm text-gray-600 mb-4">
          This helps me find better suggestions for you. (Optional)
        </p>

        {/* Quick-reply buttons */}
        <div className="space-y-2 mb-4">
          {quickReasons.map(reason => (
            <button
              key={reason}
              onClick={() => setSelectedReason(reason)}
              className={`w-full px-4 py-2 rounded-lg border-2 text-left transition ${
                selectedReason === reason
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'
              }`}
            >
              {reason}
            </button>
          ))}
        </div>

        {/* Custom reason input (show if "Other" selected) */}
        {selectedReason === 'Other' && (
          <div className="mb-4">
            <label htmlFor="custom-reason" className="block text-sm font-medium text-gray-700 mb-1">
              Please specify:
            </label>
            <input
              id="custom-reason"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Don't like mushrooms"
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSkip}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedReason === 'Other' && !customReason.trim()}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
