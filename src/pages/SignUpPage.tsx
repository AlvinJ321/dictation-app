import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiFetch from '../lib/api';

export default function SignUpPage() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendVerification = async () => {
    if (!/^\d{11}$/.test(phone)) {
      setError('请输入一个有效的11位手机号码。');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const response = await apiFetch('/send-verification-code', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone, type: 'signup' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '发送验证码失败。');
      }

      setIsVerificationSent(true);
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生了未知错误。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) {
      setError('验证码不能为空。');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const response = await apiFetch('/signup', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: phone,
          verificationCode: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '注册失败。');
      }

      login({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生了未知错误。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen font-sans" style={{ backgroundColor: '#F5F6FA' }}>
      <div className="w-full max-w-sm p-6 relative" style={{ backgroundColor: '#F5F6FA' }}>

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
            <span className="px-3 py-2.5 rounded-lg font-semibold border border-gray-300 bg-white text-gray-600">+86</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="手机号"
              className="flex-1 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-w-0 bg-white"
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

          {/* Verification Code Input */}
          <div className="border border-gray-300 rounded-lg">
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="输入验证码"
              className="w-full p-2.5 outline-none bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={!isVerificationSent}
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-left px-1">{error}</p>}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isVerificationSent || isLoading}
            className="w-full mt-8 py-2.5 bg-blue-400 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:bg-blue-200"
          >
            {isLoading ? '注册中...' : '注册'}
          </button>
        </form>
        
      </div>
    </div>
  );
} 