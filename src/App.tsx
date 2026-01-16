import React, { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SignInPage from './pages/SignInPage';
import AppPage from './pages/AppPage';
import PaywallPage from './pages/PaywallPage';
import WIPPage from './pages/WIPPage';
import './index.css';

type View = 'app' | 'wip';

function AppContent() {
  const { isAuthenticated, isLoading, subscription, refreshSubscription } = useAuth();
  const [currentView, setCurrentView] = useState<View>('app');
  const [forcePaywall, setForcePaywall] = useState(false);
  const forcePaywallRef = useRef(false);
  const lastGateAlertAtRef = useRef(0);
  const isPaywallVisibleRef = useRef(false);

  const navigateToWip = () => setCurrentView('wip');
  const navigateToApp = () => setCurrentView('app');

  useEffect(() => {
    forcePaywallRef.current = forcePaywall;
  }, [forcePaywall]);

  useEffect(() => {
    const tier = subscription?.tier;
    const isVip = tier === 'pro' || subscription?.is_vip;
    const isTrial = tier === 'trial' || subscription?.is_trial;
    const isPaywallVisible =
      isAuthenticated && currentView !== 'wip' && (forcePaywall || (!isVip && !isTrial));
    isPaywallVisibleRef.current = isPaywallVisible;
  }, [isAuthenticated, currentView, forcePaywall, subscription]);

  useEffect(() => {
    const handler = () => {
      const now = Date.now();
      if (now - lastGateAlertAtRef.current < 3000) return;
      lastGateAlertAtRef.current = now;
      setForcePaywall(true);
      refreshSubscription();
      if (!isPaywallVisibleRef.current) {
        alert('需要在试用期内或成为 Pro Member 才能使用听写。');
      }
    };

    window.electron.subscription.onGateBlocked(handler);
    return () => {
      window.electron.subscription.removeGateBlockedListener(handler);
    };
  }, [refreshSubscription]);

  useEffect(() => {
    if (!isAuthenticated) {
      setForcePaywall(false);
      return;
    }
    const tier = subscription?.tier;
    const isVip = tier === 'pro' || subscription?.is_vip;
    const isTrial = tier === 'trial' || subscription?.is_trial;
    if (isVip || isTrial) {
      setForcePaywall(false);
    }
  }, [isAuthenticated, subscription]);

  if (isLoading) {
    // You can return a loading spinner here
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <SignInPage />;
  }

  if (forcePaywall) {
    return <PaywallPage />;
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
