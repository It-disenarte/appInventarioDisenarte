import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
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

  const input = { border: '1px solid #E4E4E5', borderRadius: 10, padding: '12px 14px', fontSize: 15, fontFamily: 'inherit', outline: 'none', color: '#1D1B1E', background: '#fff' };

  return (
    <div style={{ fontFamily: "'Outfit', system-ui, sans-serif", minHeight: '100vh', background: '#F7F7F8', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 6, background: 'linear-gradient(90deg, #5CC6D0 0%, #A53692 100%)' }} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <form onSubmit={submit} style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 20, padding: '40px 32px 32px', boxShadow: '0 12px 40px rgba(165,54,146,0.10)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <img src="/icon.svg" alt="Inventario" style={{ width: 72, height: 72 }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#1D1B1E', textAlign: 'center', marginBottom: 4 }}>Inventario</div>
          <div style={{ fontSize: 14, color: '#96989A', textAlign: 'center', marginBottom: 28 }}>Inicia sesión con tu cuenta</div>

          <label style={{ fontSize: 13, color: '#96989A', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            Correo
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@disenartemx.com" style={input} />
          </label>
          <label style={{ fontSize: 13, color: '#96989A', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            Contraseña
            <div style={{ position: 'relative', display: 'flex' }}>
              <input type={showPw ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ ...input, flex: 1, paddingRight: 70 }} />
              <button type="button" onClick={() => setShowPw((v) => !v)} style={{ position: 'absolute', right: 8, top: 0, bottom: 0, border: 'none', background: 'none', color: '#A53692', fontSize: 12, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>{showPw ? 'Ocultar' : 'Ver'}</button>
            </div>
          </label>

          {error ? <div style={{ fontSize: 13, color: '#B3261E', marginTop: 10 }}>{error}</div> : null}

          <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 22, border: 'none', background: loading ? '#C98FC0' : '#A53692', color: '#fff', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {loading && <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.5)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: '#96989A', padding: '0 0 20px' }}>disenartemx.com</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
