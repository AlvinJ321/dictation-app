import React, { useCallback, useEffect } from 'react';
import { Mic, Square } from 'lucide-react';

interface RecordButtonProps {
  isRecording: boolean;
  onToggleRecording: () => void;
}

const RecordButton: React.FC<RecordButtonProps> = ({ isRecording, onToggleRecording }) => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Control') {
      onToggleRecording();
    }
  }, [onToggleRecording]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onToggleRecording}
        className={`flex items-center justify-center gap-2 px-6 py-3 rounded-full text-white font-medium transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {isRecording ? (
          <>
            <Square className="h-5 w-5" />
            <span>结束</span>
          </>
        ) : (
          <>
            <Mic className="h-5 w-5" />
            <span>开始</span>
          </>
        )}
      </button>
      <p className="text-sm text-gray-500 mt-2">或者按住control键开始讲话</p>
    </div>
  );
};

export default RecordButton;