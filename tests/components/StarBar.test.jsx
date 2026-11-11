// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StarBar } from '../../src/components/StarBar.jsx';

describe('StarBar', () => {
  it('shows the rating to one decimal place', () => {
    const { container } = render(<StarBar rating={4.3} />);
    expect(container.textContent).toContain('4.3');
  });

  it('renders zero for a missing rating', () => {
    const { container } = render(<StarBar rating={null} />);
    expect(container.textContent).toContain('0.0');
  });

  it('accepts numeric strings from an API payload', () => {
    const { container } = render(<StarBar rating="3.6" />);
    expect(container.textContent).toContain('3.6');
  });

  it('never renders NaN', () => {
    const { container } = render(<StarBar rating={Number.NaN} />);
    expect(container.textContent).not.toContain('NaN');
    expect(container.textContent).toContain('0.0');
  });
});
