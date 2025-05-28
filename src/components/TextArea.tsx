import React from 'react';

interface TextAreaProps {
  text: string;
  isRecording: boolean;
}

const TextArea: React.FC<TextAreaProps> = ({ text, isRecording }) => {
  return (
    <div 
      className={`relative w-full max-w-2xl h-64 md:h-80 bg-white rounded-lg shadow-md p-6 mb-10 transition-all duration-300 ${
        isRecording ? 'border-2 border-red-400' : 'border border-gray-200'
      }`}
    >
      {isRecording && (
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-sm font-medium text-red-500">录音中...</span>
        </div>
      )}
      <div className="h-full overflow-y-auto text-lg">
        {text ? (
          <p className="whitespace-pre-wrap">{text}</p>
        ) : (
          <p className="text-gray-400 italic">请点击开始按钮开始说话...</p>
        )}
      </div>
    </div>
  );
};

export default TextArea;