import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiFetch from '../lib/api';

export default function SignInPage() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [verificationCodeError, setVerificationCodeError] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendVerification = async () => {
    setPhoneError('');
    setVerificationCodeError('');
    setError('');

    if (!/^\d{11}$/.test(phone)) {
      setPhoneError('请输入一个有效的11位手机号码。');
      return;
    }
    setIsLoading(true);

    try {
      const response = await apiFetch('/send-verification-code', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone, intent: 'login' }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({})); // Gracefully handle non-JSON responses
        if (response.status === 404) {
          setPhoneError(data.message || '该手机号码未注册。');
        } else {
          setError(data.message || '发送验证码失败。');
        }
        return;
      }
      
      setIsVerificationSent(true);
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationCodeError('');
    setError('');

    if (!verificationCode) {
      setVerificationCodeError('验证码不能为空。');
      return;
    }
    setIsLoading(true);

    try {
      const response = await apiFetch('/verify', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: phone,
          verificationCode: verificationCode,
          intent: 'login',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.message && (data.message.includes('incorrect') || data.message.includes('invalid'))) {
          setVerificationCodeError('验证码不正确。');
        } else if (data.message && data.message.includes('expired')) {
          setVerificationCodeError('验证码已过期，请重新获取。');
        } else {
          setError(data.message || '登录失败。');
        }
        return;
      }

      login({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white flex items-center justify-center h-screen font-sans">
      <div className="bg-white w-full max-w-sm p-6 relative">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="mb-4 text-4xl font-bold text-blue-600">
            Logo
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-6">
          {/* Phone Input Group */}
          <div className="flex items-center space-x-2">
            <span className="bg-gray-100 text-gray-600 px-3 py-2.5 rounded-lg font-semibold">+86</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="手机号"
              className="flex-1 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
              disabled={isLoading || countdown > 0}
            />
            <button
              type="button"
              onClick={handleSendVerification}
              disabled={isLoading || countdown > 0}
              className="bg-blue-600 text-white px-3 py-2.5 rounded-lg font-semibold text-sm whitespace-nowrap disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {isLoading && !isVerificationSent ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码'}
            </button>
          </div>
          {phoneError && <p className="text-red-500 text-sm text-left px-1">{phoneError}</p>}

          {/* Verification Code Input */}
          <div className="relative">
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="输入验证码"
              className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
          {verificationCodeError && <p className="text-red-500 text-sm text-left px-1">{verificationCodeError}</p>}
          
          {/* Global Error */}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg font-semibold text-lg transition-colors disabled:bg-blue-300"
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}