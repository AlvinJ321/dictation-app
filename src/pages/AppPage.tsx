import React, { useState, useEffect, useRef } from 'react';
import { User, LogOut, Mic, Loader, Check, XCircle, HelpCircle, Crown, RefreshCw, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionService } from '../services/subscriptionService';
import appIcon from '../../resource/Voco-app-icon.png';

type Status = 'idle' | 'recording' | 'processing' | 'success' | 'error' | 'warning';

interface AppPageProps {
  onNavigateToWip: () => void;
}

export default function AppPage({ onNavigateToWip }: AppPageProps) {
  const { logout, user, subscription, refreshSubscription } = useAuth();
  const [status, setStatus] = useState<Status>('idle');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isRefinementOn, setIsRefinementOn] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Use user info from auth context, with a fallback
  const userName = user?.username || 'User';
  const tier = subscription?.tier;
  const isVip = tier === 'pro' || subscription?.is_vip;
  const isTrial = tier === 'trial' || subscription?.is_trial;

  const handleRestorePurchase = async () => {
    setIsRestoring(true);
    console.log('[AppPage] Starting restore purchase flow...');
    try {
      const result = await subscriptionService.restorePurchase(user?.phoneNumber);
      console.log('[AppPage] Restore result:', result);
      
      if (result.success) {
        await refreshSubscription();
        alert(`测试成功：${result.message}`);
      } else {
        console.error('[AppPage] Restore failed:', result.message);
        alert(`恢复失败: ${result.message}`);
      }
    } catch (error: any) {
      console.error('[AppPage] Restore exception:', error);
      alert(`发生错误: ${error.message || '未知错误'}`);
    } finally {
      setIsRestoring(false);
    }
  };

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
    // @ts-ignore
    window.electron.sendRefinementState(isRefinementOn);
  }, [isRefinementOn]);

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

  const handleHelpAndFeedback = () => {
    // 根据环境构建帮助与反馈页面URL
    const isProduction = import.meta.env.MODE === 'production';
    const supportUrl = isProduction 
      ? `${import.meta.env.VITE_API_BASE_URL}/?page=support`
      : `http://localhost:5173/?page=support`;
    // 使用默认浏览器打开URL
    window.electron.openExternal(supportUrl);
    // 关闭菜单
    setIsMenuOpen(false);
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
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors duration-200">
              <span className="text-gray-700">{userName}</span>
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="User Avatar" className="w-8 h-8 rounded-full" />
              ) : (
                <User className="w-6 h-6 text-gray-500" />
              )}
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.phoneNumber}</p>
                  {isVip && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                    Pro Member
                  </span>}
                </div>
                
                {!isVip && (
                  <button
                    onClick={handleRestorePurchase}
                    disabled={isRestoring}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                    {isRestoring ? '恢复中...' : '恢复购买'}
                  </button>
                )}

                <button
                  onClick={handleHelpAndFeedback}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <HelpCircle className="w-4 h-4" />
                  帮助与反馈
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center flex-grow text-center">
        <div className="flex flex-col items-center w-full max-w-sm mx-auto mt-[-3.5rem]">
          <div className="flex flex-col items-center w-full" style={{ gap: '0.5rem' }}>
            <h1 className="text-xl font-semibold text-gray-800 tracking-wide text-center animate-fade-in flex items-center justify-center gap-2">
              {isVip && <Crown className="w-6 h-6 text-yellow-500" fill="currentColor" />}
              <span>Hi {userName}, 欢迎使用Voco</span>
              {isTrial && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 shadow-sm">
                  <Clock className="w-3.5 h-3.5" />
                  试用中
                </span>
              )}
            </h1>
            <p className="text-lg text-gray-800 tracking-wide text-center font-normal animate-fade-in-delayed">需要打字时，按住 <span className="font-semibold text-blue-500">右侧Option</span> 键开始说话，松开结束；或 <span className="font-semibold text-blue-500">双击</span> 开启免提模式</p>
          </div>
        </div>
      </main>
      {/* AI Refinement Toggle */}
      <div className="fixed bottom-5 left-8 flex items-center">
        <div className="relative group">
          <span className="text-sm font-medium text-gray-700 mr-2 cursor-help hover:text-gray-900 transition-colors duration-200">AI润色</span>
          {/* Tooltip */}
          <div className="absolute bottom-full left-0 ml-2 mb-2 px-4 py-2 bg-gray-100 text-gray-800 text-xs rounded-lg border border-gray-300 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none min-w-max z-50">
            保持原句风格，更加清晰易懂
            {/* Tooltip arrow */}
            <div className="absolute top-full left-6 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-100 border-t border-t-gray-300"></div>
          </div>
        </div>
        <button
          onClick={() => setIsRefinementOn(!isRefinementOn)}
          className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer ${
            isRefinementOn ? 'bg-blue-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${
              isRefinementOn ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      {/* Question Mark Button */}
      <button
        className="fixed bottom-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-transparent border-0 shadow-none hover:bg-gray-200 hover:opacity-100 transition-all duration-200 z-20 cursor-pointer"
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
      {/* Footer */}
      <footer className="fixed bottom-5 left-1/2 transform -translate-x-1/2 text-gray-500 text-sm">
        <a 
          href="#"
          onClick={(e) => {
            e.preventDefault();
            // @ts-ignore
            window.electron.openExternal('https://vocoapp.co');
          }}
          className="hover:underline"
        >
          vocoapp.co
        </a>
      </footer>
    </div>
  );
} 
