import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiFetch from '../lib/api';
import { getTokens } from '../lib/store';
import { subscriptionService, SubscriptionStatus } from '../services/subscriptionService';

// This is the important part of the fix: we will now call the method exposed in preload.js
declare global {
  interface Window {
    electron?: {
      store: {
        getTokens: () => Promise<{ accessToken?: string; refreshToken?: string; }>;
        setTokens: (tokens: { accessToken: string; refreshToken: string; }) => void;
        clearTokens: () => void;
      };
      onRecordingStatus: (callback: (status: 'idle' | 'recording' | 'processing' | 'success' | 'error') => void) => void;
      removeRecordingStatusListener: (callback: (status: 'idle' | 'recording' | 'processing' | 'success' | 'error') => void) => void;
      onTranscriptionResult: (callback: (result: { success: boolean, text?: string, error?: string }) => void) => void;
      removeTranscriptionResultListener: (callback: (result: { success: boolean, text?: string, error?: string }) => void) => void;
      onAuthFailed: (callback: (data: { reason: string }) => void) => void;
      removeAuthFailedListener: (callback: (data: { reason: string }) => void) => void;
      getAppStoreReceipt: () => Promise<string | null>;
      openExternal: (url: string) => void;
      subscription: {
        setStatus: (status: SubscriptionStatus | null) => void;
        clearStatus: () => void;
        onRefreshRequest: (callback: (payload?: any) => void) => void;
        removeRefreshRequestListener: (callback: (payload?: any) => void) => void;
        onGateBlocked: (callback: (payload?: any) => void) => void;
        removeGateBlockedListener: (callback: (payload?: any) => void) => void;
      };
    }
  }
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: {
    userId: string;
    phoneNumber: string;
    username: string;
    avatarUrl: string;
    avatarKey: string;
  } | null;
  subscription: SubscriptionStatus | null;
  refreshSubscription: () => Promise<void>;
  login: (tokens: { accessToken: string; refreshToken:string }) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscriptionStatus = async () => {
    const status = await subscriptionService.getStatus();
    if (status) {
      setSubscription(status);
      window.electron?.subscription?.setStatus?.(status);
    }
  };

  useEffect(() => {
    const handler = () => {
      fetchSubscriptionStatus();
    };

    const subscriptionIpc = window.electron?.subscription;
    subscriptionIpc?.onRefreshRequest?.(handler);
    return () => {
      subscriptionIpc?.removeRefreshRequestListener?.(handler);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const intervalId = setInterval(() => {
      fetchSubscriptionStatus();
    }, 15 * 60 * 1000);
    return () => {
      clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const checkAuthStatus = async () => {
      setIsLoading(true);
      try {
        const tokens = await getTokens();
        if (tokens && tokens.accessToken) {
            const response = await apiFetch('/profile');
            if (!response.ok) {
              console.log('Auth check response not ok, status:', response.status);
              throw new Error('Failed to fetch user profile.');
            }
            const userData = await response.json();
            setUser(userData);
            setIsAuthenticated(true);
            await fetchSubscriptionStatus();
        } else {
            setIsAuthenticated(false);
            setUser(null);
            setSubscription(null);
            window.electron?.subscription?.clearStatus?.();
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        setIsAuthenticated(false);
        setUser(null);
        setSubscription(null);
        window.electron?.subscription?.clearStatus?.();
      } finally {
        setIsLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  const login = (tokens: { accessToken: string; refreshToken: string }) => {
    // We use the exposed store method to set tokens, ensuring it's handled in the main process
    window.electron?.store?.setTokens(tokens);
    setIsAuthenticated(true);
    const fetchUser = async () => {
      try {
        const response = await apiFetch('/profile');
        if (!response.ok) throw new Error('Failed to fetch user');
        const userData = await response.json();
        setUser(userData);
        await fetchSubscriptionStatus();
      } catch (error) {
        console.error("Failed to fetch user on login", error);
        setUser(null);
        setSubscription(null);
        window.electron?.subscription?.clearStatus?.();
      }
    };
    fetchUser();
  };

  const logout = async () => {
    const tokens = await getTokens();
    if (tokens && tokens.refreshToken) {
      try {
        await apiFetch('/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
      } catch (error) {
        console.error('Logout API call failed:', error);
      }
    }
    // This is the critical change: call the method exposed in preload.js
    // to clear tokens in both the main and renderer process stores.
    window.electron?.store?.clearTokens();
    setIsAuthenticated(false);
    setUser(null);
    setSubscription(null);
    window.electron?.subscription?.clearStatus?.();
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, subscription, refreshSubscription: fetchSubscriptionStatus, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
