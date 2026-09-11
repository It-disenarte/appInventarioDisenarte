import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Error al iniciar sesión.'); return; }
    router.push('/');
  }

  return (
    <div style={{ fontFamily: "'Outfit', system-ui, sans-serif", minHeight: '100vh', background: '#FDF8FB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 20, padding: '32px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#A53692', marginBottom: 4 }}>Inventario</div>
        <div style={{ fontSize: 13, color: '#96989A', marginBottom: 24 }}>Diseñarte México</div>
        <label style={{ fontSize: 13, color: '#96989A', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
          Correo
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ border: '1px solid #F1EEF0', borderRadius: 8, padding: '10px 12px', fontSize: 15 }} />
        </label>
        <label style={{ fontSize: 13, color: '#96989A', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ border: '1px solid #F1EEF0', borderRadius: 8, padding: '10px 12px', fontSize: 15 }} />
        </label>
        {error ? <div style={{ fontSize: 13, color: '#B3261E', marginBottom: 10 }}>{error}</div> : null}
        <button type="submit" style={{ width: '100%', border: 'none', background: '#A53692', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Entrar</button>
        <div style={{ fontSize: 12, color: '#96989A', marginTop: 20, lineHeight: 1.6 }}>
          Cuenta de administración:<br />
          it@disenartemx.com / Intothenewerait2026
        </div>
      </form>
    </div>
  );
}
