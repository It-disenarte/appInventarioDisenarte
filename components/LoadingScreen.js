export default function LoadingScreen({ label }) {
  return (
    <div style={{ fontFamily: "'Outfit', system-ui, sans-serif", minHeight: '100vh', background: '#F7F7F8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <img src="/icon.svg" alt="Inventario" style={{ width: 56, height: 56 }} />
      <div style={{ width: 32, height: 32, border: '3px solid #E4E4E5', borderTopColor: '#A53692', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ fontSize: 14, color: '#96989A' }}>{label || 'Cargando...'}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
