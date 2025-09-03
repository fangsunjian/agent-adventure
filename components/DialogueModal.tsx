import React from 'react';
import type { DialogueModalProps } from '../types';
import { CloseIcon } from './icons';

const DialogueModal: React.FC<DialogueModalProps> = ({
  isOpen,
  messages,
  currentIndex,
  speaker,
  avatar,
  onNext,
  onSkip,
  onComplete
}) => {
  if (!isOpen || messages.length === 0) return null;

  // Ensure messages is an array and currentIndex is valid
  const safeMessages = Array.isArray(messages) ? messages.filter(msg => typeof msg === 'string' && msg.trim()) : [];
  const safeCurrentIndex = Math.max(0, Math.min(currentIndex, safeMessages.length - 1));
  
  const currentMessage = safeMessages[safeCurrentIndex] || '...';
  const isComplete = safeCurrentIndex >= safeMessages.length - 1;

  const handleScreenClick = () => {
    if (isComplete) {
      onComplete();
    } else {
      onNext();
    }
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSkip();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
      onClick={handleScreenClick}
    >
      {/* Skip Button */}
      <button
        onClick={handleSkip}
        className="absolute top-4 right-4 p-3 text-white/80 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-all duration-200 z-10"
        style={{ 
          paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
          paddingRight: 'calc(0.75rem + env(safe-area-inset-right))'
        }}
        aria-label="跳过对话"
      >
        <CloseIcon className="w-6 h-6" />
      </button>

      {/* Dialogue Content */}
      <div className="flex flex-col items-center justify-center max-w-4xl mx-4">
        {/* Speaker Avatar & Name */}
        <div className="flex items-center gap-4 mb-8">
          {avatar && (
            <div className="w-16 h-16 rounded-full bg-gray-700 border-2 border-gray-500 overflow-hidden">
              <img 
                src={avatar} 
                alt={speaker}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <h2 className="text-2xl font-bold text-white font-serif">
            {speaker}
          </h2>
        </div>

        {/* Message Box */}
        <div className="bg-black/60 backdrop-blur-sm border border-gray-600 rounded-2xl p-8 min-w-0 max-w-full">
          <p className="text-white text-xl leading-relaxed font-serif text-center whitespace-pre-wrap break-words">
            {currentMessage}
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mt-8">
          {safeMessages.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                index <= safeCurrentIndex 
                  ? 'bg-white' 
                  : 'bg-white/30'
              }`}
            />
          ))}
        </div>

        {/* Continue Indicator */}
        <div className="mt-6 text-white/60 text-sm font-medium animate-pulse">
          {isComplete ? '点击屏幕结束对话' : '点击屏幕继续'}
        </div>
      </div>
    </div>
  );
};

export default DialogueModal;