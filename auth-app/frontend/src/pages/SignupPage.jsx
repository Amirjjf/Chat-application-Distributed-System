import React from 'react';
import SignupForm from '../components/SignupForm';
import { Link } from 'react-router-dom';

function SignupPage() {
    return (
        <div className="page-container">
            <SignupForm />
            <p className="page-link-text">
                Already have an account? <Link to="/login">Login here</Link>
            </p>
        </div>
    );
}

export default SignupPage;