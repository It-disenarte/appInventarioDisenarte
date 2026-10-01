import { useEffect } from 'react';
import Brand from './Brand';
import Icon from './Icon';

export const SIDE_MENU_WIDTH = 256;

function Item({ active, onClick, dot, icon, children, ...rest }) {
  return (
    <button className="menu-item" aria-current={active ? 'page' : undefined} onClick={onClick} {...rest}>
      {dot && <span style={{ width: 10, height: 10, margin: '0 3px', borderRadius: 5, background: dot, boxShadow: '0 0 0 1.5px rgba(255,255,255,.85)', flexShrink: 0 }} />}
      {icon && <Icon name={icon} size={17} />}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
    </button>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', padding: '18px 12px 6px' }}>{children}</div>;
}

// Menú lateral morado: fijo en escritorio (≥ 768 px); en celular sale como cajón desde la izquierda.
export default function SideMenu({ open, persistent, onClose, groups, groupId, onSelectGroup, views, adminViews, section, onSelectSection, user, roleLabel, onLogout, showGuide, onToggleGuide, onHelp, onInstall }) {
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
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(29,27,34,.4)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .22s', zIndex: 40 }} />
      )}
      <nav aria-label="Menú principal" aria-hidden={!visible} style={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: SIDE_MENU_WIDTH, maxWidth: '85vw', background: 'var(--morado)', color: '#fff', display: 'flex', flexDirection: 'column', transform: visible ? 'none' : 'translateX(-100%)', visibility: visible ? 'visible' : 'hidden', transition: 'transform .22s ease-out, visibility .22s', boxShadow: !persistent && open ? '4px 0 24px rgba(0,0,0,.2)' : 'none', zIndex: 45 }}>
        <div style={{ position: 'relative', padding: 'calc(28px + env(safe-area-inset-top)) 24px 20px', flexShrink: 0 }}>
          <Brand size={44} onDark />
          {!persistent && (
            <button className="menu-icono" onClick={onClose} aria-label="Cerrar menú" style={{ position: 'absolute', top: 'calc(10px + env(safe-area-inset-top))', right: 10 }}>
              <Icon name="x" size={20} />
            </button>
          )}
        </div>
        <div style={{ height: 2, margin: '0 24px', borderRadius: 1, background: 'var(--filete)', flexShrink: 0 }} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 12px' }}>
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
                  <Item key={v.key} icon={v.icon} active={section === v.key} onClick={() => onSelectSection(v.key)}>{v.label}</Item>
                ))}
              </div>
            </>
          )}
          {adminViews.length > 0 && (
            <div data-guide="menu-admin">
              <Label>Administración</Label>
              {adminViews.map((v) => (
                <Item key={v.key} icon={v.icon} active={section === v.key} onClick={() => onSelectSection(v.key)}>{v.label}</Item>
              ))}
            </div>
          )}

          <div data-guide="menu-account">
            <Label>Cuenta</Label>
            <Item icon="user" active={section === 'perfil'} onClick={() => onSelectSection('perfil')}>Mi perfil</Item>
            <button className="menu-item" role="switch" aria-checked={!!showGuide} onClick={onToggleGuide}>
              <Icon name="sparkles" size={17} />
              <span style={{ flex: 1 }}>Asistente de uso</span>
              <span style={{ width: 34, height: 20, borderRadius: 10, background: showGuide ? 'var(--turquesa)' : 'rgba(255,255,255,.25)', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
                <span style={{ position: 'absolute', top: 2, left: showGuide ? 16 : 2, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left .2s' }} />
              </span>
            </button>
            <Item icon="help" onClick={onHelp} data-guide="menu-help">Ver guía de esta pantalla</Item>
            {onInstall && <Item icon="download" onClick={onInstall}>Instalar como app</Item>}
          </div>
        </div>

        <div data-guide="menu-footer" style={{ borderTop: '1px solid rgba(255,255,255,.15)', padding: '14px 16px calc(14px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div title={user.name} style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{roleLabel}</div>
          </div>
          <button className="menu-item" onClick={onLogout} style={{ width: 'auto', padding: '7px 10px', fontSize: 13, flexShrink: 0 }}>
            <Icon name="logout" size={16} /> Salir
          </button>
        </div>
      </nav>
    </>
  );
}
