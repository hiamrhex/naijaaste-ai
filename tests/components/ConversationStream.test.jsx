// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ConversationStream } from '../../src/screens/ConversationStream.jsx';

// This suite does not enable Vitest globals, so Testing Library's automatic
// cleanup never runs. Without it the first test's DOM stays mounted in
// document.body and document-wide queries in later tests see stale nodes.
afterEach(() => {
  cleanup();
});

// Regression: "Try again" called generateReview (the review generator) with a
// chat message string, so the request 400'd and the retry looked dead. It must
// re-send the original chat message.
describe('ConversationStream retry', () => {
  it('re-sends the failed message through onRetry', () => {
    const onRetry = vi.fn();
    const { getByRole } = render(
      <ConversationStream
        messages={[{
          role: 'assistant',
          content: 'The server had a problem completing that request.',
          error: true,
          retryText: 'Where can I eat jollof in Lagos?',
        }]}
        loading={false}
        onRetry={onRetry}
      />
    );

    fireEvent.click(getByRole('button', { name: /try again/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith('Where can I eat jollof in Lagos?');
  });

  it('hides the retry button for non-error messages', () => {
    const { queryByRole } = render(
      <ConversationStream
        messages={[{ role: 'assistant', content: 'Here are three spots.' }]}
        loading={false}
        onRetry={() => {}}
      />
    );

    expect(queryByRole('button', { name: /try again/i })).toBeNull();
  });
});
