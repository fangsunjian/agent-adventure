import React from 'react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border border-gray-300/50 dark:border-zinc-700/50 rounded-lg shadow-xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold font-serif text-gray-800 dark:text-zinc-200 mb-4">{title}</h2>
        <p className="text-gray-600 dark:text-zinc-400 mb-6">{message}</p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 font-semibold"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 font-bold"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;