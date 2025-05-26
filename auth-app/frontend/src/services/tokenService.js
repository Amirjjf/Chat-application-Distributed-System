// Token service to centralize token handling and refresh logic
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Decode a JWT token without validating signature
 * @param {string} token - The JWT token to decode
 * @return {Object|null} Decoded token payload or null if invalid
 */
export const decodeToken = (token) => {
  if (!token) return null;
  
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
};

/**
 * Check if a token is expired or about to expire
 * @param {string} token - The JWT token to check
 * @return {boolean} True if token needs refresh, false otherwise
 */
export const isTokenExpiringSoon = (token) => {
  if (!token) return true;
  
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  
  // Get expiration time in milliseconds
  const expiresAt = decoded.exp * 1000;
  const now = Date.now();
  
  // Token needs refresh if it expires within threshold
  return now + TOKEN_REFRESH_THRESHOLD > expiresAt;
};

/**
 * Calculate remaining time until token expiration
 * @param {string} token - The JWT token to check
 * @return {number} Milliseconds until expiration or 0 if expired/invalid
 */
export const getTokenTimeRemaining = (token) => {
  if (!token) return 0;
  
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return 0;
  
  const expiresAt = decoded.exp * 1000;
  const now = Date.now();
  
  return Math.max(0, expiresAt - now);
};
