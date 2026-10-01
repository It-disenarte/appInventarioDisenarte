import { useState } from 'react';
import { useRouter } from 'next/router';
import Brand from '../components/Brand';
import { LoadingOverlay } from '../components/LoadingScreen';

const label = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: 'var(--texto)' };

// Escritorio: panel morado con la marca a la izquierda y el formulario sobre la textura.
// Celular: sin panel; la marca va centrada arriba de la tarjeta.
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

  return (
    <main className="acceso">
      {loading && <LoadingOverlay message="Entrando…" />}
      <section className="acceso-panel" style={{ flexDirection: 'column', background: 'var(--morado)', color: '#fff', padding: 40 }}>
        <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column', gap: 32 }}>
          <Brand size={76} onDark />
          <div style={{ width: 96, height: 4, borderRadius: 2, background: 'var(--filete)' }} />
          <p style={{ margin: 0, maxWidth: 320, fontSize: 18, fontWeight: 300, lineHeight: 1.4, color: 'rgba(255,255,255,.9)' }}>
            Control de materiales, insumos y herramientas de cada área.
          </p>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,.6)' }}>www.disenartemx.com</p>
      </section>

      <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: 384, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="acceso-marca-movil" style={{ justifyContent: 'center' }}>
            <Brand size={52} />
          </div>
          <form onSubmit={submit} className="tarjeta" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--morado)' }}>Iniciar sesión</h1>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--texto-3)' }}>Entra con tu correo de Diseñarte.</p>
            </div>

            <label style={label}>
              Correo
              <input className="campo" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@disenartemx.com" />
            </label>
            <label style={label}>
              Contraseña
              <div style={{ position: 'relative' }}>
                <input className="campo" type={showPw ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 84 }} />
                <button type="button" className="btn btn-fantasma btn-sm" onClick={() => setShowPw((v) => !v)} style={{ position: 'absolute', right: 5, top: 5 }}>{showPw ? 'Ocultar' : 'Ver'}</button>
              </div>
            </label>

            {error && <div role="alert" style={{ fontSize: 14, color: 'var(--error)', background: 'var(--error-fondo)', borderRadius: 8, padding: '10px 12px' }}>{error}</div>}

            <button type="submit" disabled={loading} className="btn btn-primario" style={{ width: '100%', minHeight: 42, marginTop: 4 }}>Entrar</button>
          </form>
        </div>
      </section>
    </main>
  );
}
