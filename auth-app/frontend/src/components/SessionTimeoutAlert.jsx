import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getTokenTimeRemaining } from '../services/tokenService';
import authApi from '../services/authApi';

// Session warning styling
const styles = {
  container: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    color: '#721c24',
    padding: '15px 20px',
    borderRadius: '4px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
    zIndex: 1000,
    maxWidth: '350px',
    transition: 'opacity 0.5s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontWeight: 600,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    color: '#721c24',
  },
  message: {
    margin: '8px 0',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  button: {
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    border: 'none',
    fontSize: '14px',
  },
  continueButton: {
    backgroundColor: '#17a2b8',
    color: 'white',
  },
  logoutButton: {
    backgroundColor: '#6c757d',
    color: 'white',
  },
};

/**
 * SessionTimeoutAlert component - displays a warning when session is about to expire
 * @param {Object} props
 * @param {Function} props.onLogout - Function to call when user clicks Logout
 * @param {number} props.warningThreshold - Time in milliseconds before expiry to show warning (default: 2 minutes)
 */
function SessionTimeoutAlert({ onLogout, warningThreshold = 2 * 60 * 1000 }) {
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const intervalId = useRef(null);
  
  // Format time remaining in human-readable format
  const formatTimeLeft = (ms) => {
    if (!ms) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const checkSessionExpiry = useCallback(() => {
    const token = authApi.getToken();
    if (!token) {
      clearInterval(intervalId.current);
      setVisible(false);
      return;
    }
    
    const remaining = getTokenTimeRemaining(token);
    
    // Show warning if time remaining is less than threshold
    if (remaining <= warningThreshold) {
      setTimeLeft(remaining);
      setVisible(true);
    } else {
      setVisible(false);
    }
    
    // If token has expired, logout
    if (remaining <= 0) {
      clearInterval(intervalId.current);
      if (onLogout) onLogout();
    }
  }, [onLogout, warningThreshold]);
  
  const handleContinue = async () => {
    try {
      const success = await authApi.refreshToken();
      if (success) {
        setVisible(false);
      }
    } catch (err) {
      console.error('Failed to refresh session:', err);
    }
  };
  
  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      authApi.logout();
    }
    setVisible(false);
  };
  
  const handleClose = () => {
    setVisible(false);
  };
  
  // Set up timer to check session expiry
  useEffect(() => {
    // Initial check
    checkSessionExpiry();
    
    // Set up periodic checks
    intervalId.current = setInterval(checkSessionExpiry, 10000); // Check every 10 seconds
    
    return () => {
      clearInterval(intervalId.current);
    };
  }, [checkSessionExpiry]);
  
  // More frequent updates when warning is visible
  useEffect(() => {
    if (visible) {
      const updateTimer = setInterval(() => {
        const token = authApi.getToken();
        if (!token) {
          clearInterval(updateTimer);
          return;
        }
        setTimeLeft(getTokenTimeRemaining(token));
      }, 1000); // Update countdown every second
      
      return () => clearInterval(updateTimer);
    }
  }, [visible]);
  
  if (!visible) return null;
  
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Session Timeout Warning</h3>
        <button style={styles.closeButton} onClick={handleClose}>×</button>
      </div>
      
      <p style={styles.message}>
        Your session will expire in <strong>{formatTimeLeft(timeLeft)}</strong>. 
        Would you like to continue your session or log out?
      </p>
      
      <div style={styles.actions}>
        <button 
          style={{...styles.button, ...styles.continueButton}} 
          onClick={handleContinue}
        >
          Continue Session
        </button>
        <button 
          style={{...styles.button, ...styles.logoutButton}} 
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default SessionTimeoutAlert;
