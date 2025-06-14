import React, { useState, useEffect } from 'react';
import { User, LogOut, Mic, Loader, Check, Edit, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import appIcon from '../../resource/app-icon.jpg';

type Status = 'idle' | 'recording' | 'processing' | 'success' | 'error' | 'warning';

interface AppPageProps {
  onNavigateToWip: () => void;
}

export default function AppPage({ onNavigateToWip }: AppPageProps) {
  const { logout, user } = useAuth();
  const [status, setStatus] = useState<Status>('idle');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  // Use user info from auth context, with a fallback
  const userName = user?.username || 'User';

  useEffect(() => {
    const handleStatusChange = (newStatus: Status) => {
      console.log(`[AppPage] Received status: ${newStatus}`);
      setStatus(newStatus);
      // If success or error, revert to idle after a short delay
      if (newStatus === 'success' || newStatus === 'error') {
        setTimeout(() => setStatus('idle'), 1500);
      }
    };

    const handleTranscriptionResult = (result: { success: boolean, text?: string, error?: string }) => {
      if (result.success) {
        handleStatusChange('success');
      } else {
        console.error('Transcription failed:', result.error);
        setLastError(result.error || 'Unknown error');
        handleStatusChange('error');
      }
    };

    // Listen for status updates from the main process
    window.electron.onRecordingStatus(handleStatusChange);
    window.electron.onTranscriptionResult(handleTranscriptionResult);

    return () => {
      // Cleanup listeners
      window.electron.removeRecordingStatusListener(handleStatusChange);
      window.electron.removeTranscriptionResultListener(handleTranscriptionResult);
    };
  }, []);

  const handleLogout = () => {
    logout();
  };

  const handleProfileUpdate = () => {
    onNavigateToWip();
  };

  const renderStatusIcon = () => {
    switch (status) {
      case 'recording':
        return <Mic className="w-10 h-10 text-red-500 animate-pulse" />;
      case 'warning':
        return <Mic className="w-10 h-10 text-yellow-500 animate-pulse" />;
      case 'processing':
        return <Loader className="w-10 h-10 text-blue-500 animate-spin" />;
      case 'success':
        return <Check className="w-10 h-10 text-green-500" />;
      case 'error':
        return <XCircle className="w-10 h-10 text-red-500" />;
      case 'idle':
      default:
        return <p className="text-gray-500">按住 <span className="font-semibold text-blue-500">Right Option</span> 键开始听写</p>;
    }
  };

  const renderStatusMessage = () => {
    switch (status) {
      case 'recording':
        return <p className="text-gray-500 mt-2">正在录音...</p>;
      case 'warning':
        return <p className="text-yellow-500 mt-2">录音即将达到上限...</p>;
      case 'processing':
        return <p className="text-gray-500 mt-2">正在处理...</p>;
      case 'success':
        return <p className="text-green-500 mt-2">转录成功！</p>;
      case 'error':
        return <p className="text-red-500 mt-2">错误: {lastError}</p>;
      default:
        return null; // Don't show any message for idle
    }
  }

  return (
    <div className="flex flex-col h-screen font-sans p-8" style={{ backgroundColor: '#F5F6FA' }}>
      {/* Header */}
      <header className="flex justify-between items-center w-full">
        {/* Logo */}
        <div className="w-12 h-12 flex items-center justify-center">
          <img src={appIcon} alt="App Icon" className="w-12 h-12 rounded-full" />
        </div>
        {/* User Menu */}
        <div className="relative">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 cursor-pointer">
              <span className="text-gray-700">{userName}</span>
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="User Avatar" className="w-8 h-8 rounded-full" />
              ) : (
                <User className="w-6 h-6 text-gray-500" />
              )}
            </button>
            {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                    <button
                        onClick={handleProfileUpdate}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                        <Edit className="w-4 h-4 mr-2" />
                        修改资料
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        退出登录
                    </button>
                </div>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center flex-grow text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-800">
            <span role="img" aria-label="wave">👋</span> 欢迎使用 Voco (Alpha)
          </h1>
          <div className="h-10 mt-4 flex flex-col items-center justify-center"> {/* Container to prevent layout shift */}
            {renderStatusIcon()}
            {renderStatusMessage()}
          </div>
          <button 
            className="mt-8 px-6 py-3 border border-gray-300 rounded-full hover:bg-gray-100 transition-colors text-lg"
            onClick={onNavigateToWip}
            >
            探索使用场景
          </button>
        </div>
      </main>
    </div>
  );
} 