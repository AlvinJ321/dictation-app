import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SignInPage from './pages/SignInPage';
import AppPage from './pages/AppPage';
import PaywallPage from './pages/PaywallPage';
import WIPPage from './pages/WIPPage';
import './index.css';

type View = 'app' | 'wip';

function AppContent() {
  const { isAuthenticated, isLoading, subscription } = useAuth();
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

  const tier = subscription?.tier;
  const isVip = tier === 'pro' || subscription?.is_vip;
  const isTrial = tier === 'trial' || subscription?.is_trial;

  if (!isVip && !isTrial) {
    return <PaywallPage />;
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
