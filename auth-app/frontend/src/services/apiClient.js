import axios from 'axios';
import authApi from './authApi';
import { isTokenExpiringSoon } from './tokenService';

// Create the axios instance
const apiClient = axios.create({
  baseURL: 'http://localhost:5001/api',
});

// Add a request interceptor
apiClient.interceptors.request.use(
  async (config) => {
    // Get the token
    let token = authApi.getToken();
    
    // If token is expiring soon, try to refresh it first
    if (token && isTokenExpiringSoon(token)) {
      try {
        const refreshed = await authApi.refreshToken();
        if (refreshed) {
          token = authApi.getToken(); // Get the newly refreshed token
        }
      } catch (error) {
        console.error('Token refresh failed in interceptor:', error);
      }
    }
    
    // Add token to the request if available
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // If the error is unauthorized (401) and we haven't tried to retry yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Mark the request as retried
      
      try {
        // Try to refresh the token
        const refreshed = await authApi.refreshToken();
        if (refreshed) {
          // If token refresh was successful, retry the original request
          const token = authApi.getToken();
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axios(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed during 401 handling:', refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
