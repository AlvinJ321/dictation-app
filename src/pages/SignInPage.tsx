import React, { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';

export default function SignInPage({ onSignInSuccess }: { onSignInSuccess: () => void }) {
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
    // Basic validation
    if (!/^\d{11}$/.test(phone)) {
      setError('请输入一个有效的11位手机号码。');
      return;
    }
    setError('');
    setIsLoading(true);
    console.log('Sending verification code to', phone);
    // Simulate API call
    setTimeout(() => {
      console.log("Mock verification code '123456' sent.");
      setIsVerificationSent(true);
      setCountdown(60);
      setIsLoading(false);
    }, 1000);
  };
  
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) {
      setError('验证码不能为空。');
      return;
    }
    setError('');
    setIsLoading(true);
    console.log(`Verifying phone: ${phone} with code: ${verificationCode}`);
    // Mock verification
    setTimeout(() => {
      if (verificationCode === '123456') {
        console.log('Sign in successful!');
        onSignInSuccess();
      } else {
        setError('验证码不正确。');
      }
      setIsLoading(false);
    }, 1000);
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
              disabled={isLoading || isVerificationSent}
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
              className="w-full p-2.5 outline-none bg-transparent rounded-lg focus:ring-2 focus:ring-blue-500"
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
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>
        
      </div>
    </div>
  );
} 