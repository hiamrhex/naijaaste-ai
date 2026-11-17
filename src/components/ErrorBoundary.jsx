import { Component } from 'react';
import { useRouteError } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// One render error used to unmount the whole tree and leave a blank white page:
// the router only had 404/403 screens, and nothing wrapped the app. This
// boundary keeps the user on a page they can act on (reload, go back) and puts
// the real error in the console where it can be diagnosed.

export function ErrorFallback() {
  return (
    <div
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg, #12100E)',
        color: 'var(--text-primary, #F5EFE6)',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          background: 'var(--bg-card, #1C1916)',
          border: '1px solid var(--border, #333)',
          borderRadius: 16,
          padding: '28px 24px',
          textAlign: 'center',
        }}
      >
        <AlertTriangle size={28} color="var(--orange, #E8892B)" aria-hidden="true" />
        <h1 style={{ fontSize: 18, margin: '14px 0 8px', fontFamily: 'var(--font-display, inherit)' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary, #C9BFAF)', margin: '0 0 20px' }}>
          This screen hit an unexpected error. Reloading usually fixes it — your saved
          spots and chats are kept.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            minHeight: 44,
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid var(--orange, #E8892B)',
            background: 'var(--orange, #E8892B)',
            color: '#FFF8F1',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          Reload page
        </button>
        <a
          href="/app"
          style={{ display: 'inline-block', marginTop: 14, fontSize: 12, color: 'var(--text-muted, #8C8377)' }}
        >
          Back to NaijaTaste
        </a>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // The fallback is deliberately generic; the detail belongs in the console
    // (and in a browser error report), not on the user's screen.
    console.error('Unhandled render error', error, info?.componentStack);
  }

  render() {
    if (this.state.error) return <ErrorFallback />;
    return this.props.children;
  }
}

// Router-level counterpart: a route element that throws is handled by
// react-router's errorElement, which never reaches the class boundary above.
export function RouteErrorScreen() {
  const error = useRouteError();
  console.error('Route error', error);
  return <ErrorFallback />;
}
