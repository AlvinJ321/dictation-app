import React, { useState } from 'react';
import { Check, Crown, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionService } from '../services/subscriptionService';
import appIcon from '../../resource/Voco-app-icon.png';

export default function PaywallPage() {
  const { user, refreshSubscription, logout } = useAuth();
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const phone = user?.phoneNumber;

  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    try {
      const result = await subscriptionService.startTrial();
      if (!result.success) {
        alert(result.error || '开始试用失败');
        return;
      }
      await refreshSubscription();
    } catch (error: any) {
      alert(error?.message || '开始试用失败');
    } finally {
      setIsStartingTrial(false);
    }
  };

  const handlePurchase = async () => {
    if (!phone) {
      alert('未获取到手机号，请重新登录后重试');
      return;
    }
    setIsPurchasing(true);
    try {
      const result = await subscriptionService.purchaseProMock(phone);
      if (!result.success) {
        alert(result.error || '购买失败');
        return;
      }
      await refreshSubscription();
    } catch (error: any) {
      alert(error?.message || '购买失败');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const result = await subscriptionService.restorePurchase(phone);
      if (!result.success) {
        alert(result.message || '恢复购买失败');
        return;
      }
      await refreshSubscription();
    } catch (error: any) {
      alert(error?.message || '恢复购买失败');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="flex flex-col h-screen font-sans p-8" style={{ backgroundColor: '#FAFAF7' }}>
      <header className="flex justify-between items-center w-full">
        <div className="w-12 h-12 flex items-center justify-center">
          <img src={appIcon} alt="App Icon" className="w-12 h-12 rounded-full" />
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          退出登录
        </button>
      </header>

      <main className="flex flex-col items-center justify-center flex-grow text-center">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" fill="currentColor" />
            <h1 className="text-xl font-semibold text-gray-900">升级到 Pro</h1>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            当前账号：{phone || '未获取到手机号'}
          </p>

          <div className="text-left mt-6 space-y-3">
            {[
              '免打字快速输入（按住右侧 Option 听写）',
              '更稳定的识别与更高可用性',
              '优先体验新功能',
            ].map((t) => (
              <div key={t} className="flex items-start gap-2 text-gray-700">
                <Check className="w-4 h-4 mt-0.5 text-blue-600" />
                <span className="text-sm">{t}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-3">
            <button
              onClick={handleStartTrial}
              disabled={isStartingTrial || isPurchasing || isRestoring}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isStartingTrial && <Loader className="w-4 h-4 animate-spin" />}
              开始试用
            </button>

            <button
              onClick={handlePurchase}
              disabled={isStartingTrial || isPurchasing || isRestoring}
              className="w-full bg-gray-900 hover:bg-black text-white py-3 rounded-xl font-semibold transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPurchasing && <Loader className="w-4 h-4 animate-spin" />}
              购买成为 Pro Member
            </button>

            <button
              onClick={handleRestore}
              disabled={isStartingTrial || isPurchasing || isRestoring}
              className="w-full bg-white hover:bg-gray-50 text-gray-800 py-3 rounded-xl font-semibold transition-colors border border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isRestoring && <Loader className="w-4 h-4 animate-spin" />}
              恢复购买
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

