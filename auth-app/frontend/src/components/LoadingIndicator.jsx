import React, { useState, useEffect } from 'react';
import axios from 'axios';

const LoadingIndicator = () => {
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    // Add request interceptor
    const requestInterceptor = axios.interceptors.request.use(
      config => {
        setLoading(true);
        return config;
      },
      error => {
        setLoading(false);
        return Promise.reject(error);
      }
    );

    // Add response interceptor
    const responseInterceptor = axios.interceptors.response.use(
      response => {
        setLoading(false);
        return response;
      },
      error => {
        setLoading(false);
        return Promise.reject(error);
      }
    );

    // Clean up interceptors when the component unmounts
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  if (!loading) {
    return null;
  }

  return (
    <div className="global-loading-indicator">
      <div className="loading-spinner"></div>
    </div>
  );
};

export default LoadingIndicator;
