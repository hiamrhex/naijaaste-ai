import { useState, useEffect, useRef, useCallback, memo } from 'react';

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
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isValid, setIsValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  // Validate form against schema
  const validateForm = useCallback(() => {
    const newErrors = {};
    let formValid = true;

    Object.keys(schema).forEach(fieldName => {
      const fieldSchema = schema[fieldName];
      const value = values[fieldName];

      // Required validation
      if (fieldSchema.required && !value) {
        newErrors[fieldName] = `${fieldSchema.label || fieldName} is required`;
        formValid = false;
        return;
      }

      // Type validation
      if (value && fieldSchema.type) {
        if (fieldSchema.type === 'email' && !isValidEmail(value)) {
          newErrors[fieldName] = 'Please enter a valid email address';
          formValid = false;
          return;
        }

        if (fieldSchema.type === 'url' && !isValidUrl(value)) {
          newErrors[fieldName] = 'Please enter a valid URL';
          formValid = false;
          return;
        }

        if (fieldSchema.type === 'number' && isNaN(Number(value))) {
          newErrors[fieldName] = 'Please enter a valid number';
          formValid = false;
          return;
        }
      }

      // Min/max validation
      if (value && fieldSchema.minLength && value.length < fieldSchema.minLength) {
        newErrors[fieldName] = `${fieldSchema.label || fieldName} must be at least ${fieldSchema.minLength} characters`;
        formValid = false;
        return;
      }

      if (value && fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
        newErrors[fieldName] = `${fieldSchema.label || fieldName} must be no more than ${fieldSchema.maxLength} characters`;
        formValid = false;
        return;
      }

      // Pattern validation
      if (value && fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
        newErrors[fieldName] = fieldSchema.message || `${fieldSchema.label || fieldName} is invalid`;
        formValid = false;
        return;
      }

      // Custom validation
      if (fieldSchema.validate && typeof fieldSchema.validate === 'function') {
        const customError = fieldSchema.validate(value);
        if (customError) {
          newErrors[fieldName] = customError;
          formValid = false;
          return;
        }
      }
    });

    setErrors(newErrors);
    setIsValid(formValid);
    return formValid;
  }, [schema, values]);

  // Validate individual field
  const validateField = useCallback((fieldName, value) => {
    const fieldSchema = schema[fieldName];
    if (!fieldSchema) return null;

    // Required validation
    if (fieldSchema.required && !value) {
      return `${fieldSchema.label || fieldName} is required`;
    }

    // Type validation
    if (value && fieldSchema.type) {
      if (fieldSchema.type === 'email' && !isValidEmail(value)) {
        return 'Please enter a valid email address';
      }

      if (fieldSchema.type === 'url' && !isValidUrl(value)) {
        return 'Please enter a valid URL';
      }

      if (fieldSchema.type === 'number' && isNaN(Number(value))) {
        return 'Please enter a valid number';
      }
    }

    // Min/max validation
    if (value && fieldSchema.minLength && value.length < fieldSchema.minLength) {
      return `${fieldSchema.label || fieldName} must be at least ${fieldSchema.minLength} characters`;
    }

    if (value && fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
      return `${fieldSchema.label || fieldName} must be no more than ${fieldSchema.maxLength} characters`;
    }

    // Pattern validation
    if (value && fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
      return fieldSchema.message || `${fieldSchema.label || fieldName} is invalid`;
    }

    // Custom validation
    if (fieldSchema.validate && typeof fieldSchema.validate === 'function') {
      return fieldSchema.validate(value);
    }

    return null;
  }, [schema]);

  // Handle value changes
  const handleChange = useCallback((fieldName, value) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    setTouched(prev => ({ ...prev, [fieldName]: true }));

    if (validateOnChange) {
      const error = validateField(fieldName, value);
      setErrors(prev => ({ ...prev, [fieldName]: error }));
    }
  }, [validateField, validateOnChange]);

  // Handle blur events
  const handleBlur = useCallback((fieldName) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));

    if (validateOnBlur) {
      const error = validateField(fieldName, values[fieldName]);
      setErrors(prev => ({ ...prev, [fieldName]: error }));
    }
  }, [validateField, validateOnBlur, values]);

  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();

    if (validateOnSubmit) {
      const isValidForm = validateForm();
      if (!isValidForm) {
        onError?.(errors);
        return;
      }
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
  }, [validateForm, onSubmit, onError, errors, values, validateOnSubmit]);

  // Reset form
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsValid(false);
    setIsSubmitting(false);
    setSubmitCount(0);
  }, [initialValues]);

  // Get field error
  const getFieldError = useCallback((fieldName) => {
    return errors[fieldName] || (touched[fieldName] ? null : undefined);
  }, [errors, touched]);

  // Check if field is valid
  const isFieldValid = useCallback((fieldName) => {
    return !errors[fieldName] && touched[fieldName];
  }, [errors, touched]);

  // Check if field is invalid
  const isFieldInvalid = useCallback((fieldName) => {
    return !!errors[fieldName] && touched[fieldName];
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

  // Auto-validate when values change
  useEffect(() => {
    validateForm();
  }, [values, validateForm]);

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