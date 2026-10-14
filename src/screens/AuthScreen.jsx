import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import AuthGate from '../components/AuthGate.jsx';
import { useAuth } from '../app/useAuth.js';
import { sanitizeNext } from '../lib/next.js';

/* One screen per auth URL (/login, /signup, /forgot-password): deep-linkable,
   single-purpose — the research-backed antidote to overloaded auth widgets. */
export default function AuthScreen({ mode }) {
  const { setUser } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = sanitizeNext(params.get('next') || '/');

  return (
    <div>
      <AuthGate
        initialMode={mode}
        onAuth={(u) => {
          setUser(u);
          navigate(next, { replace: true });
        }}
      />
      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-hint)', margin: '14px 0 0' }}>
        {mode === 'signin' && (
          <>New here? <Link to="/signup" style={{ color: 'var(--orange)' }}>Create an account</Link></>
        )}
        {mode === 'signup' && (
          <>Have an account? <Link to="/login" style={{ color: 'var(--orange)' }}>Sign in</Link></>
        )}
        {mode === 'forgot' && (
          <>Remembered it? <Link to="/login" style={{ color: 'var(--orange)' }}>Back to sign in</Link></>
        )}
      </p>
    </div>
  );
}
