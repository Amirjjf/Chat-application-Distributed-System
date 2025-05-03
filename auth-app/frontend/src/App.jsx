// frontend/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ChatPage from './pages/ChatPage'; // <-- Import ChatPage
import authApi from './services/authApi';
import './App.css'; // Main CSS for App layout and Nav

// --- Protected Route Component ---
// Memoize ProtectedRoute to prevent unnecessary re-renders
const ProtectedRoute = React.memo(({ children }) => {
    const user = authApi.getCurrentUser();
    console.log("ProtectedRoute: Checking authentication state.", user ? `User: ${user.name}` : "No user");

    if (!user) {
        console.log("ProtectedRoute: User not authenticated. Redirecting to /login.");
        return <Navigate to="/login" replace />;
    }

    console.log("ProtectedRoute: User authenticated. Rendering child components.");
    return children;
});

// --- Public Route Component ---
// Renders child components only if user is NOT authenticated.
// Otherwise, redirects authenticated users away from public-only pages (like login/signup)
// typically to the home page.
const PublicRoute = ({ children }) => {
    const user = authApi.getCurrentUser();
    if (user) {
        // Redirect authenticated users away from login/signup pages
        return <Navigate to="/" replace />;
    }
    return children; // Render the component if not authenticated
};

// --- Main App Component ---
function App() {
    // State to hold the current user object (or null if not logged in)
    // Initialize state from localStorage on component mount
    const [currentUser, setCurrentUser] = useState(() => authApi.getCurrentUser());

    // Prevent unnecessary state updates in syncAuthState
    const syncAuthState = useCallback(() => {
        const user = authApi.getCurrentUser();
        setCurrentUser((prevUser) => {
            if (prevUser?.id === user?.id) {
                console.log("syncAuthState: No changes in authentication state. Skipping update.");
                return prevUser;
            }
            console.log("syncAuthState: Authentication state updated.", user ? `User: ${user.name}` : "No user");
            return user;
        });
    }, []);

    // Effect to sync auth state when the component mounts and listen for storage changes
    useEffect(() => {
        syncAuthState(); // Sync on initial load

        // Define handler for storage events (login/logout in other tabs)
        const handleStorageChange = (event) => {
            // Check if the 'user' or 'token' key in localStorage changed
            if (event.key === 'user' || event.key === 'token') {
                console.log("Storage changed event detected, syncing auth state...");
                syncAuthState();
            }
        };

        // Add event listener
        window.addEventListener('storage', handleStorageChange);

        // Cleanup: Remove event listener when the component unmounts
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [syncAuthState]); // Depend on syncAuthState

    useEffect(() => {
        // Ensure navigation bar updates dynamically
        const unsubscribe = authApi.subscribeToAuthChanges((updatedUser) => {
            setCurrentUser(updatedUser);
        });

        return () => unsubscribe(); // Cleanup subscription on unmount
    }, []);

    // --- Event Handlers ---
    // Called by LoginPage upon successful login API call
    const handleLoginSuccess = (/* loginResponseData - could use this, but syncAuthState is more robust */) => {
        console.log("Login successful callback triggered.");
        syncAuthState(); // Re-check localStorage and update state
        // Navigation is handled within LoginForm/LoginPage now
    };

    // Called by HomePage or Nav Logout button
    const handleLogout = () => {
        console.log("Logout triggered.");
        authApi.logout(); // Clear localStorage
        syncAuthState(); // Update state to reflect logout
        // No navigation here; let components or Routes handle redirection if needed
        // Often, the ProtectedRoute will handle redirecting away from protected pages.
    };


    return (
        <Router>
            {/* Navigation Bar */}
            <nav className="app-nav">
                <div className="nav-links">
                    {/* Link to Home - always visible */}
                    <Link to="/">Home</Link>

                    {/* Show Chat link only if logged in */}
                    {currentUser && <Link to="/chat">Chat</Link>}

                    {/* Show Login and Sign Up links only if NOT logged in */}
                    {!currentUser && (
                        <>
                            <Link to="/login">Login</Link>
                            <Link to="/signup">Sign Up</Link>
                        </>
                    )}
                </div>

                {/* Show User Name and Logout Button if logged in */}
                {currentUser && (
                    <div className="nav-user-section">
                        <span className="nav-user-name">Welcome, {currentUser.name}!</span>
                        {/* Use a button for actions like logout */}
                        <button onClick={handleLogout} className="nav-logout-btn">Logout</button>
                    </div>
                )}
            </nav>

            {/* Application Routes */}
            <main className="app-content">
                <Routes>
                    {/* Home Page - Protected */}
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                {/* Pass onLogout to HomePage if it uses it directly */}
                                <HomePage onLogout={handleLogout} />
                            </ProtectedRoute>
                        }
                    />

                    {/* Chat Page - Protected */}
                    <Route
                        path="/chat"
                        element={
                            <ProtectedRoute>
                                <ChatPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* Login Page - Public Only */}
                    <Route
                        path="/login"
                        element={
                            <PublicRoute>
                                {/* Pass login success handler */}
                                <LoginPage onLoginSuccess={handleLoginSuccess} />
                            </PublicRoute>
                        }
                    />

                    {/* Signup Page - Public Only */}
                    <Route
                        path="/signup"
                        element={
                            <PublicRoute>
                                <SignupPage />
                            </PublicRoute>
                        }
                    />

                    {/* Fallback Route for unmatched paths */}
                    {/* Redirects to home if logged in, or login if not logged in */}
                    <Route path="*" element={<Navigate to={currentUser ? "/" : "/login"} replace />} />
                </Routes>
            </main>
        </Router>
    );
}

export default App;