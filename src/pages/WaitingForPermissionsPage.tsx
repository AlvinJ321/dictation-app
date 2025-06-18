import React from 'react';

const WaitingForPermissionsPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '20px', background: '#FAFAF7' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '20px', color: '#333' }}>Waiting for Permissions</h1>
      <p style={{ fontSize: '1.1rem', marginBottom: '30px', color: '#666' }}>
        Please grant microphone and accessibility permissions in System Settings.<br/>
        The app will automatically restart once permissions are granted.
      </p>
      <div style={{ fontSize: '2rem' }}>🔒🎤⌨️</div>
    </div>
  );
};

export default WaitingForPermissionsPage; 