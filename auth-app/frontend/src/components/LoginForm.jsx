import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authApi from '../services/authApi';

function LoginForm({ onLoginSuccess }) {
  const [user_id, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await authApi.login(user_id, password);
      console.log('Login successful:', response.message);

      if (response.user && onLoginSuccess) {
        onLoginSuccess(response.user);
      } else if (!response.user) {
        console.warn("Login succeeded but no user data received in response.");
        setError("Login succeeded, but failed to retrieve user data.");
        setIsLoading(false);
        return;
      }

      navigate('/');
    } catch (err) {
      const msg = err?.message || 'Login failed. Please check your credentials.';
      console.error("Login Error:", err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-container">
      <h2>Login</h2>
      {error && <p className="message error-message">{error}</p>}

      <div className="input-group">
        <label htmlFor="login_user_id">User ID:</label>
        <input
          type="text"
          id="login_user_id"
          value={user_id}
          onChange={(e) => setUserId(e.target.value)}
          required
          autoComplete="username"
        />
      </div>

      <div className="input-group">
        <label htmlFor="login_password">Password:</label>
        <input
          type="password"
          id="login_password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging In…' : 'Login'}
      </button>
    </form>
  );
}

export default LoginForm;
