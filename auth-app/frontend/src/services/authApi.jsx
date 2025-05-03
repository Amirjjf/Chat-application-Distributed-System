// frontend/src/services/authApi.js
import axios from 'axios';

// Use environment variables for API URLs in a real app
// For simplicity here, using hardcoded URLs
const AUTH_API_URL = 'http://localhost:5001/api/users'; // Auth App URL

let authChangeListeners = [];

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

const signup = async (formData) => {
    try {
        // Note: When sending FormData, axios automatically sets the Content-Type header
        const { data } = await axios.post(`${AUTH_API_URL}/signup`, formData);
        return data; // Should contain { message: '...', user: {...} } on success
    } catch (err) {
        // Extract error message from backend response if available
        const payload = err.response?.data || {};
        // Provide a fallback error message
        throw new Error(payload.message || payload.error || 'Signup request failed. Please try again.');
    }
};

const login = async (user_id, password) => {
    try {
        const { data } = await axios.post(`${AUTH_API_URL}/login`, { user_id, password });
        // Expect { message: '...', user: {...}, token: '...' } on success
        if (data.user && data.token) {
            // Store user info and token in localStorage
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            notifyAuthChange();
        } else {
            // Handle cases where token or user might be missing unexpectedly
            console.warn("Login response missing user or token:", data);
            // Clear potentially stale data
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            // Throw an error to be caught by the component
            throw new Error(data.message || "Login completed but critical data missing in response.");
        }
        return data; // Return the full response including user and token
    } catch (err) {
        // Clear any potentially stored credentials on login failure
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        const payload = err.response?.data || {};
        // Rethrow a consistent error message for the component to display
        throw new Error(payload.message || payload.error || 'Login request failed. Check credentials or server status.');
    }
};

const logout = () => {
    // Clear user info and token from storage
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    notifyAuthChange();
    // Optional: Add backend call here if server needs to invalidate token or session
    console.log("User logged out, token removed."); // For debugging
};

const getCurrentUser = () => {
    try {
        const userString = localStorage.getItem('user');
        if (!userString) {
            return null; // No user stored
        }
        return JSON.parse(userString); // Parse stored user data
    } catch (error) {
        console.error("Failed to parse user data from localStorage:", error);
        // If data is corrupted, clear it
        logout();
        return null;
    }
};

// Function to retrieve the stored JWT token
const getToken = () => {
    return localStorage.getItem('token');
};

// Export all functions
export default {
    signup,
    login,
    logout,
    getCurrentUser,
    getToken,
    subscribeToAuthChanges
};