import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authApi from '../services/authApi';

const IMAGE_BASE_URL = 'http://localhost:5001/uploads/profile_pics';
const DEFAULT_AVATAR = '/default-avatar.png';

function HomePage({ onLogout }) {
    const [user, setUser] = useState(() => authApi.getCurrentUser());
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) {
            console.warn("HomePage: No user found, redirecting to login.");
            navigate('/login');
        }
    }, [user, navigate]);

    useEffect(() => {
        const unsubscribe = authApi.subscribeToAuthChanges((updatedUser) => {
            setUser(updatedUser);
        });

        return () => unsubscribe();
    }, []);

    const handleLogoutClick = () => {
        if (onLogout) {
            onLogout();
        } else {
            console.warn("HomePage: onLogout prop not provided. Logging out via authApi directly.");
            authApi.logout();
            setUser(null);
            navigate('/login');
        }
    };

    if (!user) {
        return <div className="page-container"><p>Loading user profile or redirecting...</p></div>;
    }

    const profilePicId = user.profile_pic_id;
    const profilePicUrl = profilePicId
        ? `${IMAGE_BASE_URL}/${profilePicId}`
        : DEFAULT_AVATAR;

    const handleProfilePicError = (e) => {
         if (e.target.src !== DEFAULT_AVATAR) {
             console.error(`Error loading profile picture: ${profilePicUrl}. Falling back to default.`);
             e.target.onerror = null;
             e.target.src = DEFAULT_AVATAR;
         }
     };

    return (
        <div className="page-container home-container">
            <h2>Welcome back, {user.name}!</h2>

            <div className="profile-card">
                <img
                    src={profilePicUrl}
                    alt={`${user.name}'s avatar`}
                    className="profile-avatar large-avatar"
                    onError={handleProfilePicError}
                />
                <h3>Your Profile</h3>
                <p><strong>User ID:</strong> {user.user_id}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Country:</strong> {user.country}</p>
                <p><strong>Joined:</strong> {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
                <p>
                    <strong>Last Login:</strong>{' '}
                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                </p>
            </div>

            <div className="home-actions">
                <Link to="/chat" className="button chat-link">
                    Go to Chat
                </Link>

                <button onClick={handleLogoutClick} className="button logout-button">
                    Logout
                </button>
            </div>
        </div>
    );
}

export default HomePage;