import axios from 'axios';

const AUTH_API_URL = 'http://localhost:5001/api/users';

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
        const { data } = await axios.post(`${AUTH_API_URL}/signup`, formData);
        return data;
    } catch (err) {
        const payload = err.response?.data || {};
        throw new Error(payload.message || payload.error || 'Signup request failed. Please try again.');
    }
};

const login = async (user_id, password) => {
    try {
        const { data } = await axios.post(`${AUTH_API_URL}/login`, { user_id, password });
        if (data.user && data.token) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            notifyAuthChange();
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
    localStorage.removeItem('user');
    localStorage.removeItem('token');
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
    subscribeToAuthChanges
};