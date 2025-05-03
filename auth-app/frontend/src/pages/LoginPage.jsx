import React from 'react';
import LoginForm from '../components/LoginForm';
import { Link } from 'react-router-dom';

function LoginPage({ onLoginSuccess }) {
  return (
    <div className="page-container">
      <LoginForm onLoginSuccess={onLoginSuccess} />
      <p className="page-link-text">
        Don't have an account? <Link to="/signup">Sign up here</Link>
      </p>
    </div>
  );
}

export default LoginPage;
