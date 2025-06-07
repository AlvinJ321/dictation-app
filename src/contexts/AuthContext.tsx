import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiFetch from '../lib/api';
import { getTokens, setTokens, clearTokens } from '../lib/store';

interface AuthContextType {
  isAuthenticated: boolean;
  user: {
    userId: string;
    phoneNumber: string;
    userName: string;
  } | null;
  login: (tokens: { accessToken: string; refreshToken: string }) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      const tokens = await getTokens();
      if (tokens && tokens.accessToken) {
        try {
          const response = await apiFetch('/me');
          if (!response.ok) {
            throw new Error('Failed to fetch user profile.');
          }
          const userData = await response.json();
          setUser(userData);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Authentication check failed:', error);
          setIsAuthenticated(false);
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    checkAuthStatus();
  }, []);

  const login = (tokens: { accessToken: string; refreshToken: string }) => {
    setTokens(tokens);
    setIsAuthenticated(true);
    const fetchUser = async () => {
      try {
        const response = await apiFetch('/me');
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
    clearTokens();
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