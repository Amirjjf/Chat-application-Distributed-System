import axios from 'axios';
import { getTokenTimeRemaining } from './tokenService';
import apiClient from './apiClient';

const AUTH_API_URL = 'http://localhost:5001/api/users';

let authChangeListeners = [];
let refreshTokenTimeout = null;

const subscribeToAuthChanges = (callback) => {
    if (typeof callback === 'function') {
        authChangeListeners.push(callback);
    }
    return () => {
        authChangeListeners = authChangeListeners.filter(listener => listener !== callback);
    };
};

const notifyAuthChange = () => {
    const currentUser = getCurrentUser();
    authChangeListeners.forEach(callback => callback(currentUser));
};

const setupRefreshTokenTimer = () => {
    // Clear any existing timers
    clearTimeout(refreshTokenTimeout);
    
    const token = getToken();
    if (!token) return;
    
    // Time until we need to refresh (with a small buffer)
    const timeUntilRefresh = getTokenTimeRemaining(token) - (2 * 60 * 1000); // 2 minutes before expiry
    
    if (timeUntilRefresh <= 0) {
        // Token already expired or very close to expiry
        refreshToken();
    } else {
        // Set timer to refresh token before it expires
        refreshTokenTimeout = setTimeout(() => {
            refreshToken();
        }, timeUntilRefresh);
    }
};

const signup = async (formData) => {
    try {
        // Use axios directly for signup since we don't have auth yet
        const { data } = await axios.post(`${AUTH_API_URL}/signup`, formData);
        return data;
    } catch (err) {
        const payload = err.response?.data || {};
        throw new Error(payload.message || payload.error || 'Signup request failed. Please try again.');
    }
};

/**
 * Refresh the current authentication token
 * @return {Promise<boolean>} True if token was refreshed successfully
 */
const refreshToken = async () => {
    try {
        const currentToken = getToken();
        if (!currentToken) return false;
        
        // Use apiClient which will automatically add the current token
        const response = await apiClient.post('/users/refresh-token');
        
        if (response.data?.token) {
            localStorage.setItem('token', response.data.token);
            
            // Update user data if provided
            if (response.data.user) {
                localStorage.setItem('user', JSON.stringify(response.data.user));
                notifyAuthChange();
            }
            
            // Setup the next refresh cycle
            setupRefreshTokenTimer();
            console.log("Token refreshed successfully");
            return true;
        }
        return false;
    } catch (err) {
        console.error("Failed to refresh token:", err);
        
        // Only log out if the error is authentication related (401)
        if (err.response?.status === 401) {
            logout();
        }
        return false;
    }
};

const login = async (user_id, password) => {
    try {
        const { data } = await axios.post(`${AUTH_API_URL}/login`, { user_id, password });
        if (data.user && data.token) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            notifyAuthChange();
            
            // Set up token refresh timer after successful login
            setupRefreshTokenTimer();
        } else {
            console.warn("Login response missing user or token:", data);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            throw new Error(data.message || "Login completed but critical data missing in response.");
        }
        return data;
    } catch (err) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        const payload = err.response?.data || {};
        throw new Error(payload.message || payload.error || 'Login request failed. Check credentials or server status.');
    }
};

const logout = () => {
    // Clear any pending token refresh
    clearTimeout(refreshTokenTimeout);
    refreshTokenTimeout = null;
    
    // Remove auth data
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    
    // Notify subscribers
    notifyAuthChange();
    console.log("User logged out, token removed.");
};

const getCurrentUser = () => {
    try {
        const userString = localStorage.getItem('user');
        if (!userString) {
            return null;
        }
        return JSON.parse(userString);
    } catch (error) {
        console.error("Failed to parse user data from localStorage:", error);
        logout();
        return null;
    }
};

const getToken = () => {
    return localStorage.getItem('token');
};

export default {
    signup,
    login,
    logout,
    getCurrentUser,
    getToken,
    subscribeToAuthChanges,
    refreshToken
};