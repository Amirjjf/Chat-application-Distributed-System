import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ChatPage from './pages/ChatPage';
import SessionTimeoutAlert from './components/SessionTimeoutAlert';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingIndicator from './components/LoadingIndicator';
import authApi from './services/authApi';
import './App.css';

const ProtectedRoute = React.memo(({ children }) => {
    const user = authApi.getCurrentUser();
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    return children;
});

const PublicRoute = ({ children }) => {
    const user = authApi.getCurrentUser();
    if (user) {
        return <Navigate to="/" replace />;
    }
    return children;
};

function App() {
    const [currentUser, setCurrentUser] = useState(() => authApi.getCurrentUser());

    const syncAuthState = useCallback(() => {
        const user = authApi.getCurrentUser();
        setCurrentUser((prevUser) => {
            if (prevUser?.id === user?.id) {
                return prevUser;
            }
            return user;
        });
    }, []);

    useEffect(() => {
        syncAuthState();

        const handleStorageChange = (event) => {
            if (event.key === 'user' || event.key === 'token') {
                syncAuthState();
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [syncAuthState]);

    useEffect(() => {
        const unsubscribe = authApi.subscribeToAuthChanges((updatedUser) => {
            setCurrentUser(updatedUser);
        });

        return () => unsubscribe();
    }, []);

    const handleLoginSuccess = () => {
        syncAuthState();
    };

    const handleLogout = () => {
        authApi.logout();
        syncAuthState();
    };

    return (
        <ErrorBoundary>
            <LoadingIndicator />
            <Router>
                <nav className="app-nav">
                    <div className="nav-links">
                        <Link to="/">Home</Link>
                        {currentUser && <Link to="/chat">Chat</Link>}
                        {!currentUser && (
                            <>
                                <Link to="/login">Login</Link>
                                <Link to="/signup">Sign Up</Link>
                            </>
                        )}
                    </div>

                    {currentUser && (
                        <div className="nav-user-section">
                            <span className="nav-user-name">Welcome, {currentUser.name}!</span>
                            <button onClick={handleLogout} className="nav-logout-btn">Logout</button>
                        </div>
                    )}
                </nav>                <main className="app-content">
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <ErrorBoundary>
                                        <HomePage onLogout={handleLogout} />
                                    </ErrorBoundary>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/chat"
                            element={
                                <ProtectedRoute>
                                    <ErrorBoundary>
                                        <ChatPage />
                                    </ErrorBoundary>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/login"
                            element={
                                <PublicRoute>
                                    <ErrorBoundary>
                                        <LoginPage onLoginSuccess={handleLoginSuccess} />
                                    </ErrorBoundary>
                                </PublicRoute>
                            }
                        />

                        <Route
                            path="/signup"
                            element={
                                <PublicRoute>
                                    <ErrorBoundary>
                                        <SignupPage />
                                    </ErrorBoundary>
                                </PublicRoute>
                            }
                        />

                        <Route path="*" element={<Navigate to={currentUser ? "/" : "/login"} replace />} />
                    </Routes>
                </main>
                
                {/* Show session timeout alert only for authenticated users */}
                {currentUser && <SessionTimeoutAlert onLogout={handleLogout} />}
            </Router>
        </ErrorBoundary>
    );
}

export default App;