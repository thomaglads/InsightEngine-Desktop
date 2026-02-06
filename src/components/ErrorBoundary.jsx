import React from 'react';

/**
 * Error Boundary Component
 * Prevents component crashes from taking down the entire application
 * Provides graceful fallback UI for different component types
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Optional: Send to error tracking service
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    // Limit retry attempts to prevent infinite loops
    if (this.state.retryCount < (this.props.maxRetries || 3)) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  render() {
    if (this.state.hasError) {
      const { fallback, fallbackType = 'default' } = this.props;
      
      // Custom fallback component provided
      if (fallback) {
        return fallback(this.state.error, this.state.errorInfo, this.handleRetry);
      }

      // Type-specific fallbacks
      switch (fallbackType) {
        case 'chart':
          return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="text-red-400 mb-4">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Chart Error</h3>
              <p className="text-zinc-400 mb-4">
                {this.state.error?.message || 'Failed to render chart. Please try again.'}
              </p>
              {this.state.retryCount < 3 && (
                <button
                  onClick={this.handleRetry}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-black rounded-lg font-bold transition-colors"
                >
                  Retry ({3 - this.state.retryCount} attempts left)
                </button>
              )}
            </div>
          );

        case 'chat':
          return (
            <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg m-4">
              <div className="flex items-start gap-3">
                <div className="text-red-400 mt-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-red-400 font-bold mb-1">Chat Error</h4>
                  <p className="text-zinc-300 text-sm">
                    {this.state.error?.message || 'Something went wrong with the chat functionality.'}
                  </p>
                  {this.state.retryCount < 3 && (
                    <button
                      onClick={this.handleRetry}
                      className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-sm font-bold transition-colors"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            </div>
          );

        case 'minimal':
          return (
            <div className="p-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 text-sm">
              ⚠️ Component temporarily unavailable
            </div>
          );

        default:
        case 'default':
          return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="text-yellow-400 mb-4">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Something went wrong</h3>
              <p className="text-zinc-400 mb-4 max-w-md">
                {this.state.error?.message || 'An unexpected error occurred. The application has been stabilized.'}
              </p>
              <div className="flex gap-3">
                {this.state.retryCount < 3 && (
                  <button
                    onClick={this.handleRetry}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-black rounded-lg font-bold transition-colors"
                  >
                    Retry ({3 - this.state.retryCount} attempts left)
                  </button>
                )}
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-bold transition-colors"
                >
                  Reload Page
                </button>
              </div>
              
              {/* Debug info in development */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-zinc-500 text-sm">Debug Info</summary>
                  <pre className="mt-2 p-4 bg-zinc-900 rounded text-red-400 text-xs overflow-auto">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </div>
          );
      }
    }

    return this.props.children;
  }
}

/**
 * Hook for functional components to wrap children in error boundary
 */
export const withErrorBoundary = (Component, fallbackType = 'default') => {
  return (props) => (
    <ErrorBoundary fallbackType={fallbackType}>
      <Component {...props} />
    </ErrorBoundary>
  );
};

export default ErrorBoundary;