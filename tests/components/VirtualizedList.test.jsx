// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { VirtualizedList } from '../../src/components/VirtualizedList.jsx';

const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Dish ${i}` }));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const scrollTo = (scroller, scrollTop) => {
  scroller.scrollTop = scrollTop;
  fireEvent.scroll(scroller);
};

describe('VirtualizedList', () => {
  it('renders only the window of rows around the viewport', () => {
    const { container } = render(
      <VirtualizedList items={items} renderItem={(item) => item.name} />
    );

    expect(container.textContent).toContain('Dish 0');
    expect(container.textContent).not.toContain('Dish 99');
  });

  it('keeps the scrolling indicator visible while the user scrolls', () => {
    const { container } = render(
      <VirtualizedList items={items} renderItem={(item) => item.name} />
    );
    const scroller = container.querySelector('.virtualized-container');

    scrollTo(scroller, 120);
    expect(scroller.children).toHaveLength(2);

    // One animation frame used to clear the indicator immediately, which made
    // it flash for ~16ms instead of tracking the scroll.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(scroller.children).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(scroller.children).toHaveLength(1);
  });

  it('never renders an invalid progress width for an empty list', () => {
    const { container } = render(
      <VirtualizedList items={[]} renderItem={(item) => item.name} />
    );
    const scroller = container.querySelector('.virtualized-container');

    scrollTo(scroller, 50);

    const bar = scroller.children[1].firstElementChild;
    expect(bar.style.width).toBe('0%');
    expect(bar.style.width).not.toContain('NaN');
    expect(bar.style.width).not.toContain('Infinity');
  });

  it('renders every row once, with the caller-supplied element', () => {
    let renders = 0;
    const { container } = render(
      <VirtualizedList
        items={items.slice(0, 5)}
        containerHeight={400}
        renderItem={(item) => {
          renders += 1;
          return <span data-testid={`row-${item.id}`}>{item.name}</span>;
        }}
      />
    );

    expect(renders).toBe(5);
    expect(container.querySelectorAll('[data-testid^="row-"]')).toHaveLength(5);
  });
});
