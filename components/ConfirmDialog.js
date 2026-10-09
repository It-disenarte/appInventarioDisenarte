import { useEffect, useRef } from 'react';

// Diálogo de confirmación con la identidad de Diseñarte. Reemplaza a window.confirm.
// Esc o clic fuera cancelan; el foco inicial va a "Cancelar" para no borrar por accidente con Enter.
// `info`: aviso con un solo botón. `link` ({ href, label }): enlace externo bajo el mensaje.
export default function ConfirmDialog({ title, message, confirmLabel, danger, info, link, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    const first = info ? confirmRef.current : cancelRef.current;
    if (first) first.focus();
    function onKey(e) { if (e.key === 'Escape') onCancel(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, info]);

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(29,27,34,0.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60, animation: 'dlgFade .15s ease-out' }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', animation: 'dlgPop .18s ease-out' }}>
        <div style={{ height: 4, background: 'var(--filete)' }} />
        <div style={{ padding: '20px 22px 18px' }}>
          <div id="dlg-title" style={{ fontSize: 17, fontWeight: 600, color: 'var(--texto)', marginBottom: 8 }}>{title}</div>
          <div id="dlg-msg" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--texto-2)', whiteSpace: 'pre-line' }}>{message}</div>
          {link && (
            <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: 14, fontWeight: 600, color: 'var(--morado)', textDecoration: 'none' }}>{link.label}</a>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
            {!info && <button ref={cancelRef} onClick={onCancel} className="btn btn-contorno">Cancelar</button>}
            <button ref={confirmRef} onClick={onConfirm} className={`btn ${danger ? 'btn-peligro-lleno' : 'btn-primario'}`}>{confirmLabel || 'Aceptar'}</button>
          </div>
        </div>
      </div>
      <style>{`@keyframes dlgFade { from { opacity: 0; } } @keyframes dlgPop { from { opacity: 0; transform: translateY(8px) scale(.97); } }`}</style>
    </div>
  );
}
