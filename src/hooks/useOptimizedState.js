import { useState, useEffect, useRef, useCallback, memo } from 'react';

// Optimized state management for frequently updated values
export function useOptimizedState(initialValue, options = {}) {
  const { 
    debounceMs = 0, 
    throttleMs = 0, 
    maxUpdates = 100,
    onOptimizedUpdate 
  } = options;

  const [value, setValue] = useState(initialValue);
  const [pendingValue, setPendingValue] = useState(null);
  const updateCountRef = useRef(0);
  const timeoutRef = useRef();
  const lastUpdateRef = useRef(0);

  // Debounced update
  useEffect(() => {
    if (debounceMs > 0 && pendingValue !== null) {
      timeoutRef.current = setTimeout(() => {
        setValue(pendingValue);
        setPendingValue(null);
        updateCountRef.current++;
        onOptimizedUpdate?.(pendingValue, updateCountRef.current);
      }, debounceMs);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [pendingValue, debounceMs, onOptimizedUpdate]);

  // Throttled update
  const throttledSetValue = useCallback((newValue) => {
    const now = Date.now();
    
    if (throttleMs > 0 && now - lastUpdateRef.current < throttleMs) {
      setPendingValue(newValue);
      return;
    }

    setValue(newValue);
    lastUpdateRef.current = now;
    updateCountRef.current++;
    onOptimizedUpdate?.(newValue, updateCountRef.current);

    // Reset counter if max updates reached
    if (updateCountRef.current >= maxUpdates) {
      updateCountRef.current = 0;
    }
  }, [throttleMs, maxUpdates, onOptimizedUpdate]);

  const immediateSetValue = useCallback((newValue) => {
    setValue(newValue);
    setPendingValue(null);
    updateCountRef.current++;
    onOptimizedUpdate?.(newValue, updateCountRef.current);
  }, [onOptimizedUpdate]);

  return {
    value,
    setValue: throttledSetValue,
    immediateSetValue,
    pendingValue,
    updateCount: updateCountRef.current,
  };
}

// Batch state updates for better performance
export function useBatchState(initialState) {
  const [state, setState] = useState(initialState);
  const batchQueueRef = useRef([]);
  const isBatchingRef = useRef(false);

  const batch = useCallback((updater) => {
    return new Promise((resolve) => {
      batchQueueRef.current.push({ updater, resolve });
      
      if (!isBatchingRef.current) {
        isBatchingRef.current = true;
        
        // Use setTimeout to allow multiple batch updates to queue up
        setTimeout(() => {
          const batch = [...batchQueueRef.current];
          batchQueueRef.current = [];
          isBatchingRef.current = false;

          // Apply all updates in batch
          const newState = { ...state };
          batch.forEach(({ updater, resolve }) => {
            const result = updater(newState);
            if (result !== undefined) {
              Object.assign(newState, result);
            }
            resolve();
          });

          setState(newState);
        }, 0);
      }
    });
  }, [state]);

  const updateState = useCallback((updater) => {
    setState(prev => {
      const newState = typeof updater === 'function' ? updater(prev) : updater;
      return newState !== prev ? newState : prev;
    });
  }, []);

  return {
    state,
    setState: updateState,
    batch,
  };
}

// Memoized state with custom comparison
export function useMemoizedState(initialValue, compareFn = (a, b) => a === b) {
  const [value, setValue] = useState(initialValue);
  const memoizedValueRef = useRef(value);

  const setValueIfDifferent = useCallback((newValue) => {
    if (!compareFn(newValue, memoizedValueRef.current)) {
      memoizedValueRef.current = newValue;
      setValue(newValue);
    }
  }, [compareFn]);

  return [value, setValueIfDifferent];
}

// Optimized form state management
export function useFormState(initialState, options = {}) {
  const { 
    validateOnChange = false, 
    validateOnBlur = true,
    onSubmit 
  } = options;

  const [state, setState] = useBatchState(initialState);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isValid, setIsValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = useCallback((name, value) => {
    const field = initialState[name];
    const rules = field?.validation || {};
    
    if (rules.required && !value) {
      return `${field?.label || name} is required`;
    }
    
    if (rules.minLength && value.length < rules.minLength) {
      return `${field?.label || name} must be at least ${rules.minLength} characters`;
    }
    
    if (rules.pattern && !rules.pattern.test(value)) {
      return rules.message || `${field?.label || name} is invalid`;
    }
    
    return null;
  }, [initialState]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    let formValid = true;

    Object.keys(initialState).forEach(name => {
      const error = validateField(name, state[name]);
      if (error) {
        newErrors[name] = error;
        formValid = false;
      }
    });

    setErrors(newErrors);
    setIsValid(formValid);
    return formValid;
  }, [state, initialState, validateField]);

  const handleChange = useCallback((name, value) => {
    setState(prev => ({ ...prev, [name]: value }));
    
    if (validateOnChange) {
      const error = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  }, [setState, validateField, validateOnChange]);

  const handleBlur = useCallback((name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    
    if (validateOnBlur) {
      const error = validateField(name, state[name]);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  }, [state, validateField, validateOnBlur]);

  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    
    const formValid = validateForm();
    if (!formValid) return;

    setIsSubmitting(true);
    
    try {
      await onSubmit?.(state);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [state, validateForm, onSubmit]);

  const resetForm = useCallback(() => {
    setState(initialState);
    setErrors({});
    setTouched({});
    setIsValid(false);
    setIsSubmitting(false);
  }, [initialState, setState]);

  return {
    state,
    errors,
    touched,
    isValid,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
  };
}

// Optimized counter for performance testing
export function useOptimizedCounter(initialValue = 0, options = {}) {
  const { 
    maxUpdates = 1000, 
    interval = 16, // ~60fps
    onCountUpdate 
  } = options;

  const [count, setCount] = useState(initialValue);
  const [isRunning, setIsRunning] = useState(false);
  const requestRef = useRef();
  const lastUpdateRef = useRef(0);
  const updateCountRef = useRef(0);

  const start = useCallback(() => {
    if (isRunning) return;
    
    setIsRunning(true);
    lastUpdateRef.current = performance.now();
    updateCountRef.current = 0;
    
    const update = (currentTime) => {
      const elapsed = currentTime - lastUpdateRef.current;
      
      if (elapsed >= interval) {
        setCount(prev => {
          const newCount = prev + 1;
          updateCountRef.current++;
          onCountUpdate?.(newCount, updateCountRef.current);
          
          if (updateCountRef.current >= maxUpdates) {
            stop();
            return newCount;
          }
          
          return newCount;
        });
        
        lastUpdateRef.current = currentTime;
      }
      
      if (isRunning) {
        requestRef.current = requestAnimationFrame(update);
      }
    };
    
    requestRef.current = requestAnimationFrame(update);
  }, [isRunning, interval, maxUpdates, onCountUpdate]);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setCount(initialValue);
    updateCountRef.current = 0;
  }, [initialValue, stop]);

  const increment = useCallback(() => {
    setCount(prev => prev + 1);
  }, []);

  const decrement = useCallback(() => {
    setCount(prev => prev - 1);
  }, []);

  useEffect(() => {
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  return {
    count,
    isRunning,
    start,
    stop,
    reset,
    increment,
    decrement,
    updateCount: updateCountRef.current,
  };
}