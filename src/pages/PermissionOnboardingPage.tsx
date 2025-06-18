import React, { useEffect, useState } from 'react';

interface PermissionOnboardingPageProps {
  onRestartApp: () => void;
}

const PermissionOnboardingPage: React.FC<PermissionOnboardingPageProps> = ({ onRestartApp }) => {
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const poll = () => {
      const electronApi = (window as any).electron;
      if (electronApi && electronApi.checkPermissionsPending) {
        electronApi.checkPermissionsPending().then((pending: boolean) => {
          setPermissionsGranted(!pending);
        });
      }
    };
    poll();
    intervalId = setInterval(poll, 2000);
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '20px', background: '#FAFAF7' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#e0e7ef', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginRight: 16 }}>
          logo
        </div>
        <span style={{ fontSize: '2rem', fontWeight: 600, color: '#2d3a4b' }}>Voco</span>
      </div>
      <h2 style={{ fontSize: '1.5rem', color: '#2d3a4b', marginBottom: 16 }}>请授权麦克风和辅助功能权限</h2>
      <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: 8 }}>
        请在系统设置中为Voco应用授权麦克风和辅助功能权限，以便正常使用。
      </p>
      <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: 32 }}>
        完成后点击"开启Voco"按钮。
      </p>
      <button
        style={{
          padding: '15px 60px',
          fontSize: '1.3rem',
          backgroundColor: permissionsGranted ? '#007bff' : '#e0e7ef',
          color: permissionsGranted ? 'white' : '#b0b8c9',
          border: 'none',
          borderRadius: '12px',
          cursor: permissionsGranted ? 'pointer' : 'not-allowed',
          fontWeight: 600,
          letterSpacing: 2,
          transition: 'background 0.2s, color 0.2s',
        }}
        disabled={!permissionsGranted}
        onClick={onRestartApp}
      >
        开启Voco
      </button>
    </div>
  );
};

export default PermissionOnboardingPage; 