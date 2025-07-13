import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);
      
      if (isSignUp) {
        // Check access code for sign-ups
        if (accessCode !== 'jasonhan') {
          setError('Invalid access code. Please contact the administrator.');
          setLoading(false);
          return;
        }
        await signup(email, password);
      } else {
        await login(email, password);
      }
    } catch (error) {
      setError('Failed to ' + (isSignUp ? 'create account' : 'log in'));
      console.error(error);
    }

    setLoading(false);
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{isSignUp ? 'Sign Up' : 'Log In'}</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {isSignUp && (
            <div className="form-group">
              <label htmlFor="accessCode">Access Code</label>
              <input
                type="text"
                id="accessCode"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Enter access code"
                required
              />
            </div>
          )}
          <button disabled={loading} type="submit" className="submit-btn">
            {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Log In')}
          </button>
        </form>
        <div className="toggle-auth">
          <button 
            type="button" 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setAccessCode('');
            }}
            className="toggle-btn"
          >
            {isSignUp ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
