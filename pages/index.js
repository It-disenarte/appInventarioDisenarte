import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';
import SideMenu, { SIDE_MENU_WIDTH } from '../components/SideMenu';
import GuideTour from '../components/GuideTour';
import { generalSteps, sectionSteps } from '../lib/guideSteps';
import { canModify, canManageGroups, ROLE_KEYS, AREA_KEYS } from '../lib/permissions';
import { taskWebUrl } from '../lib/zoho';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // En pantallas anchas el menú lateral queda fijo; en celular se despliega con el botón ☰.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Confirmación con el diálogo de la marca: `if (!(await ask({...}))) return;`
  function ask(opts) { return new Promise((resolve) => setConfirmState({ ...opts, resolve })); }
  const answerConfirm = useCallback((ok) => { setConfirmState((s) => { if (s) s.resolve(ok); return null; }); }, []);
  const cancelConfirm = useCallback(() => answerConfirm(false), [answerConfirm]);

  // Asistente de uso. Mientras user.showGuide sea true, cada pantalla muestra su guía
  // la primera vez que se visita en esta sesión (o sea, cada vez que se abre la app).
  const [guideSteps, setGuideSteps] = useState(null);
  const seenGuides = useRef(new Set());
  const closeGuide = useCallback(() => setGuideSteps(null), []);
  const setMenuFromGuide = useCallback((open) => setMenuOpen(open), []);

  function guideContext() {
    const g = groups.find((x) => x.id === groupId) || groups[0];
    return {
      isWide, role: user.role,
      canModify: g ? canModify(user.role, g.area) : false,
      canSeeMovements: seesMovements(user.role), canEditGroups: canManageGroups(user.role), isAdmin: user.role === 'admin',
      groupLabel: g ? g.label : '', groupArea: g ? g.area : '',
      hasGroups: groups.length > 0,
      hasCategories: g ? g.categories.length > 0 : false,
      hasItems: g ? items.some((it) => it.category.groupId === g.id) : false,
      hasMovements: g ? movements.some((mv) => mv.item.category.groupId === g.id) : false,
    };
  }
  function openGuide(sec, withGeneral) {
    const ctx = guideContext();
    const steps = [...(withGeneral ? generalSteps(ctx) : []), ...sectionSteps(sec, ctx)]
      .filter((s) => !s.target || document.querySelector(`[data-guide="${s.target}"]`))
      .filter((s) => !s.list || s.list.length > 0 || s.body);
    seenGuides.current.add(sec);
    if (withGeneral) seenGuides.current.add('general');
    if (steps.length) setGuideSteps(steps);
  }
  async function setGuidePreference(showGuide) {
    try {
      const r = await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ showGuide }) });
      setUser((u) => ({ ...u, showGuide: r.user.showGuide }));
      if (showGuide) seenGuides.current.clear();
    } catch (e) { showError(e); }
  }
  function replayGuideEverywhere() {
    seenGuides.current.clear();
    openGuide(section, true);
  }

  useEffect(() => {
    if (loading || !user || !user.showGuide || guideSteps || busy || confirmState) return;
    if (seenGuides.current.has(section)) return;
    const withGeneral = !seenGuides.current.has('general');
    const t = setTimeout(() => openGuide(section, withGeneral), 500);
    return () => clearTimeout(t);
  });

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
        api('/api/items').then((d) => {
          setItems(d.items);
          // Libera en segundo plano las solicitudes que ya se cerraron en Zoho.
          if (d.items.some((it) => it.zohoTaskId)) {
            api('/api/zoho/sync', { method: 'POST' })
              .then((r) => { if (r.cleared.length) setItems((s) => s.map((it) => (r.cleared.includes(it.id) ? { ...it, zohoTaskId: null, zohoRequestedAt: null } : it))); })
              .catch(() => {});
          }
        }),
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
      setItems((s) => s.map((i) => (i.id === item.id ? { ...i, qty: r.item.qty, zohoTaskId: r.item.zohoTaskId, zohoRequestedAt: r.item.zohoRequestedAt } : i)));
      if (r.movement && seesMovements(user.role)) setMovements((s) => [r.movement, ...s]);
    });
  }
  async function requestRestock(item) {
    const unit = item.category.unit;
    if (!(await ask({ title: 'Solicitar reabastecimiento', message: `Se creará una solicitud en Zoho Projects (DI-5 · Gestión de Compras y Materiales, columna Solicitud) para "${item.name}".\nExistencia: ${item.qty} ${unit} · reorden: ${item.reorder} ${unit}.`, confirmLabel: 'Solicitar' }))) return;
    // La pestaña se abre aquí, todavía dentro del clic, para que el navegador no la bloquee.
    const win = window.open('about:blank', '_blank');
    await withBusy(async () => {
      try {
        const r = await api('/api/zoho/restock', { method: 'POST', body: JSON.stringify({ itemId: item.id }) });
        setItems((s) => s.map((i) => (i.id === item.id ? { ...i, zohoTaskId: r.item.zohoTaskId, zohoRequestedAt: r.item.zohoRequestedAt } : i)));
        if (win) win.location.href = r.task.url;
      } catch (e) {
        if (win) win.close();
        if (e.status === 409) await reload('items');
        throw e;
      }
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
        <img src="/icon.svg" alt="Inventario" style={{ width: 56, height: 56 }} />
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
  // Vistas del grupo seleccionado y vistas de administración (menú lateral).
  const views = [
    { key: 'inventarios', label: 'Artículos' },
    ...(canSeeMovements ? [{ key: 'movimientos', label: 'Movimientos' }] : []),
    { key: 'categorias', label: 'Categorías' },
  ];
  const adminViews = [
    ...(canEditGroups ? [{ key: 'grupos', label: 'Grupos' }] : []),
    ...(user.role === 'admin' ? [{ key: 'admin', label: 'Usuarios' }] : []),
  ];
  const currentView = views.find((v) => v.key === section);
  const headerTitle = currentView ? (currentGroup ? currentGroup.label : 'Inventario') : section === 'perfil' ? 'Mi perfil' : (adminViews.find((v) => v.key === section) || {}).label;
  function selectGroup(id) {
    setGroupId(id);
    if (!currentView) setSection('inventarios');
    setMenuOpen(false);
  }
  function selectSection(key) { setSection(key); setMenuOpen(false); }
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
      {guideSteps && (
        <GuideTour steps={guideSteps} onClose={closeGuide} onDisable={() => setGuidePreference(false)} onMenu={setMenuFromGuide} />
      )}
      {confirmState && (
        <ConfirmDialog title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={() => answerConfirm(true)} onCancel={cancelConfirm} />
      )}
      {busy && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(253,248,251,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ width: 40, height: 40, border: '4px solid #F1EEF0', borderTopColor: COLORS.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <SideMenu
        open={menuOpen} persistent={isWide} onClose={closeMenu}
        groups={groups} groupId={currentGroup ? currentGroup.id : null} onSelectGroup={selectGroup}
        views={views} adminViews={adminViews} section={section} onSelectSection={selectSection}
        user={user} roleLabel={ROLE_LABEL[user.role]} onLogout={logout}
      />

      <div style={{ paddingLeft: isWide ? SIDE_MENU_WIDTH : 0 }}>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderBottom: `1px solid ${COLORS.border}`, position: 'sticky', top: 0, background: COLORS.bg, zIndex: 5 }}>
        {!isWide && (
          <button data-guide="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú" style={{ border: 'none', background: 'none', padding: 6, marginLeft: -6, cursor: 'pointer', color: COLORS.text, display: 'flex' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        )}
        <div data-guide="header-title" style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          {currentView && currentGroup && <span style={{ width: 10, height: 10, borderRadius: 5, background: currentGroup.color, flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{headerTitle}</div>
            {currentView && <div style={{ fontSize: 12, color: COLORS.muted }}>{currentView.label}</div>}
          </div>
        </div>
        <button data-guide="help-button" onClick={() => openGuide(section, false)} aria-label="Ver guía de esta pantalla" title="Ver guía de esta pantalla" style={{ width: 32, height: 32, borderRadius: 16, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.primary, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>?</button>
        {!isWide && <img src="/icon.svg" alt="Inventario" style={{ width: 28, height: 28, flexShrink: 0 }} />}
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
                  <div data-guide="cat-heading" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: COLORS.muted, padding: '8px 4px' }}>{cat.name} · {cat.unit}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {catItems.map((it) => {
                      const low = it.qty <= it.reorder;
                      const details = charSummary(cat, it);
                      const expiry = expiryInfo(it.caducidad);
                      const isEditing = editingItem === it.id;
                      return (
                        <div key={it.id} data-guide="item-card" style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 600 }}>{it.name}</div>
                              {details && <div style={{ fontSize: 12, color: COLORS.text, opacity: 0.75 }}>{details}</div>}
                              {it.descripcion && <div style={{ fontSize: 12, color: COLORS.muted, whiteSpace: 'pre-wrap' }}>{it.descripcion}</div>}
                              <div style={{ fontSize: 12, color: COLORS.muted }}>
                                <span style={{ color: low ? '#E8A33D' : COLORS.muted }}>{it.qty === 0 ? 'Agotado' : low ? 'Bajo mínimo' : 'Stock ok'}</span> · reorden {it.reorder}
                                {expiry && <> · <span style={{ color: expiry.color, fontWeight: expiry.color === COLORS.muted ? 400 : 600 }}>{expiry.text}</span></>}
                              </div>
                              {low && (it.zohoTaskId ? (
                                <div data-guide="item-restock-status" style={{ fontSize: 12, color: COLORS.muted, marginTop: 6 }}>
                                  Solicitado{it.zohoRequestedAt && ` el ${new Date(it.zohoRequestedAt).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })}`} · <a href={taskWebUrl(it.zohoTaskId)} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.primary, fontWeight: 600, textDecoration: 'none' }}>Ver en Zoho</a>
                                </div>
                              ) : (
                                <button data-guide="item-restock" onClick={() => requestRestock(it)} style={{ marginTop: 8, border: `1px solid ${COLORS.primary}`, background: COLORS.light, color: COLORS.primary, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                                  Solicitar reabastecimiento
                                </button>
                              ))}
                            </div>
                            <div data-guide="item-qty" style={{ fontSize: 22, fontWeight: 700 }}>{it.qty}<span style={{ fontSize: 12, fontWeight: 400, color: COLORS.muted }}> {cat.unit}</span></div>
                            {groupCanModify && (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <button data-guide="item-minus" onClick={() => adjustItem(it, -1)} disabled={it.qty === 0} style={{ width: 34, height: 34, borderRadius: 17, border: `1px solid ${it.qty === 0 ? COLORS.border : COLORS.muted}`, background: '#fff', color: it.qty === 0 ? '#C7C5C7' : COLORS.text, cursor: it.qty === 0 ? 'default' : 'pointer' }}>−</button>
                                <button data-guide="item-plus" onClick={() => adjustItem(it, 1)} style={{ width: 34, height: 34, borderRadius: 17, border: `1px solid ${COLORS.muted}`, background: '#fff', cursor: 'pointer' }}>+</button>
                                <button data-guide="item-edit" onClick={() => { setEditingItem(isEditing ? null : it.id); setEditItemForm(itemToForm(it)); }} style={{ ...linkBtn(), fontSize: 12 }}>Editar</button>
                                <button data-guide="item-delete" onClick={() => deleteItemRow(it)} style={{ ...linkBtn(COLORS.danger), fontSize: 12 }}>Eliminar</button>
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
                    <div data-guide="add-item" style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginTop: 8, border: `1px dashed ${COLORS.border}` }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Nuevo artículo en {cat.name}</div>
                      {itemForm(form, setForm, schema, true)}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={() => addItemToCategory(cat.id)} style={primaryBtn}>Agregar</button>
                        <button onClick={() => setOpenNewItem(null)} style={linkBtn(COLORS.muted)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button data-guide="add-item" onClick={() => setOpenNewItem(cat.id)} style={{ ...linkBtn(COLORS.primary), fontWeight: 600, marginTop: 8, padding: '6px 4px' }}>+ Agregar artículo</button>
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
              <button data-guide="mov-clear" onClick={clearMovements} disabled={groupMovements.length === 0} style={{ border: 'none', background: 'none', color: groupMovements.length === 0 ? '#C7C5C7' : COLORS.danger, fontSize: 13, fontWeight: 600, cursor: groupMovements.length === 0 ? 'default' : 'pointer' }}>Vaciar movimientos de este inventario</button>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, padding: '4px 20px' }}>
              {groupMovements.length === 0 && <div style={{ textAlign: 'center', padding: '60px 20px', color: COLORS.muted }}>Aún no hay movimientos.</div>}
              {groupMovements.map((mv) => (
                <div key={mv.id} data-guide="mov-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{mv.item.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{mv.item.category.name} · {new Date(mv.fecha).toLocaleString('es-MX')} · {mv.usuario}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: mv.delta > 0 ? COLORS.teal : COLORS.primary }}>{mv.delta > 0 ? `+${mv.delta}` : mv.delta}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>{mv.antes} → {mv.despues}</div>
                    </div>
                    <button data-guide="mov-delete" onClick={() => deleteMovementRow(mv)} style={{ ...linkBtn(COLORS.danger), fontSize: 12 }}>Eliminar</button>
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
                <div key={cat.id} data-guide="cat-card" style={{ background: '#fff', borderRadius: 16, padding: '14px 18px' }}>
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
                          <button data-guide="cat-edit" onClick={() => { setEditingCat(cat.id); setEditCatForm({ name: cat.name, unit: cat.unit, schema: schema.join(', ') }); }} style={linkBtn()}>Editar</button>
                          <button data-guide="cat-delete" onClick={() => deleteCategoryRow(cat)} style={linkBtn(COLORS.danger)}>Eliminar</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {groupCanModify && (
              <div data-guide="cat-new" style={{ background: '#fff', borderRadius: 16, padding: '16px 18px' }}>
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
                <div key={g.id} data-guide="group-card" style={{ background: '#fff', borderRadius: 16, padding: '14px 18px' }}>
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
                        <button data-guide="group-edit" onClick={() => { setEditingGroup(g.id); setEditGroupForm({ label: g.label, area: g.area, color: g.color }); }} style={linkBtn()}>Editar</button>
                        <button data-guide="group-delete" onClick={() => deleteGroupRow(g)} style={linkBtn(COLORS.danger)}>Eliminar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div data-guide="group-new" style={{ background: '#fff', borderRadius: 16, padding: '16px 18px' }}>
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
                <div key={u.id} data-guide="user-card" style={{ background: '#fff', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}{isMe && <span style={{ fontWeight: 400, color: COLORS.muted }}> (tú)</span>}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{u.email}</div>
                  </div>
                  <div data-guide="user-roles" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ROLE_KEYS.map((r) => (
                      <button key={r} onClick={() => setRole(u, r)} disabled={isMe && r !== 'admin'} style={{ ...chipBtn(u.role === r), opacity: isMe && r !== 'admin' ? 0.4 : 1, cursor: isMe && r !== 'admin' ? 'default' : 'pointer' }}>
                        {ROLE_LABEL[r]}
                      </button>
                    ))}
                  </div>
                  <button data-guide="user-delete" onClick={() => deleteUserRow(u)} disabled={isMe} style={{ border: 'none', background: 'none', color: isMe ? '#C7C5C7' : COLORS.danger, fontSize: 12, cursor: isMe ? 'default' : 'pointer' }}>Eliminar</button>
                </div>
              );
            })}
            <div data-guide="user-new" style={{ background: '#fff', borderRadius: 16, padding: '16px 18px' }}>
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

        {section === 'perfil' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div data-guide="profile-data" style={{ background: '#fff', borderRadius: 16, padding: '18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 48, height: 48, borderRadius: 24, background: COLORS.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, flexShrink: 0 }}>{(user.name || '?').trim().charAt(0).toUpperCase()}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{user.name}</div>
                <div style={{ fontSize: 13, color: COLORS.muted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                <div style={{ display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 600, color: COLORS.primary, background: COLORS.light, borderRadius: 6, padding: '2px 8px' }}>{ROLE_LABEL[user.role]}</div>
              </div>
            </div>
            <div data-guide="profile-guide" style={{ background: '#fff', borderRadius: 16, padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Asistente de uso</div>
                  <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
                    {user.showGuide ? 'Activado: la guía de cada pantalla aparece cada vez que abres la app.' : 'Desactivado: la guía no aparece al abrir la app.'}
                  </div>
                </div>
                <button role="switch" aria-checked={!!user.showGuide} aria-label="Asistente de uso" onClick={() => setGuidePreference(!user.showGuide)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', background: user.showGuide ? COLORS.primary : '#D5D3D6', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background .2s' }}>
                  <span style={{ position: 'absolute', top: 3, left: user.showGuide ? 23 : 3, width: 22, height: 22, borderRadius: 11, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .2s' }} />
                </button>
              </div>
              <button onClick={replayGuideEverywhere} style={{ ...linkBtn(COLORS.primary), fontWeight: 600, marginTop: 12, padding: 0 }}>Ver guía ahora</button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
