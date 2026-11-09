import React, { useState, useEffect, useCallback, memo } from 'react';

// Error boundary for catching and handling React errors
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    
    // Log error to monitoring service
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Send error to error tracking service
    this.trackError(error, errorInfo);
  }

  trackError = (error, errorInfo) => {
    // In production, send to error tracking service
    if (import.meta.env?.PROD) {
      // Example: Sentry, LogRocket, etc.
      console.error('Error tracked:', error, errorInfo);
    }
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          padding: '20px',
          border: '1px solid #ff4444',
          borderRadius: '8px',
          background: '#ffeeee',
          color: '#cc0000',
        }}>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          {this.props.showDetails && (
            <details style={{ marginTop: '16px' }}>
              <summary>Error Details</summary>
              <pre style={{ 
                background: '#fff', 
                padding: '12px', 
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto',
                maxHeight: '300px',
              }}>
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Error boundary wrapper component
export const ErrorBoundaryWrapper = memo(({ 
  children, 
  fallback,
  onError,
  showDetails = false 
}) => {
  return (
    <ErrorBoundary 
      fallback={fallback}
      onError={onError}
      showDetails={showDetails}
    >
      {children}
    </ErrorBoundary>
  );
});

ErrorBoundaryWrapper.displayName = 'ErrorBoundaryWrapper';

// Hook for error tracking and recovery
export function useErrorTracking(options = {}) {
  const [errors, setErrors] = useState([]);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [isRecovering, setIsRecovering] = useState(false);
  
  const { 
    maxRecoveryAttempts = 3,
    onError,
    onRecovery,
    enableAutoRecovery = true 
  } = options;

  const attemptRecovery = useCallback((errorInfo) => {
    setIsRecovering(true);
    
    // Simulate recovery attempt
    setTimeout(() => {
      setRecoveryAttempts(prev => prev + 1);
      setIsRecovering(false);
      
      onRecovery?.(errorInfo);
      
      // Remove error from tracking if recovered
      setErrors(prev => prev.filter(e => e.id !== errorInfo.id));
    }, 1000);
  }, [onRecovery]);

  const trackError = useCallback((error, context = {}) => {
    const errorWithInfo = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      timestamp: new Date().toISOString(),
      error,
      context,
      stack: error?.stack,
      recoveryAttempts: 0,
    };

    setErrors(prev => [...prev, errorWithInfo]);
    onError?.(errorWithInfo);

    // Auto-recovery logic
    if (enableAutoRecovery && recoveryAttempts < maxRecoveryAttempts) {
      attemptRecovery(errorWithInfo);
    }

    return errorWithInfo.id;
  }, [onError, enableAutoRecovery, recoveryAttempts, maxRecoveryAttempts, attemptRecovery]);

  const clearErrors = useCallback(() => {
    setErrors([]);
    setRecoveryAttempts(0);
  }, []);

  return {
    errors,
    recoveryAttempts,
    isRecovering,
    trackError,
    attemptRecovery,
    clearErrors,
    canRecover: recoveryAttempts < maxRecoveryAttempts,
  };
}

// Circuit breaker pattern for preventing cascading failures
export function useCircuitBreaker(options = {}) {
  const { 
    failureThreshold = 5,
    resetTimeout = 60000,
    monitoringInterval = 10000 
  } = options;

  const [state, setState] = useState('CLOSED'); // CLOSED, OPEN, HALF_OPEN
  const [failureCount, setFailureCount] = useState(0);
  const [lastFailureTime, setLastFailureTime] = useState(null);
  const [successCount, setSuccessCount] = useState(0);

  const recordFailure = useCallback(() => {
    const now = Date.now();
    setFailureCount(prev => prev + 1);
    setLastFailureTime(now);

    if (failureCount + 1 >= failureThreshold) {
      setState('OPEN');
    }
  }, [failureCount, failureThreshold]);

  const recordSuccess = useCallback(() => {
    setSuccessCount(prev => prev + 1);
    
    if (state === 'HALF_OPEN' && successCount >= 3) {
      setState('CLOSED');
      setFailureCount(0);
      setSuccessCount(0);
    }
  }, [state, successCount]);

  const execute = useCallback(async (operation, fallback) => {
    if (state === 'OPEN') {
      if (Date.now() - lastFailureTime > resetTimeout) {
        setState('HALF_OPEN');
      } else {
        return fallback?.() || Promise.reject(new Error('Circuit breaker is OPEN'));
      }
    }

    try {
      const result = await operation();
      recordSuccess();
      return result;
    } catch (error) {
      recordFailure();
      throw error;
    }
  }, [state, lastFailureTime, resetTimeout, recordSuccess, recordFailure]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (state === 'OPEN' && Date.now() - lastFailureTime > resetTimeout) {
        setState('HALF_OPEN');
      }
    }, monitoringInterval);

    return () => clearInterval(interval);
  }, [state, lastFailureTime, resetTimeout, monitoringInterval]);

  return {
    state,
    execute,
    failureCount,
    successCount,
    reset: () => {
      setState('CLOSED');
      setFailureCount(0);
      setSuccessCount(0);
    },
  };
}

// Retry mechanism with exponential backoff
export function useRetry(options = {}) {
  const { 
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    onRetry 
  } = options;

  const [attempts, setAttempts] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastError, setLastError] = useState(null);

  const retry = useCallback(async (operation, fallback) => {
    let currentAttempt = attempts;

    setIsRetrying(true);

    while (currentAttempt < maxAttempts) {
      try {
        const result = await operation();
        setAttempts(0);
        setIsRetrying(false);
        return result;
      } catch (error) {
        setLastError(error);
        currentAttempt += 1;
        setAttempts(currentAttempt);

        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelay * Math.pow(backoffFactor, currentAttempt - 1),
          maxDelay
        );

        onRetry?.(error, currentAttempt, delay);

        if (currentAttempt < maxAttempts) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    setIsRetrying(false);
    const fallbackResult = fallback ? await fallback() : undefined;
    if (!fallbackResult) {
      throw new Error('Max retry attempts reached');
    }
    return fallbackResult;
  }, [attempts, maxAttempts, initialDelay, maxDelay, backoffFactor, onRetry]);

  const reset = useCallback(() => {
    setAttempts(0);
    setIsRetrying(false);
    setLastError(null);
  }, []);

  return {
    retry,
    attempts,
    isRetrying,
    lastError,
    reset,
    canRetry: attempts < maxAttempts,
  };
}

// Loading state management with error handling
export function useAsyncOperation(initialState = 'idle') {
  const [state, setState] = useState(initialState); // idle, loading, success, error
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const execute = useCallback(async (asyncOperation, options = {}) => {
    const { 
      onSuccess, 
      onError, 
      onFinally,
      timeout = 5000 
    } = options;

    setState('loading');
    setData(null);
    setError(null);

    try {
      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), timeout);
      });

      // Race between actual operation and timeout
      const result = await Promise.race([asyncOperation(), timeoutPromise]);
      
      setData(result);
      setState('success');
      onSuccess?.(result);
      
      return result;
    } catch (err) {
      setError(err);
      setState('error');
      onError?.(err);
      throw err;
    } finally {
      onFinally?.();
      setState('idle');
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
    setData(null);
    setError(null);
  }, [initialState]);

  return {
    state,
    data,
    error,
    execute,
    reset,
    isLoading: state === 'loading',
    isSuccess: state === 'success',
    isError: state === 'error',
  };
}