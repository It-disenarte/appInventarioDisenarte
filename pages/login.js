import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al iniciar sesión.'); setLoading(false); return; }
      router.push('/');
    } catch (e) {
      setError('No se pudo conectar. Intenta de nuevo.');
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "'Outfit', system-ui, sans-serif", minHeight: '100vh', background: 'radial-gradient(circle at 20% 15%, #FBD9F2 0%, #FDF8FB 45%, #FDF8FB 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 24, padding: '40px 32px', boxShadow: '0 12px 40px rgba(165,54,146,0.12)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #A53692, #7C07A6)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <span style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>I</span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#1D1B1E', marginBottom: 2 }}>Bienvenido</div>
        <div style={{ fontSize: 14, color: '#96989A', marginBottom: 28 }}>Inicia sesión en Inventario · Diseñarte México</div>

        <label style={{ fontSize: 13, color: '#96989A', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          Correo
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@disenartemx.com" style={{ border: '1px solid #F1EEF0', borderRadius: 10, padding: '12px 14px', fontSize: 15, fontFamily: 'inherit', outline: 'none' }} />
        </label>
        <label style={{ fontSize: 13, color: '#96989A', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          Contraseña
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ border: '1px solid #F1EEF0', borderRadius: 10, padding: '12px 14px', fontSize: 15, fontFamily: 'inherit', outline: 'none' }} />
        </label>

        {error ? <div style={{ fontSize: 13, color: '#B3261E', marginTop: 10 }}>{error}</div> : null}

        <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 22, border: 'none', background: loading ? '#C98FC0' : '#A53692', color: '#fff', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 600, cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {loading && <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.5)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />}
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
