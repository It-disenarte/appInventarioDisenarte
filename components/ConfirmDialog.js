import { useEffect, useRef } from 'react';

// Diálogo de confirmación con la identidad de Diseñarte. Reemplaza a window.confirm.
// Esc o clic fuera cancelan; el foco inicial va a "Cancelar" para no borrar por accidente con Enter.
export default function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (cancelRef.current) cancelRef.current.focus();
    function onKey(e) { if (e.key === 'Escape') onCancel(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const confirmColor = danger ? '#B3261E' : '#A53692';

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(29,27,30,0.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60, animation: 'dlgFade .15s ease-out' }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', fontFamily: "'Outfit', system-ui, sans-serif", animation: 'dlgPop .18s ease-out' }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg, #5CC6D0, #A53692)' }} />
        <div style={{ padding: '20px 22px 18px' }}>
          <div id="dlg-title" style={{ fontSize: 17, fontWeight: 600, color: '#1D1B1E', marginBottom: 8 }}>{title}</div>
          <div id="dlg-msg" style={{ fontSize: 14, lineHeight: 1.5, color: '#5E5C60', whiteSpace: 'pre-line' }}>{message}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
            <button ref={cancelRef} onClick={onCancel} style={{ border: '1px solid #E4E4E5', background: '#fff', color: '#1D1B1E', borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={onConfirm} style={{ border: 'none', background: confirmColor, color: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>{confirmLabel || 'Aceptar'}</button>
          </div>
        </div>
      </div>
      <style>{`@keyframes dlgFade { from { opacity: 0; } } @keyframes dlgPop { from { opacity: 0; transform: translateY(8px) scale(.97); } }`}</style>
    </div>
  );
}
