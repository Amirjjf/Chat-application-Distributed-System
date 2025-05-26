import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    const isDevelopment = import.meta.env.MODE !== 'production';

    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="error-boundary">
          <p>We're sorry for the inconvenience. Please try refreshing the page.</p>
          {isDevelopment && this.state.error && (
            <div className="error-details">
              <h3>Error Details:</h3>
              <p>{this.state.error.toString()}</p>
              <div className="stack-trace">
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </div>
            </div>
          )}
          <button 
            className="retry-button" 
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    // If there's no error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;
