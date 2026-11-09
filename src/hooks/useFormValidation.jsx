import { useState, useCallback, useMemo, memo } from 'react';

function computeValidation(schema, values) {
  const errors = {};
  let isValid = true;

  Object.keys(schema).forEach(fieldName => {
    const fieldSchema = schema[fieldName];
    const value = values[fieldName];

    // Required validation
    if (fieldSchema.required && !value) {
      errors[fieldName] = `${fieldSchema.label || fieldName} is required`;
      isValid = false;
      return;
    }

    // Type validation
    if (value && fieldSchema.type) {
      if (fieldSchema.type === 'email' && !isValidEmail(value)) {
        errors[fieldName] = 'Please enter a valid email address';
        isValid = false;
        return;
      }

      if (fieldSchema.type === 'url' && !isValidUrl(value)) {
        errors[fieldName] = 'Please enter a valid URL';
        isValid = false;
        return;
      }

      if (fieldSchema.type === 'number' && isNaN(Number(value))) {
        errors[fieldName] = 'Please enter a valid number';
        isValid = false;
        return;
      }
    }

    // Min/max validation
    if (value && fieldSchema.minLength && value.length < fieldSchema.minLength) {
      errors[fieldName] = `${fieldSchema.label || fieldName} must be at least ${fieldSchema.minLength} characters`;
      isValid = false;
      return;
    }

    if (value && fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
      errors[fieldName] = `${fieldSchema.label || fieldName} must be no more than ${fieldSchema.maxLength} characters`;
      isValid = false;
      return;
    }

    // Pattern validation
    if (value && fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
      errors[fieldName] = fieldSchema.message || `${fieldSchema.label || fieldName} is invalid`;
      isValid = false;
      return;
    }

    // Custom validation
    if (fieldSchema.validate && typeof fieldSchema.validate === 'function') {
      const customError = fieldSchema.validate(value);
      if (customError) {
        errors[fieldName] = customError;
        isValid = false;
      }
    }
  });

  return { errors, isValid };
}


// Form validation hook with comprehensive validation rules
export function useFormValidation(schema, options = {}) {
  const { 
    initialValues = {},
    onSubmit,
    onError,
    validateOnChange = true,
    validateOnBlur = true,
    validateOnSubmit = true 
  } = options;

  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  // Validation is derived from values so it can never drift out of sync
  const { errors, isValid } = useMemo(
    () => computeValidation(schema, values),
    [schema, values]
  );

  // Handle value changes
  const handleChange = useCallback((fieldName, value) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    if (validateOnChange) {
      setTouched(prev => ({ ...prev, [fieldName]: true }));
    }
  }, [validateOnChange]);

  // Handle blur events
  const handleBlur = useCallback((fieldName) => {
    if (validateOnBlur) {
      setTouched(prev => ({ ...prev, [fieldName]: true }));
    }
  }, [validateOnBlur]);

  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();

    if (validateOnSubmit && !isValid) {
      const touchedFields = Object.fromEntries(
        Object.keys(schema).map(fieldName => [fieldName, true])
      );
      setTouched(touchedFields);
      onError?.(errors);
      return;
    }

    setIsSubmitting(true);
    setSubmitCount(prev => prev + 1);

    try {
      await onSubmit?.(values);
    } catch (error) {
      console.error('Form submission error:', error);
      onError?.(error, values);
    } finally {
      setIsSubmitting(false);
    }
  }, [schema, isValid, onSubmit, onError, errors, values, validateOnSubmit]);

  // Reset form
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setTouched({});
    setIsSubmitting(false);
    setSubmitCount(0);
  }, [initialValues]);

  // Get field error
  const getFieldError = useCallback((fieldName) => {
    return errors[fieldName] || (touched[fieldName] ? null : undefined);
  }, [errors, touched]);

  // Check if field is valid
  const isFieldValid = useCallback((fieldName) => {
    return !errors[fieldName] && Boolean(touched[fieldName]);
  }, [errors, touched]);

  // Check if field is invalid
  const isFieldInvalid = useCallback((fieldName) => {
    return Boolean(errors[fieldName]) && Boolean(touched[fieldName]);
  }, [errors, touched]);

  // Get form validation summary
  const getValidationSummary = useCallback(() => {
    const errorFields = Object.keys(errors).filter(key => errors[key]);
    const touchedFields = Object.keys(touched).filter(key => touched[key]);
    
    return {
      isValid,
      isSubmitting,
      submitCount,
      errorCount: errorFields.length,
      touchedCount: touchedFields.length,
      errorFields,
      touchedFields,
      errors,
    };
  }, [isValid, isSubmitting, submitCount, errors, touched]);

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    submitCount,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    getFieldError,
    isFieldValid,
    isFieldInvalid,
    getValidationSummary,
  };
}

// Email validation helper
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// URL validation helper
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Validation schema builder
export const ValidationSchema = {
  // Field validators
  field: (config) => config,
  
  // Common field types
  email: (label, options = {}) => ({
    type: 'email',
    label,
    required: options.required || false,
    ...options,
  }),
  
  url: (label, options = {}) => ({
    type: 'url',
    label,
    required: options.required || false,
    ...options,
  }),
  
  number: (label, options = {}) => ({
    type: 'number',
    label,
    required: options.required || false,
    min: options.min,
    max: options.max,
    ...options,
  }),
  
  text: (label, options = {}) => ({
    type: 'text',
    label,
    required: options.required || false,
    minLength: options.minLength,
    maxLength: options.maxLength,
    pattern: options.pattern,
    ...options,
  }),
  
  password: (label, options = {}) => ({
    type: 'password',
    label,
    required: options.required || false,
    minLength: options.minLength || 8,
    ...options,
  }),
  
  // Custom validators
  custom: (label, validateFn, options = {}) => ({
    label,
    validate: validateFn,
    required: options.required || false,
    ...options,
  }),
};

// Form field components
export const FormField = memo(({ 
  name, 
  label, 
  type = 'text', 
  value, 
  error, 
  touched, 
  onChange, 
  onBlur, 
  className = '',
  children,
  ...props 
}) => {
  const inputId = `field-${name}`;
  const hasError = error && touched;

  return (
    <div className={`form-field ${className}`}>
      {label && (
        <label htmlFor={inputId} style={{ display: 'block', marginBottom: '4px' }}>
          {label}
          {props.required && <span style={{ color: 'red' }}> *</span>}
        </label>
      )}
      
      {children || (
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          onBlur={() => onBlur(name)}
          style={{
            width: '100%',
            padding: '8px',
            border: hasError ? '1px solid #dc3545' : '1px solid #ccc',
            borderRadius: '4px',
            background: 'white',
          }}
          {...props}
        />
      )}
      
      {hasError && (
        <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px' }}>
          {error}
        </div>
      )}
    </div>
  );
});

FormField.displayName = 'FormField';

// Form validation utilities
export const ValidationUtils = {
  // Required field validator
  required: (value) => {
    if (!value || value.toString().trim() === '') {
      return 'This field is required';
    }
    return null;
  },

  // Minimum length validator
  minLength: (min) => (value) => {
    if (value && value.length < min) {
      return `Must be at least ${min} characters`;
    }
    return null;
  },

  // Maximum length validator
  maxLength: (max) => (value) => {
    if (value && value.length > max) {
      return `Must be no more than ${max} characters`;
    }
    return null;
  },

  // Pattern validator
  pattern: (regex, message) => (value) => {
    if (value && !regex.test(value)) {
      return message || 'Invalid format';
    }
    return null;
  },

  // Custom validator
  custom: (validator) => (value) => {
    return validator(value);
  },
};