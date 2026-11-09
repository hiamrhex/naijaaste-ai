// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useFormValidation } from '../../src/hooks/useFormValidation.jsx';

const schema = {
  email: { type: 'email', required: true, label: 'Email' },
  name: { required: true, label: 'Name', minLength: 2 },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useFormValidation', () => {
  it('derives validity immediately, without waiting for an effect', () => {
    const { result } = renderHook(() =>
      useFormValidation(schema, { initialValues: { email: '', name: '' } })
    );

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toEqual({
      email: 'Email is required',
      name: 'Name is required',
    });
  });

  it('recomputes errors as values change', () => {
    const { result } = renderHook(() =>
      useFormValidation(schema, { initialValues: { email: '', name: '' } })
    );

    act(() => result.current.handleChange('email', 'not-an-email'));
    expect(result.current.errors.email).toBe('Please enter a valid email address');

    act(() => result.current.handleChange('email', 'user@example.com'));
    expect(result.current.errors.email).toBeUndefined();

    act(() => result.current.handleChange('name', 'Amara'));
    expect(result.current.isValid).toBe(true);
  });

  it('only flags a field invalid once it has been touched', () => {
    const { result } = renderHook(() =>
      useFormValidation(schema, { initialValues: { email: '', name: '' } })
    );

    expect(result.current.isFieldInvalid('email')).toBe(false);

    act(() => result.current.handleBlur('email'));

    expect(result.current.getFieldError('email')).toBe('Email is required');
    expect(result.current.isFieldInvalid('email')).toBe(true);
  });

  it('blocks submit and reports errors when the form is invalid', async () => {
    const onSubmit = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation(schema, { initialValues: { email: '', name: '' }, onSubmit, onError })
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({
      email: 'Email is required',
      name: 'Name is required',
    });
  });

  it('submits when the form is valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useFormValidation(schema, {
        initialValues: { email: 'user@example.com', name: 'Amara' },
        onSubmit,
      })
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalledWith({ email: 'user@example.com', name: 'Amara' });
    expect(result.current.submitCount).toBe(1);
    expect(result.current.isSubmitting).toBe(false);
  });
});
