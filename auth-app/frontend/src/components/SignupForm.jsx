import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authApi from '../services/authApi';

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
  const navigate = useNavigate();

  const handleChange = (e) =>
    setFormData((fd) => ({ ...fd, [e.target.name]: e.target.value }));

  const handleFileChange = (e) => setProfilePic(e.target.files[0] || null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
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
      {success && <p className="message success-message">{success}</p>}

      {['user_id', 'name', 'email', 'country', 'raw_password'].map((field) => (
        <div key={field} className="input-group">
          <label htmlFor={field}>{formatLabel(field)}:</label>
          <input
            type={field === 'email' ? 'email' : field === 'raw_password' ? 'password' : 'text'}
            id={field}
            name={field}
            value={formData[field]}
            onChange={handleChange}
            required
            autoComplete={field === 'email' ? 'email' : field === 'name' ? 'name' : 'off'}
          />
        </div>
      ))}

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
