import React from 'react';
import { Mic } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-center py-4">
      <div className="flex items-center gap-2">
        <Mic className="h-6 w-6 text-blue-500" />
        <h1 className="text-2xl font-bold text-blue-600">语音转文字</h1>
      </div>
    </header>
  );
};

export default Header;