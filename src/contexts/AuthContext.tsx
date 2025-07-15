import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiFetch from '../lib/api';
import { clearTokens } from '../lib/store';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// This is the important part of the fix: we will now call the method exposed in preload.js
declare global {
  interface Window {
    electron: {
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
  login: () => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/profile`, {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status !== 401) {
            console.error('Unexpected error during auth check:', response.status);
          }
          throw new Error('User not authenticated.');
        }
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
      } catch (err: unknown) {
        const error = err as Error;
        if (error.message !== 'User not authenticated.') {
            console.error('Authentication check failed:', error);
        }
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  const login = () => {
    setIsAuthenticated(true);
    const fetchUser = async () => {
      try {
        const response = await apiFetch('/profile');
        if (!response.ok) throw new Error('Failed to fetch user');
        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        console.error("Failed to fetch user on login", error);
        setUser(null);
      }
    };
    fetchUser();
  };

  const logout = async () => {
    try {
      await apiFetch('/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout API call failed:', error);
    }
    window.electron.store.clearTokens(); 
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading }}>
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