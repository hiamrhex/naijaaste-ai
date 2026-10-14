import { Link, useNavigate } from 'react-router-dom';

const page = {
  minHeight: '70vh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 10,
  padding: 24, textAlign: 'center',
};

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={page}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 64, color: 'var(--orange)', lineHeight: 1 }}>404</div>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, margin: 0 }}>This plate is empty.</h1>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0, maxWidth: 320 }}>
        The page you're looking for moved or never existed. Let's get you back to the food.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}
        >
          ← Go back
        </button>
        <Link
          to="/"
          style={{ background: 'var(--orange)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', minHeight: 44 }}
        >
          Home
        </Link>
      </div>
    </div>
  );
}

export function Forbidden() {
  return (
    <div style={page}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 64, color: 'var(--amber)', lineHeight: 1 }}>403</div>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, margin: 0 }}>Staff only.</h1>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0, maxWidth: 320 }}>
        Your account doesn't have admin access. If you should, ask to be added via <code>ADMIN_EMAILS</code>.
      </p>
      <Link
        to="/"
        style={{ background: 'var(--orange)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none', marginTop: 8, minHeight: 44, display: 'flex', alignItems: 'center' }}
      >
        Back home
      </Link>
    </div>
  );
}
