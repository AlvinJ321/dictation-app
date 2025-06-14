import React from 'react';

export default function WIPPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-screen font-sans p-8 items-center justify-center text-center" style={{ backgroundColor: '#F5F6FA' }}>
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">
        This is currently in development.
      </h1>
      <p className="text-gray-500 mb-8">
        Please come back later.
      </p>
      <button
        onClick={onBack}
        className="px-6 py-3 border border-gray-300 rounded-full hover:bg-gray-100 transition-colors text-lg"
      >
        Back to App
      </button>
    </div>
  );
} 