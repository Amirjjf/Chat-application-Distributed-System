// frontend/src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Import Link
import authApi from '../services/authApi';
// import './HomePage.css'; // Optional: Add styles for HomePage

// Base URL for profile pics - adjust if needed and ensure auth-app serves them
const IMAGE_BASE_URL = 'http://localhost:5001/uploads/profile_pics';
const DEFAULT_AVATAR = '/default-avatar.png'; // Ensure this exists in public folder

function HomePage({ onLogout }) { // Receive onLogout prop from App.jsx
    // Use state to hold user data, initialized from localStorage
    const [user, setUser] = useState(() => authApi.getCurrentUser());
    const navigate = useNavigate();

    useEffect(() => {
        // If component mounts and finds no user (e.g., direct navigation, cleared storage)
        if (!user) {
            console.warn("HomePage: No user found, redirecting to login.");
            navigate('/login');
        }
        // No dependencies needed if initialized from state function,
        // App.jsx handles global state updates via context or storage listener.
    }, [user, navigate]); // Re-run if user state changes or navigate function changes

    useEffect(() => {
        // Sync user state with global state (currentUser in App.jsx)
        const unsubscribe = authApi.subscribeToAuthChanges((updatedUser) => {
            setUser(updatedUser);
        });

        return () => unsubscribe(); // Cleanup subscription on unmount
    }, []);

    const handleLogoutClick = () => {
        if (onLogout) {
            onLogout(); // Call the function passed from App.jsx
        } else {
            // Fallback if prop not provided (though it should be)
            console.warn("HomePage: onLogout prop not provided. Logging out via authApi directly.");
            authApi.logout();
            setUser(null); // Update local state as well
            navigate('/login'); // Redirect after logout
        }
         // Navigation after logout should ideally be handled by the ProtectedRoute logic in App.jsx
         // or the App component's state update triggering a re-render/redirect.
         // Explicit navigation here is a fallback.
    };

    // Render loading or null if user data isn't available yet or user logged out
    if (!user) {
        // This state might be brief as redirection should occur
        return <div className="page-container"><p>Loading user profile or redirecting...</p></div>;
    }

    // Construct profile picture URL
    const profilePicId = user.profile_pic_id; // Get filename from user object
    const profilePicUrl = profilePicId
        ? `${IMAGE_BASE_URL}/${profilePicId}` // Construct URL if ID exists
        : DEFAULT_AVATAR; // Use default if no ID

    // Function to handle image loading errors for the profile picture
    const handleProfilePicError = (e) => {
         if (e.target.src !== DEFAULT_AVATAR) {
             console.error(`Error loading profile picture: ${profilePicUrl}. Falling back to default.`);
             e.target.onerror = null; // Prevent infinite loop
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
                    className="profile-avatar large-avatar" // Add specific class if needed
                    onError={handleProfilePicError} // Handle image load errors
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

             {/* Action buttons/links */}
            <div className="home-actions">
                 {/* Link to the Chat Page */}
                <Link to="/chat" className="button chat-link">
                    Go to Chat
                </Link>

                 {/* Logout Button */}
                <button onClick={handleLogoutClick} className="button logout-button">
                    Logout
                </button>
            </div>
        </div>
    );
}

export default HomePage;