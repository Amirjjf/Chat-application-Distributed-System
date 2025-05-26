import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authApi from '../services/authApi';

function LoginForm({ onLoginSuccess }) {
  const [user_id, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const navigate = useNavigate();
  const validateForm = () => {
    const errors = {};
    
    if (!user_id.trim()) {
      errors.user_id = 'User ID is required';
    }
    
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
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
      {error && <p className="message error-message">{error}</p>}      <div className="input-group">
        <label htmlFor="login_user_id">User ID:</label>
        <input
          type="text"
          id="login_user_id"
          value={user_id}
          onChange={(e) => {
            setUserId(e.target.value);
            // Clear validation errors when user types
            if (validationErrors.user_id) {
              setValidationErrors(prev => ({ ...prev, user_id: '' }));
            }
          }}
          className={validationErrors.user_id ? 'input-error' : ''}
          autoComplete="username"
        />
        {validationErrors.user_id && <p className="input-error-text">{validationErrors.user_id}</p>}
      </div>

      <div className="input-group">
        <label htmlFor="login_password">Password:</label>
        <input
          type="password"
          id="login_password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            // Clear validation errors when user types
            if (validationErrors.password) {
              setValidationErrors(prev => ({ ...prev, password: '' }));
            }
          }}
          className={validationErrors.password ? 'input-error' : ''}
          autoComplete="current-password"
        />
        {validationErrors.password && <p className="input-error-text">{validationErrors.password}</p>}
      </div>

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging In…' : 'Login'}
      </button>
    </form>
  );
}

export default LoginForm;
