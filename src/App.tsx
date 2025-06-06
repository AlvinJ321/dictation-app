import React, { useState } from 'react';
import SignInPage from './pages/SignInPage';
import AppPage from './pages/AppPage';
import './index.css';

function App() {
  const [isSignedIn, setIsSignedIn] = useState(true);

  const handleSignInSuccess = () => {
    console.log("handleSignInSuccess triggered");
    setIsSignedIn(true);
  };

  const handleLogout = () => {
    console.log("handleLogout triggered");
    setIsSignedIn(false);
  };

  return (
    <>
      {isSignedIn ? (
        <AppPage onLogout={handleLogout} />
      ) : (
        <SignInPage onSignInSuccess={handleSignInSuccess} />
      )}
    </>
  );
}

export default App;