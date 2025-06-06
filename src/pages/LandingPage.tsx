import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '20px' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>WhsprFlow</h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '40px' }}>
        Dictate text effortlessly into any application on your desktop.
      </p>
      <button 
        style={{ 
          padding: '15px 30px', 
          fontSize: '1.2rem', 
          backgroundColor: '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '5px', 
          cursor: 'pointer' 
        }}
        onClick={() => navigate('/signup')}
      >
        Download for macOS / Windows
      </button>
      <p style={{ marginTop: '30px', fontSize: '0.9rem', color: '#666' }}>
        Experience seamless voice-to-text integration.
      </p>
      {/* Link to the main app for testing purposes during development */}
      <p style={{ marginTop: '20px' }}>
        <button onClick={() => navigate('/app')} style={{ fontSize: '0.9rem', color: '#007bff', background: 'none', border: 'none', padding: '0', textDecoration: 'underline', cursor: 'pointer' }}>
          (Dev: Go to App)
        </button>
      </p>
    </div>
  );
};

export default LandingPage; 