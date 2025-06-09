import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SignInPage from './pages/SignInPage';
import AppPage from './pages/AppPage';
import WIPPage from './pages/WIPPage';
import './index.css';

type View = 'app' | 'wip';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState<View>('app');

  const navigateToWip = () => setCurrentView('wip');
  const navigateToApp = () => setCurrentView('app');

  if (isLoading) {
    // You can return a loading spinner here
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <SignInPage />;
  }
  
  if (currentView === 'wip') {
    return <WIPPage onBack={navigateToApp} />;
  }

  return <AppPage onNavigateToWip={navigateToWip} />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;