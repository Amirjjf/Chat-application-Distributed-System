import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authApi from '../services/authApi';
import PasswordStrengthMeter from './PasswordStrengthMeter';

function SignupForm() {
  const [formData, setFormData] = useState({
    user_id: '',
    raw_password: '',
    name: '',
    country: '',
    email: '',
  });
  const [profilePic, setProfilePic] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [touched, setTouched] = useState({});
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((fd) => ({ ...fd, [name]: value }));
    
    // Clear validation error when user types
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Mark field as touched
    if (!touched[name]) {
      setTouched(prev => ({ ...prev, [name]: true }));
    }
  };
  const handleFileChange = (e) => setProfilePic(e.target.files[0] || null);
  
  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, formData[name]);
  };
  
  const validateField = (name, value) => {
    let error = '';
    
    switch (name) {
      case 'user_id':
        if (!value.trim()) {
          error = 'User ID is required';
        } else if (value.length < 3) {
          error = 'User ID must be at least 3 characters';
        } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
          error = 'User ID can only contain letters, numbers and underscores';
        }
        break;
        
      case 'name':
        if (!value.trim()) {
          error = 'Name is required';
        } else if (value.trim().length < 2) {
          error = 'Name must be at least 2 characters';
        }
        break;
        
      case 'email':
        if (!value.trim()) {
          error = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Please enter a valid email address';
        }
        break;
        
      case 'country':
        if (!value.trim()) {
          error = 'Country is required';
        }
        break;
        
      case 'raw_password':
        if (!value) {
          error = 'Password is required';
        } else if (value.length < 6) {
          error = 'Password must be at least 6 characters';
        }
        break;
        
      default:
        break;
    }
    
    setValidationErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };
  
  const validateForm = () => {
    const errors = {};
    const fields = ['user_id', 'raw_password', 'name', 'country', 'email'];
    
    fields.forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) {
        errors[field] = error;
      }
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Mark all fields as touched
    const allTouched = Object.keys(formData).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
    setTouched(allTouched);
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);

    // Use FormData for file uploads
    const data = new FormData();
    Object.entries(formData).forEach(([key, val]) => data.append(key, val));
    if (profilePic) data.append('profilePic', profilePic);

    try {
      const { message } = await authApi.signup(data);
      setSuccess(message || 'Signup successful! Redirecting to login...');
      setFormData({ user_id: '', raw_password: '', name: '', country: '', email: '' });
      setProfilePic(null);
      if (e.target.profilePic) {
        e.target.profilePic.value = null;
      }
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      const msg = err?.message || 'Signup failed. Please check your details.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const formatLabel = (field) => {
    switch (field) {
      case 'user_id': return 'User ID';
      case 'raw_password': return 'Password';
      case 'name': return 'Full Name';
      case 'email': return 'Email Address';
      case 'country': return 'Country';
      default: return field;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-container" encType="multipart/form-data">
      <h2>Sign Up</h2>
      {error && <p className="message error-message">{error}</p>}
      {success && <p className="message success-message">{success}</p>}      {['user_id', 'name', 'email', 'country'].map((field) => (
        <div key={field} className="input-group">
          <label htmlFor={field}>{formatLabel(field)}:</label>
          <input
            type={field === 'email' ? 'email' : 'text'}
            id={field}
            name={field}
            value={formData[field]}
            onChange={handleChange}
            onBlur={handleBlur}
            className={touched[field] && validationErrors[field] ? 'input-error' : ''}
            autoComplete={field === 'email' ? 'email' : field === 'name' ? 'name' : 'off'}
          />
          {touched[field] && validationErrors[field] && (
            <p className="input-error-text">{validationErrors[field]}</p>
          )}
        </div>
      ))}
      
      {/* Special handling for password field with strength meter */}
      <div className="input-group">
        <label htmlFor="raw_password">{formatLabel('raw_password')}:</label>
        <input
          type="password"
          id="raw_password"
          name="raw_password"
          value={formData.raw_password}
          onChange={handleChange}
          onBlur={handleBlur}
          className={touched.raw_password && validationErrors.raw_password ? 'input-error' : ''}
          autoComplete="new-password"
        />
        <PasswordStrengthMeter password={formData.raw_password} />
        {touched.raw_password && validationErrors.raw_password && (
          <p className="input-error-text">{validationErrors.raw_password}</p>
        )}
      </div>

      <div className="input-group">
        <label htmlFor="profilePic">Profile Picture (Optional):</label>
        <input
          type="file"
          id="profilePic"
          name="profilePic"
          accept="image/png, image/jpeg, image/gif"
          onChange={handleFileChange}
        />
      </div>

      <button type="submit" disabled={isLoading || success}>
        {isLoading ? 'Signing Up…' : 'Sign Up'}
      </button>
    </form>
  );
}

export default SignupForm;
