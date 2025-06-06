import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const SignUpPage: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const navigate = useNavigate();

  const handleSendOtp = () => {
    if (!phoneNumber) {
      alert('Please enter a phone number.');
      return;
    }
    console.log(`Simulating OTP send to: ${phoneNumber}`);
    alert(`Simulating OTP sent to ${phoneNumber}. Please check your console or imagine you received an SMS.`);
  };

  const handleSignUp = () => {
    if (!phoneNumber || !otp) {
      alert('Please enter both phone number and OTP.');
      return;
    }
    console.log(`Simulating sign-up with Phone: ${phoneNumber}, OTP: ${otp}`);
    // Simulate OTP validation
    if (otp === '123456') { // Mock OTP
      alert('Sign-up successful! (Simulated)\nRedirecting to download/success message...');
      console.log('Simulated redirection to download/success message post-signup.');
      // TODO: Implement actual redirection or success message display
      // For now, let's navigate to a placeholder success route or back to landing
      navigate('/'); // Or a new '/signup-success' route
    } else {
      alert('Invalid OTP. Please try again. (Hint: try 123456)');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '30px' }}>Create Your Account</h1>
      
      <div style={{ width: '100%', maxWidth: '400px', padding: '25px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="phone" style={{ display: 'block', textAlign: 'left', marginBottom: '5px', fontWeight: 'bold' }}>Phone Number</label>
          <input 
            type="tel" 
            id="phone"
            value={phoneNumber} 
            onChange={(e) => setPhoneNumber(e.target.value)} 
            placeholder="Enter your phone number"
            style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
          <div style={{ flexGrow: 1 }}>
            <label htmlFor="otp" style={{ display: 'block', textAlign: 'left', marginBottom: '5px', fontWeight: 'bold' }}>OTP</label>
            <input 
              type="text" 
              id="otp"
              value={otp} 
              onChange={(e) => setOtp(e.target.value)} 
              placeholder="Enter OTP"
              style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
          <button 
            onClick={handleSendOtp} 
            style={{ padding: '12px 15px', fontSize: '0.9rem', backgroundColor: '#5bc0de', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Send OTP
          </button>
        </div>

        <button 
          onClick={handleSignUp} 
          style={{ width: '100%', padding: '15px', fontSize: '1.1rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px' }}
        >
          Sign Up / Verify
        </button>

        {/* Optional WeChat Login Placeholder */}
        <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
          <p style={{ marginBottom: '10px', color: '#666' }}>Or sign up with</p>
          <button 
            onClick={() => alert('WeChat Login clicked - Optional feature')} 
            style={{ padding: '10px 20px', fontSize: '1rem', backgroundColor: '#7bb32e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            WeChat Login (Optional)
          </button>
        </div>
      </div>
      <Link to="/" style={{ marginTop: '30px', color: '#007bff', textDecoration: 'none' }}>Back to Home</Link>
    </div>
  );
};

export default SignUpPage; 