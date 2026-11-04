// Validation functions for authentication endpoints
import { passwordProblem } from './auth/password.js';

export const validateSignup = (body) => {
  const errors = [];

  const { name, email, password } = body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 2) errors.push('name must be at least 2 characters');

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('valid email is required');

  const weak = passwordProblem(password, email);

  if (weak) errors.push(weak);
  return errors;
};

export const validateSignin = (body) => {
  const errors = [];

  const { email, password } = body || {};

  if (!email || typeof email !== 'string') errors.push('email is required');
  
  if (!password || typeof password !== 'string' || password.length < 1) errors.push('password is required');
  return errors;
};