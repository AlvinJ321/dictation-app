import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SignInPage from './pages/SignInPage';
import AppPage from './pages/AppPage';
import './index.css';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // You can return a loading spinner here
    return <div>Loading...</div>;
  }

  return (
    <>
      {isAuthenticated ? <AppPage /> : <SignInPage />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;