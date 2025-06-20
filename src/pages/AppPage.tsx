import React, { useState, useEffect, useRef } from 'react';
import { User, LogOut, Mic, Loader, Check, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import appIcon from '../../resource/Voco-app-icon.png';

type Status = 'idle' | 'recording' | 'processing' | 'success' | 'error' | 'warning';

interface AppPageProps {
  onNavigateToWip: () => void;
}

export default function AppPage({ onNavigateToWip }: AppPageProps) {
  const { logout, user } = useAuth();
  const [status, setStatus] = useState<Status>('idle');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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

    const handleAuthFailed = (data: { reason: string }) => {
      console.log('[AppPage] Authentication failed:', data.reason);
      if (data.reason === 'token_expired') {
        setLastError('Your session has expired. Please log in again.');
        handleStatusChange('error');
        // Optionally, you could automatically redirect to login here
        // logout();
      }
    };

    // Listen for status updates from the main process
    window.electron.onRecordingStatus(handleStatusChange);
    window.electron.onTranscriptionResult(handleTranscriptionResult);
    window.electron.onAuthFailed(handleAuthFailed);

    return () => {
      // Cleanup listeners
      window.electron.removeRecordingStatusListener(handleStatusChange);
      window.electron.removeTranscriptionResultListener(handleTranscriptionResult);
      window.electron.removeAuthFailedListener(handleAuthFailed);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleLogout = () => {
    logout();
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
    <div className="flex flex-col h-screen font-sans p-8 relative" style={{ backgroundColor: '#FAFAF7' }}>
      {/* Header */}
      <header className="flex justify-between items-center w-full">
        {/* Logo */}
        <div className="w-12 h-12 flex items-center justify-center">
          <img src={appIcon} alt="App Icon" className="w-12 h-12 rounded-full" />
        </div>
        {/* User Menu */}
        <div className="relative" ref={menuRef}>
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
        <div className="flex flex-col items-center w-full max-w-md mx-auto">
          <div className="flex flex-col items-center w-full" style={{ gap: '0.8rem' }}>
            <h1 className="text-2xl font-semibold text-gray-800 tracking-wide">
              <span role="img" aria-label="crown">👑</span> 欢迎使用Voco（内测版）
            </h1>
            <p className="text-xl text-gray-800 tracking-wide">选择任何输入框，按住 <span className="font-semibold text-blue-500">Right Option</span> 键开始转写</p>
            <p className="text-xl tracking-wide" style={{ color: '#f59e1a' }}>（每次可录最长60秒的语音）</p>
          </div>
          <button 
            className="mt-10 px-8 py-3 border border-gray-300 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-xl font-semibold text-gray-600"
            onClick={onNavigateToWip}
            >
            探索使用场景
          </button>
        </div>
      </main>
      {/* Question Mark Button */}
      <button
        className="fixed bottom-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-transparent border-0 shadow-none hover:bg-gray-100 z-20 cursor-pointer"
        style={{ fontSize: 0, opacity: 0.7 }}
        aria-label="帮助"
        onClick={() => setIsGuideOpen(true)}
      >
        {/* Only a blue circle with question mark */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="9" stroke="#2563eb" strokeWidth="1.5" fill="none" />
          <text x="10" y="15" textAnchor="middle" fontSize="12" fill="#2563eb" fontFamily="Arial, sans-serif">?</text>
        </svg>
      </button>
      {/* Guide Modal */}
      {isGuideOpen && (
        <div className="absolute left-0 top-0 w-full h-full flex items-center justify-center z-30 pointer-events-none">
          <div className="relative bg-gray-100 rounded-2xl shadow-lg p-6 max-w-xl w-full flex flex-col items-center animate-fade-in pointer-events-auto" style={{ minHeight: '140px' }}>
            <button
              className="absolute top-2 right-4 text-gray-400 hover:text-gray-600 text-lg font-bold"
              aria-label="关闭"
              onClick={() => setIsGuideOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ×
            </button>
            <div className="whitespace-pre-line text-blue-900 text-base font-mono leading-relaxed text-left w-full max-w-md mx-auto" style={{ wordBreak: 'break-word' }}>
              {[
                <>如果按住 right option 无法转写，<span className="font-bold">请重新启动应用</span>。</>,
                '重启后还是无法转写，请按照以下步骤检查权限设置：',
                <><span className="font-bold">开启麦克风权限</span>：</>,
                '打开「系统设置」>「隐私与安全性」>「麦克风」',
                '确保已勾选 Voco 应用',
                <><span className="font-bold">开启辅助功能权限</span>：</>,
                '打开「系统设置」>「隐私与安全性」>「辅助功能」',
                '确保已勾选 Voco 应用',
                <>更改权限后，<span className="font-bold">重新启动应用</span></>
              ].map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 