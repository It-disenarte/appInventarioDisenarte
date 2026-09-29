import { useEffect } from 'react';

const C = { primary: '#A53692', text: '#1D1B1E', muted: '#96989A', border: '#E4E4E5', light: '#F6E4F2', bg: '#F7F7F8' };
export const SIDE_MENU_WIDTH = 264;

function Item({ active, onClick, dot, children }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: active ? C.light : 'transparent', color: active ? C.primary : C.text, borderRadius: 10, padding: '10px 12px', fontSize: 14, fontWeight: active ? 600 : 500, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
      {dot && <span style={{ width: 10, height: 10, borderRadius: 5, background: dot, flexShrink: 0 }} />}
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
    </button>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: C.muted, padding: '18px 12px 6px' }}>{children}</div>;
}

// Menú lateral: en pantallas anchas queda fijo; en celular se despliega sobre el contenido.
export default function SideMenu({ open, persistent, onClose, groups, groupId, onSelectGroup, views, adminViews, section, onSelectSection, user, roleLabel, onLogout }) {
  useEffect(() => {
    if (persistent || !open) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, persistent, onClose]);

  const visible = persistent || open;
  const inGroupView = views.some((v) => v.key === section);

  return (
    <>
      {!persistent && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(29,27,30,0.35)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .2s', zIndex: 40 }} />
      )}
      <nav aria-label="Menú principal" style={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: SIDE_MENU_WIDTH, maxWidth: '85vw', background: '#fff', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', transform: visible ? 'none' : 'translateX(-100%)', transition: 'transform .22s ease-out', boxShadow: !persistent && open ? '4px 0 24px rgba(0,0,0,0.12)' : 'none', zIndex: 45 }}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <img src="/isotipo.png" alt="Diseñarte México" style={{ width: 30, height: 30 }} />
          <div style={{ fontSize: 19, fontWeight: 600, color: C.text, flex: 1 }}>Inventario</div>
          {!persistent && (
            <button onClick={onClose} aria-label="Cerrar menú" style={{ border: 'none', background: 'none', padding: 6, cursor: 'pointer', color: C.muted, display: 'flex' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
          {groups.length > 0 && (
            <>
              <div data-guide="menu-groups">
                <Label>Inventarios</Label>
                {groups.map((g) => (
                  <Item key={g.id} dot={g.color} active={inGroupView && g.id === groupId} onClick={() => onSelectGroup(g.id)}>{g.label}</Item>
                ))}
              </div>
              <div data-guide="menu-views">
                <Label>Ver</Label>
                {views.map((v) => (
                  <Item key={v.key} active={section === v.key} onClick={() => onSelectSection(v.key)}>{v.label}</Item>
                ))}
              </div>
            </>
          )}
          {adminViews.length > 0 && (
            <div data-guide="menu-admin">
              <Label>Administración</Label>
              {adminViews.map((v) => (
                <Item key={v.key} active={section === v.key} onClick={() => onSelectSection(v.key)}>{v.label}</Item>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button data-guide="menu-profile" onClick={() => onSelectSection('perfil')} title="Mi perfil" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: section === 'perfil' ? C.light : 'transparent', borderRadius: 10, padding: '8px', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
            <span style={{ width: 32, height: 32, borderRadius: 16, background: C.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, flexShrink: 0 }}>{(user.name || '?').trim().charAt(0).toUpperCase()}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: section === 'perfil' ? C.primary : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
              <span style={{ display: 'block', fontSize: 11, color: C.muted }}>{roleLabel} · Mi perfil</span>
            </span>
          </button>
          <button data-guide="menu-logout" onClick={onLogout} style={{ border: `1px solid ${C.border}`, background: '#fff', color: C.text, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>Salir</button>
        </div>
      </nav>
    </>
  );
}
