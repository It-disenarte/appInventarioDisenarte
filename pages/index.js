import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';
import { canModify, canManageGroups, ROLE_KEYS, AREA_KEYS } from '../lib/permissions';

const COLORS = { primary: '#A53692', secondary: '#7C07A6', teal: '#5CC6D0', bg: '#F7F7F8', border: '#E4E4E5', muted: '#96989A', text: '#1D1B1E', danger: '#B3261E', light: '#F6E4F2' };
const ROLE_LABEL = { produccion: 'Producción', diseno: 'Diseño', super: 'Súper', admin: 'Admin' };
const AREA_LABEL = { produccion: 'Producción', diseno: 'Diseño' };

const inputStyle = (extra) => ({ border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, ...extra });
const primaryBtn = { border: 'none', background: COLORS.primary, color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const linkBtn = (color) => ({ border: 'none', background: 'none', color: color || COLORS.text, fontSize: 13, cursor: 'pointer' });
const chipBtn = (active) => ({ border: `1px solid ${active ? COLORS.primary : COLORS.border}`, background: active ? COLORS.light : '#fff', color: active ? COLORS.primary : COLORS.text, borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' });

function seesMovements(role) { return role === 'admin' || role === 'super'; }

async function api(path, opts) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { window.location.href = '/login'; }
  if (!res.ok) { const err = new Error(data.error || 'Error de red.'); err.status = res.status; throw err; }
  return data;
}

const EXPIRY_WARN_DAYS = 30;
const EMPTY_ITEM_FORM = { nombre: '', cantidad: '', reorden: '', codigo: '', metraje: '', proveedor: '', descripcion: '', caducidad: '', car: {} };

function charSummary(cat, item) {
  const values = item.characteristics || {};
  const parts = [];
  if (item.codigo) parts.push(`Código: ${item.codigo}`);
  if (item.metraje) parts.push(`Metraje: ${item.metraje}`);
  if (item.proveedor) parts.push(`Proveedor: ${item.proveedor}`);
  (cat.schema || []).filter((k) => values[k]).forEach((k) => parts.push(`${k}: ${values[k]}`));
  return parts.join(' · ');
}

// La caducidad es una fecha sin hora ('AAAA-MM-DD'); se compara contra el día local de hoy.
function expiryInfo(caducidad) {
  if (!caducidad) return null;
  const ymd = String(caducidad).slice(0, 10);
  const [y, m, d] = ymd.split('-').map(Number);
  const now = new Date();
  const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  const fecha = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  if (days < 0) return { text: `Caducado (${fecha})`, color: COLORS.danger };
  if (days === 0) return { text: 'Caduca hoy', color: COLORS.danger };
  if (days <= EXPIRY_WARN_DAYS) return { text: `Caduca en ${days} día${days === 1 ? '' : 's'}`, color: '#E8A33D' };
  return { text: `Caduca ${fecha}`, color: COLORS.muted };
}

function itemToForm(it) {
  return { nombre: it.name, reorden: String(it.reorder), codigo: it.codigo || '', metraje: it.metraje || '', proveedor: it.proveedor || '', descripcion: it.descripcion || '', caducidad: it.caducidad ? String(it.caducidad).slice(0, 10) : '', car: { ...(it.characteristics || {}) } };
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [users, setUsers] = useState([]);
  const [groupId, setGroupId] = useState(null);
  const [section, setSection] = useState('inventarios');
  const [error, setError] = useState('');
  const [newCat, setNewCat] = useState({ name: '', unit: '', schema: '' });
  const [newItemForms, setNewItemForms] = useState({});
  const [editingCat, setEditingCat] = useState(null);
  const [editCatForm, setEditCatForm] = useState({ name: '', unit: '', schema: '' });
  const [editingItem, setEditingItem] = useState(null);
  const [editItemForm, setEditItemForm] = useState(EMPTY_ITEM_FORM);
  const [openNewItem, setOpenNewItem] = useState(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'produccion' });
  const [newGroup, setNewGroup] = useState({ label: '', area: 'produccion', color: COLORS.primary });
  const [editingGroup, setEditingGroup] = useState(null);
  const [editGroupForm, setEditGroupForm] = useState({ label: '', area: 'produccion', color: COLORS.primary });
  const [busy, setBusy] = useState(false);
  const [showNewUserPw, setShowNewUserPw] = useState(false);
  const [confirmState, setConfirmState] = useState(null);

  // Confirmación con el diálogo de la marca: `if (!(await ask({...}))) return;`
  function ask(opts) { return new Promise((resolve) => setConfirmState({ ...opts, resolve })); }
  const answerConfirm = useCallback((ok) => { setConfirmState((s) => { if (s) s.resolve(ok); return null; }); }, []);
  const cancelConfirm = useCallback(() => answerConfirm(false), [answerConfirm]);

  const applyGroups = useCallback((list) => {
    setGroups(list);
    setGroupId((prev) => (list.some((g) => g.id === prev) ? prev : (list[0] ? list[0].id : null)));
  }, []);

  const loadAll = useCallback(async () => {
    setLoadError('');
    try {
      const me = await api('/api/auth/me');
      if (!me.user) { router.replace('/login'); return; }
      setUser(me.user);
      const role = me.user.role;
      await Promise.all([
        api('/api/groups').then((d) => applyGroups(d.groups)),
        api('/api/items').then((d) => setItems(d.items)),
        seesMovements(role) ? api('/api/movements').then((d) => setMovements(d.movements)) : setMovements([]),
        role === 'admin' ? api('/api/users').then((d) => setUsers(d.users)) : setUsers([]),
      ]);
      setLoading(false);
    } catch (e) {
      setLoadError(navigator.onLine === false ? 'Sin conexión a internet.' : (e.message || 'No se pudo cargar el inventario.'));
    }
  }, [router, applyGroups]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Recarga solo lo que cambió, en paralelo.
  async function reload(...keys) {
    const jobs = [];
    if (keys.includes('groups')) jobs.push(api('/api/groups').then((d) => applyGroups(d.groups)));
    if (keys.includes('items')) jobs.push(api('/api/items').then((d) => setItems(d.items)));
    if (keys.includes('movements') && seesMovements(user.role)) jobs.push(api('/api/movements').then((d) => setMovements(d.movements)));
    if (keys.includes('users') && user.role === 'admin') jobs.push(api('/api/users').then((d) => setUsers(d.users)));
    await Promise.all(jobs);
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  function showError(e) { setError(e.message || String(e)); setTimeout(() => setError(''), 4000); }
  async function withBusy(fn) {
    setBusy(true);
    try { await fn(); } catch (e) {
      showError(e);
      // Si el rol cambió en el servidor, sincroniza la pantalla con los permisos reales.
      if (e.status === 403) loadAll();
    } finally { setBusy(false); }
  }

  async function adjustItem(item, delta) {
    await withBusy(async () => {
      const r = await api(`/api/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ delta }) });
      setItems((s) => s.map((i) => (i.id === item.id ? { ...i, qty: r.item.qty } : i)));
      if (r.movement && seesMovements(user.role)) setMovements((s) => [r.movement, ...s]);
    });
  }
  async function deleteItemRow(item) {
    if (!(await ask({ title: 'Eliminar artículo', message: `Se eliminará "${item.name}" junto con su historial de movimientos.`, confirmLabel: 'Eliminar', danger: true }))) return;
    await withBusy(async () => {
      await api(`/api/items/${item.id}`, { method: 'DELETE' });
      setItems((s) => s.filter((i) => i.id !== item.id));
      setMovements((s) => s.filter((mv) => mv.itemId !== item.id));
    });
  }
  async function addItemToCategory(categoryId) {
    const form = newItemForms[categoryId] || EMPTY_ITEM_FORM;
    if (!form.nombre.trim()) { showError(new Error('El nombre es obligatorio.')); return; }
    await withBusy(async () => {
      await api('/api/items', { method: 'POST', body: JSON.stringify({ categoryId, name: form.nombre, qty: form.cantidad, reorder: form.reorden, codigo: form.codigo, metraje: form.metraje, proveedor: form.proveedor, descripcion: form.descripcion, caducidad: form.caducidad, characteristics: form.car || {} }) });
      setNewItemForms((s) => ({ ...s, [categoryId]: EMPTY_ITEM_FORM }));
      setOpenNewItem(null);
      await reload('items', 'movements');
    });
  }
  async function saveItemEdit(item) {
    const f = editItemForm;
    if (!f.nombre.trim()) { showError(new Error('El nombre es obligatorio.')); return; }
    await withBusy(async () => {
      const r = await api(`/api/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ name: f.nombre, reorder: f.reorden, codigo: f.codigo, metraje: f.metraje, proveedor: f.proveedor, descripcion: f.descripcion, caducidad: f.caducidad, characteristics: f.car }) });
      setItems((s) => s.map((i) => (i.id === item.id ? { ...i, ...r.item, category: i.category } : i)));
      setEditingItem(null);
    });
  }
  async function addCategory() {
    if (!newCat.name.trim()) return;
    await withBusy(async () => {
      await api('/api/categories', { method: 'POST', body: JSON.stringify({ groupId, name: newCat.name, unit: newCat.unit || 'piezas', schema: newCat.schema }) });
      setNewCat({ name: '', unit: '', schema: '' });
      await reload('groups');
    });
  }
  async function saveEditCategory(cat) {
    await withBusy(async () => {
      await api(`/api/categories/${cat.id}`, { method: 'PATCH', body: JSON.stringify({ name: editCatForm.name, unit: editCatForm.unit, schema: editCatForm.schema }) });
      setEditingCat(null);
      await reload('groups');
    });
  }
  async function deleteCategoryRow(cat) {
    const count = groupItems.filter((it) => it.categoryId === cat.id).length;
    if (!(await ask({ title: 'Eliminar categoría', message: count > 0 ? `"${cat.name}" tiene ${count} artículo(s). Se eliminarán la categoría, sus artículos y sus movimientos.` : `Se eliminará la categoría "${cat.name}".`, confirmLabel: 'Eliminar', danger: true }))) return;
    await withBusy(async () => { await api(`/api/categories/${cat.id}`, { method: 'DELETE' }); await reload('groups', 'items', 'movements'); });
  }
  async function addGroup() {
    if (!newGroup.label.trim()) return;
    await withBusy(async () => {
      const r = await api('/api/groups', { method: 'POST', body: JSON.stringify(newGroup) });
      setNewGroup({ label: '', area: 'produccion', color: COLORS.primary });
      await reload('groups');
      setGroupId(r.group.id);
    });
  }
  async function saveEditGroup(g) {
    await withBusy(async () => {
      await api(`/api/groups/${g.id}`, { method: 'PATCH', body: JSON.stringify(editGroupForm) });
      setEditingGroup(null);
      await reload('groups');
    });
  }
  async function deleteGroupRow(g) {
    const count = items.filter((it) => it.category.groupId === g.id).length;
    if (!(await ask({ title: 'Eliminar grupo', message: `Se eliminará "${g.label}" con ${g.categories.length} categoría(s), ${count} artículo(s) y sus movimientos.\nEsta acción no se puede deshacer.`, confirmLabel: 'Eliminar grupo', danger: true }))) return;
    await withBusy(async () => { await api(`/api/groups/${g.id}`, { method: 'DELETE' }); await reload('groups', 'items', 'movements'); });
  }
  async function setRole(u, role) {
    await withBusy(async () => { await api(`/api/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ role }) }); await reload('users'); });
  }
  async function deleteMovementRow(mv) {
    if (!(await ask({ title: 'Eliminar movimiento', message: `Se eliminará el registro de "${mv.item.name}" (${mv.delta > 0 ? '+' : ''}${mv.delta}). La cantidad actual del artículo no cambia.`, confirmLabel: 'Eliminar', danger: true }))) return;
    await withBusy(async () => { await api(`/api/movements?id=${mv.id}`, { method: 'DELETE' }); setMovements((s) => s.filter((m) => m.id !== mv.id)); });
  }
  async function clearMovements() {
    if (!(await ask({ title: 'Vaciar movimientos', message: `Se eliminarán todos los movimientos de "${currentGroup.label}".\nEsta acción no se puede deshacer.`, confirmLabel: 'Vaciar', danger: true }))) return;
    const gid = currentGroup.id;
    await withBusy(async () => {
      await api(`/api/movements?groupId=${gid}`, { method: 'DELETE' });
      setMovements((s) => s.filter((mv) => mv.item.category.groupId !== gid));
    });
  }
  async function deleteUserRow(u) {
    if (!(await ask({ title: 'Eliminar usuario', message: `${u.name} (${u.email}) ya no podrá entrar a la app.`, confirmLabel: 'Eliminar', danger: true }))) return;
    await withBusy(async () => { await api(`/api/users/${u.id}`, { method: 'DELETE' }); setUsers((s) => s.filter((x) => x.id !== u.id)); });
  }
  async function addUserAccount() {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password) return;
    await withBusy(async () => {
      await api('/api/users', { method: 'POST', body: JSON.stringify(newUser) });
      setNewUser({ name: '', email: '', password: '', role: 'produccion' });
      await reload('users');
    });
  }

  if (loadError) {
    return (
      <div style={{ fontFamily: "'Outfit', system-ui, sans-serif", minHeight: '100vh', background: COLORS.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16, textAlign: 'center' }}>
        <img src="/isotipo.png" alt="Diseñarte México" style={{ width: 56, height: 56 }} />
        <div style={{ fontSize: 14, color: COLORS.muted }}>{loadError}</div>
        <button onClick={loadAll} style={primaryBtn}>Reintentar</button>
      </div>
    );
  }
  if (loading || !user) return <LoadingScreen label="Cargando inventario..." />;

  const currentGroup = groups.find((g) => g.id === groupId) || groups[0];
  const groupCanModify = currentGroup ? canModify(user.role, currentGroup.area) : false;
  const groupItems = items.filter((it) => it.category.groupId === (currentGroup ? currentGroup.id : null));
  const groupMovements = movements.filter((mv) => mv.item.category.groupId === (currentGroup ? currentGroup.id : null));

  const canSeeMovements = seesMovements(user.role);
  const canEditGroups = canManageGroups(user.role);
  const navDefs = [
    { key: 'inventarios', label: 'Inventarios' },
    ...(canSeeMovements ? [{ key: 'movimientos', label: 'Movimientos' }] : []),
    { key: 'categorias', label: 'Categorías' },
    ...(canEditGroups ? [{ key: 'grupos', label: 'Grupos' }] : []),
  ];
  if (user.role === 'admin') navDefs.push({ key: 'admin', label: 'Administración' });
  const showGroupTabs = section !== 'admin' && section !== 'grupos';
  const noGroups = !currentGroup && ['inventarios', 'movimientos', 'categorias'].includes(section);

  function groupForm(form, setForm) {
    return (
      <>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="Nombre (p.ej. Producción · Insumos)" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} style={inputStyle({ flex: 2, minWidth: 180, fontSize: 14 })} />
          <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} title="Color de la pestaña" style={{ width: 40, height: 36, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 2, background: '#fff', cursor: 'pointer' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: COLORS.muted }}>Área que lo modifica:</span>
          {AREA_KEYS.map((a) => (
            <button key={a} onClick={() => setForm((f) => ({ ...f, area: a }))} style={chipBtn(form.area === a)}>{AREA_LABEL[a]}</button>
          ))}
        </div>
      </>
    );
  }

  // Formulario de artículo, compartido por "nuevo" (con cantidad inicial) y "editar".
  function itemForm(form, patch, schema, isNew) {
    const field = (label, key, props, flex) => (
      <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: flex || '1 1 140px', minWidth: 0, fontSize: 11, fontWeight: 600, color: COLORS.muted }}>
        {label}
        <input value={form[key] || ''} onChange={(e) => patch({ [key]: e.target.value })} style={inputStyle({ fontWeight: 400, color: COLORS.text, width: '100%', boxSizing: 'border-box' })} {...props} />
      </label>
    );
    return (
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {field('Nombre *', 'nombre', {}, '2 1 220px')}
        {field('Código', 'codigo')}
        {isNew && field('Cantidad', 'cantidad', { type: 'number', min: '0' }, '0 1 100px')}
        {field('Reorden', 'reorden', { type: 'number', min: '0' }, '0 1 100px')}
        {field('Metraje', 'metraje', { placeholder: 'p.ej. 1.22 x 50 m' })}
        {field('Proveedor', 'proveedor')}
        {field('Fecha de caducidad', 'caducidad', { type: 'date' })}
        {schema.map((k) => (
          <label key={`car-${k}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', minWidth: 0, fontSize: 11, fontWeight: 600, color: COLORS.muted }}>
            {k}
            <input value={(form.car || {})[k] || ''} onChange={(e) => patch({ car: { ...(form.car || {}), [k]: e.target.value } })} style={inputStyle({ fontWeight: 400, color: COLORS.text, width: '100%', boxSizing: 'border-box' })} />
          </label>
        ))}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 100%', fontSize: 11, fontWeight: 600, color: COLORS.muted }}>
          Descripción
          <textarea rows={2} value={form.descripcion || ''} onChange={(e) => patch({ descripcion: e.target.value })} style={inputStyle({ fontWeight: 400, color: COLORS.text, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' })} />
        </label>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Outfit', system-ui, sans-serif", minHeight: '100vh', background: COLORS.bg, color: COLORS.text, position: 'relative' }}>
      {confirmState && (
        <ConfirmDialog title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={() => answerConfirm(true)} onCancel={cancelConfirm} />
      )}
      {busy && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(253,248,251,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ width: 40, height: 40, border: '4px solid #F1EEF0', borderTopColor: COLORS.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: `1px solid ${COLORS.border}`, position: 'sticky', top: 0, background: COLORS.bg, zIndex: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <img src="/isotipo.png" alt="Diseñarte México" style={{ width: 32, height: 32 }} />
          <div style={{ fontSize: 20, fontWeight: 600, color: COLORS.text }}>Inventario</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0, marginLeft: 12 }}>
          <div style={{ textAlign: 'right', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: COLORS.muted, whiteSpace: 'nowrap' }}>{ROLE_LABEL[user.role]}</div>
          </div>
          <button onClick={logout} style={{ border: 'none', background: 'none', color: COLORS.muted, fontSize: 12, cursor: 'pointer' }}>Salir</button>
        </div>
      </div>

      {showGroupTabs && groups.length > 0 && (
        <div style={{ display: 'flex', gap: 4, padding: '0 12px', borderBottom: `1px solid ${COLORS.border}`, overflowX: 'auto' }}>
          {groups.map((g) => (
            <button key={g.id} onClick={() => setGroupId(g.id)} style={{ border: 'none', background: 'none', padding: '14px 14px 12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', color: g.id === currentGroup?.id ? g.color : COLORS.muted, borderBottom: g.id === currentGroup?.id ? `3px solid ${g.color}` : '3px solid transparent' }}>
              {g.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`, overflowX: 'auto' }}>
        {navDefs.map((n) => (
          <button key={n.key} onClick={() => setSection(n.key)} style={{ border: 'none', background: section === n.key ? COLORS.light : 'transparent', color: section === n.key ? COLORS.primary : COLORS.muted, borderRadius: 20, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {n.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
        {error && <div style={{ background: '#FDEDEE', color: COLORS.danger, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>{error}</div>}

        {noGroups && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: COLORS.muted }}>
            Aún no hay grupos de inventario.{canEditGroups && <> Créalos en la sección <b>Grupos</b>.</>}
          </div>
        )}

        {section === 'inventarios' && currentGroup && (
          <div>
            {currentGroup.categories.map((cat) => {
              const catItems = groupItems.filter((it) => it.categoryId === cat.id);
              const schema = cat.schema || [];
              const form = newItemForms[cat.id] || EMPTY_ITEM_FORM;
              const setForm = (patch) => setNewItemForms((s) => ({ ...s, [cat.id]: { ...(s[cat.id] || EMPTY_ITEM_FORM), ...patch } }));
              return (
                <div key={cat.id} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: COLORS.muted, padding: '8px 4px' }}>{cat.name} · {cat.unit}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {catItems.map((it) => {
                      const low = it.qty <= it.reorder;
                      const details = charSummary(cat, it);
                      const expiry = expiryInfo(it.caducidad);
                      const isEditing = editingItem === it.id;
                      return (
                        <div key={it.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 600 }}>{it.name}</div>
                              {details && <div style={{ fontSize: 12, color: COLORS.text, opacity: 0.75 }}>{details}</div>}
                              {it.descripcion && <div style={{ fontSize: 12, color: COLORS.muted, whiteSpace: 'pre-wrap' }}>{it.descripcion}</div>}
                              <div style={{ fontSize: 12, color: COLORS.muted }}>
                                <span style={{ color: low ? '#E8A33D' : COLORS.muted }}>{low ? 'Bajo mínimo' : 'Stock ok'}</span> · reorden {it.reorder}
                                {expiry && <> · <span style={{ color: expiry.color, fontWeight: expiry.color === COLORS.muted ? 400 : 600 }}>{expiry.text}</span></>}
                              </div>
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 700 }}>{it.qty}<span style={{ fontSize: 12, fontWeight: 400, color: COLORS.muted }}> {cat.unit}</span></div>
                            {groupCanModify && (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <button onClick={() => adjustItem(it, -1)} disabled={it.qty === 0} style={{ width: 34, height: 34, borderRadius: 17, border: `1px solid ${it.qty === 0 ? COLORS.border : COLORS.muted}`, background: '#fff', color: it.qty === 0 ? '#C7C5C7' : COLORS.text, cursor: it.qty === 0 ? 'default' : 'pointer' }}>−</button>
                                <button onClick={() => adjustItem(it, 1)} style={{ width: 34, height: 34, borderRadius: 17, border: `1px solid ${COLORS.muted}`, background: '#fff', cursor: 'pointer' }}>+</button>
                                <button onClick={() => { setEditingItem(isEditing ? null : it.id); setEditItemForm(itemToForm(it)); }} style={{ ...linkBtn(), fontSize: 12 }}>Editar</button>
                                <button onClick={() => deleteItemRow(it)} style={{ ...linkBtn(COLORS.danger), fontSize: 12 }}>Eliminar</button>
                              </div>
                            )}
                          </div>
                          {isEditing && (
                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.border}` }}>
                              {itemForm(editItemForm, (p) => setEditItemForm((f) => ({ ...f, ...p })), schema, false)}
                              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                <button onClick={() => saveItemEdit(it)} style={primaryBtn}>Guardar</button>
                                <button onClick={() => setEditingItem(null)} style={linkBtn(COLORS.muted)}>Cancelar</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {groupCanModify && (openNewItem === cat.id ? (
                    <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginTop: 8, border: `1px dashed ${COLORS.border}` }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Nuevo artículo en {cat.name}</div>
                      {itemForm(form, setForm, schema, true)}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={() => addItemToCategory(cat.id)} style={primaryBtn}>Agregar</button>
                        <button onClick={() => setOpenNewItem(null)} style={linkBtn(COLORS.muted)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setOpenNewItem(cat.id)} style={{ ...linkBtn(COLORS.primary), fontWeight: 600, marginTop: 8, padding: '6px 4px' }}>+ Agregar artículo</button>
                  ))}
                </div>
              );
            })}
            {currentGroup.categories.length === 0 && <div style={{ textAlign: 'center', padding: '60px 20px', color: COLORS.muted }}>Aún no hay categorías en este inventario.</div>}
          </div>
        )}

        {section === 'movimientos' && canSeeMovements && currentGroup && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button onClick={clearMovements} disabled={groupMovements.length === 0} style={{ border: 'none', background: 'none', color: groupMovements.length === 0 ? '#C7C5C7' : COLORS.danger, fontSize: 13, fontWeight: 600, cursor: groupMovements.length === 0 ? 'default' : 'pointer' }}>Vaciar movimientos de este inventario</button>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, padding: '4px 20px' }}>
              {groupMovements.length === 0 && <div style={{ textAlign: 'center', padding: '60px 20px', color: COLORS.muted }}>Aún no hay movimientos.</div>}
              {groupMovements.map((mv) => (
                <div key={mv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{mv.item.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{mv.item.category.name} · {new Date(mv.fecha).toLocaleString('es-MX')} · {mv.usuario}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: mv.delta > 0 ? COLORS.teal : COLORS.primary }}>{mv.delta > 0 ? `+${mv.delta}` : mv.delta}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>{mv.antes} → {mv.despues}</div>
                    </div>
                    <button onClick={() => deleteMovementRow(mv)} style={{ ...linkBtn(COLORS.danger), fontSize: 12 }}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'categorias' && currentGroup && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentGroup.categories.map((cat) => {
              const count = groupItems.filter((it) => it.categoryId === cat.id).length;
              const isEditing = editingCat === cat.id;
              const schema = cat.schema || [];
              return (
                <div key={cat.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 18px' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input placeholder="Nombre" value={editCatForm.name} onChange={(e) => setEditCatForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle({ flex: 2, minWidth: 120, fontSize: 14 })} />
                      <input placeholder="Unidad" value={editCatForm.unit} onChange={(e) => setEditCatForm((f) => ({ ...f, unit: e.target.value }))} style={inputStyle({ flex: 1, minWidth: 100, fontSize: 14 })} />
                      <input placeholder="Características, separadas por comas" value={editCatForm.schema} onChange={(e) => setEditCatForm((f) => ({ ...f, schema: e.target.value }))} style={inputStyle({ flex: '1 1 100%', fontSize: 14 })} />
                      <button onClick={() => saveEditCategory(cat)} style={primaryBtn}>Guardar</button>
                      <button onClick={() => setEditingCat(null)} style={linkBtn(COLORS.muted)}>Cancelar</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{cat.name}</div>
                        <div style={{ fontSize: 12, color: COLORS.muted }}>{cat.unit} · {count} artículo(s){schema.length > 0 && ` · ${schema.join(', ')}`}</div>
                      </div>
                      {groupCanModify && (
                        <div style={{ display: 'flex', gap: 12 }}>
                          <button onClick={() => { setEditingCat(cat.id); setEditCatForm({ name: cat.name, unit: cat.unit, schema: schema.join(', ') }); }} style={linkBtn()}>Editar</button>
                          <button onClick={() => deleteCategoryRow(cat)} style={linkBtn(COLORS.danger)}>Eliminar</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {groupCanModify && (
              <div style={{ background: '#fff', borderRadius: 16, padding: '16px 18px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Nueva categoría</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input placeholder="Nombre" value={newCat.name} onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value }))} style={inputStyle({ flex: 2, minWidth: 140, fontSize: 14, padding: '9px 12px' })} />
                  <input placeholder="Unidad (p.ej. piezas)" value={newCat.unit} onChange={(e) => setNewCat((c) => ({ ...c, unit: e.target.value }))} style={inputStyle({ flex: 1.5, minWidth: 140, fontSize: 14, padding: '9px 12px' })} />
                  <input placeholder="Características (opcional, p.ej. Color, Espesor)" value={newCat.schema} onChange={(e) => setNewCat((c) => ({ ...c, schema: e.target.value }))} style={inputStyle({ flex: '1 1 100%', fontSize: 14, padding: '9px 12px' })} />
                  <button onClick={addCategory} style={{ ...primaryBtn, fontSize: 14, padding: '9px 16px' }}>Agregar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {section === 'grupos' && canEditGroups && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map((g) => {
              const isEditing = editingGroup === g.id;
              return (
                <div key={g.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 18px' }}>
                  {isEditing ? (
                    <div>
                      {groupForm(editGroupForm, setEditGroupForm)}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={() => saveEditGroup(g)} style={primaryBtn}>Guardar</button>
                        <button onClick={() => setEditingGroup(null)} style={linkBtn(COLORS.muted)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 6, background: g.color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>{g.label}</div>
                          <div style={{ fontSize: 12, color: COLORS.muted }}>Área: {AREA_LABEL[g.area] || g.area} · {g.categories.length} categoría(s)</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <button onClick={() => { setEditingGroup(g.id); setEditGroupForm({ label: g.label, area: g.area, color: g.color }); }} style={linkBtn()}>Editar</button>
                        <button onClick={() => deleteGroupRow(g)} style={linkBtn(COLORS.danger)}>Eliminar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ background: '#fff', borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Nuevo grupo de inventario</div>
              {groupForm(newGroup, setNewGroup)}
              <button onClick={addGroup} style={{ ...primaryBtn, marginTop: 12, fontSize: 14, padding: '9px 16px' }}>Agregar grupo</button>
            </div>
          </div>
        )}

        {section === 'admin' && user.role === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map((u) => {
              const isMe = u.id === user.id;
              return (
                <div key={u.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}{isMe && <span style={{ fontWeight: 400, color: COLORS.muted }}> (tú)</span>}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{u.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ROLE_KEYS.map((r) => (
                      <button key={r} onClick={() => setRole(u, r)} disabled={isMe && r !== 'admin'} style={{ ...chipBtn(u.role === r), opacity: isMe && r !== 'admin' ? 0.4 : 1, cursor: isMe && r !== 'admin' ? 'default' : 'pointer' }}>
                        {ROLE_LABEL[r]}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => deleteUserRow(u)} disabled={isMe} style={{ border: 'none', background: 'none', color: isMe ? '#C7C5C7' : COLORS.danger, fontSize: 12, cursor: isMe ? 'default' : 'pointer' }}>Eliminar</button>
                </div>
              );
            })}
            <div style={{ background: '#fff', borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Nuevo usuario</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input placeholder="Nombre" value={newUser.name} onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))} style={inputStyle({ flex: 1.5, minWidth: 140, fontSize: 14, padding: '9px 12px' })} />
                <input placeholder="Correo" value={newUser.email} onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))} style={inputStyle({ flex: 1.5, minWidth: 160, fontSize: 14, padding: '9px 12px' })} />
                <input placeholder="Contraseña" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} type={showNewUserPw ? 'text' : 'password'} style={inputStyle({ flex: 1, minWidth: 120, fontSize: 14, padding: '9px 12px' })} />
                <button type="button" onClick={() => setShowNewUserPw((v) => !v)} style={{ border: 'none', background: 'none', color: COLORS.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{showNewUserPw ? 'Ocultar' : 'Ver'}</button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {ROLE_KEYS.map((r) => (
                  <button key={r} onClick={() => setNewUser((u) => ({ ...u, role: r }))} style={chipBtn(newUser.role === r)}>
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
              <button onClick={addUserAccount} style={{ ...primaryBtn, marginTop: 12, fontSize: 14, padding: '9px 16px' }}>Agregar usuario</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
