import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiFetch from '../lib/api';

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
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        // Here you might want to verify the token with the backend
        // For now, we'll assume if a token exists, the user is authenticated.
        setIsAuthenticated(true);
        // You could also fetch user profile here and setUser
      }
      setIsLoading(false);
    };
    checkAuthStatus();
  }, []);

  const login = (tokens: { accessToken: string; refreshToken: string }) => {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setIsAuthenticated(true);
    // You might want to decode the token to get user info or fetch it from an endpoint
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await apiFetch('/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch (error) {
        console.error('Logout API call failed:', error);
      }
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
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