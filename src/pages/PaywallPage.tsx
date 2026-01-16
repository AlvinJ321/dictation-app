import React, { useState } from 'react';
import { Crown, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionService } from '../services/subscriptionService';
import appIcon from '../../resource/Voco-app-icon.png';

export default function PaywallPage() {
  const { user, subscription, refreshSubscription, logout } = useAuth();
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const phone = user?.phoneNumber;
  const shouldShowTrial = subscription?.trialUsedAt == null;
  const isBusy = isStartingTrial || isPurchasing;

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
            <h1 className="text-xl font-semibold text-gray-900">欢迎使用Voco</h1>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            当前账号：{phone || '未获取到手机号'}
          </p>

          <div className="mt-8 space-y-3">
            {shouldShowTrial && (
              <button
                onClick={handleStartTrial}
                disabled={isBusy}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isStartingTrial && <Loader className="w-4 h-4 animate-spin" />}
                免费试用七天
              </button>
            )}

            <button
              onClick={handlePurchase}
              disabled={isBusy}
              className="w-full bg-gray-900 hover:bg-black text-white py-3 rounded-xl font-semibold transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPurchasing && <Loader className="w-4 h-4 animate-spin" />}
              {shouldShowTrial ? '购买Pro Member' : '购买 Pro'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
