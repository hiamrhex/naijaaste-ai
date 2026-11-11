// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Markdown } from '../../src/components/Markdown.jsx';

describe('Markdown', () => {
  it('renders bold, italic and inline code', () => {
    const { container } = render(
      <Markdown text="Try **jollof** or *egusi* with `garri`." />
    );

    expect(container.querySelector('strong').textContent).toBe('jollof');
    expect(container.querySelector('em').textContent).toBe('egusi');
    expect(container.querySelector('code').textContent).toBe('garri');
  });

  it('leaves arithmetic asterisks alone', () => {
    const { container } = render(<Markdown text="2 * 3 * 4 = 24" />);

    expect(container.querySelector('em')).toBeNull();
    expect(container.textContent).toBe('2 * 3 * 4 = 24');
  });

  it('renders triple emphasis as bold and italic', () => {
    const { container } = render(<Markdown text="That was ***really*** good." />);

    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong.querySelector('em').textContent).toBe('really');
    expect(container.textContent).not.toContain('*');
  });

  it('groups bullet points into a single list', () => {
    const { container } = render(<Markdown text={'- jollof\n- egusi\n- suya'} />);

    const list = container.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list.querySelectorAll('li')).toHaveLength(3);
  });

  it('groups numbered points into a single list', () => {
    const { container } = render(<Markdown text={'1. jollof\n2. egusi'} />);

    const list = container.querySelector('ol');
    expect(list).not.toBeNull();
    expect(list.querySelectorAll('li')).toHaveLength(2);
  });

  it('starts a new list when the marker style changes', () => {
    const { container } = render(<Markdown text={'- jollof\n1. egusi'} />);

    expect(container.querySelector('ul').querySelectorAll('li')).toHaveLength(1);
    expect(container.querySelector('ol').querySelectorAll('li')).toHaveLength(1);
  });

  it('handles empty or missing text', () => {
    const { container } = render(<Markdown text={null} />);
    expect(container.textContent).toBe('');
  });

  it('treats HTML as text, never as markup', () => {
    const { container } = render(
      <Markdown text={'<img src=x onerror="alert(1)">'} />
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img');
  });
});
