export default function LoadingScreen({ label }) {
  return (
    <div style={{ fontFamily: "'Outfit', system-ui, sans-serif", minHeight: '100vh', background: '#FDF8FB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 44, height: 44, border: '4px solid #F1EEF0', borderTopColor: '#A53692', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ fontSize: 14, color: '#96989A' }}>{label || 'Cargando...'}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
