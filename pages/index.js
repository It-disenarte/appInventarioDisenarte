import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import LoadingScreen, { LoadingOverlay } from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';
import SideMenu, { SIDE_MENU_WIDTH } from '../components/SideMenu';
import GuideTour from '../components/GuideTour';
import Icon from '../components/Icon';
import { generalSteps, sectionSteps } from '../lib/guideSteps';
import { canModify, canManageGroups, ROLE_KEYS, AREA_KEYS, EXCLUSIVE_ROLES, parseRoles, hasRole, roleLabel } from '../lib/permissions';
import { taskWebUrl } from '../lib/zoho';
import { extraKeys } from '../lib/characteristics';

const COLORS = { primary: '#7C07A6', teal: '#5CC6D0', border: '#E4E1E8', muted: '#62606A', text: '#1D1B22', danger: '#B3261E', success: '#2E7D4F', warn: '#B45F06' };
const ROLE_LABEL = { produccion: 'Producción', diseno: 'Diseño', super: 'Súper', admin: 'Admin' };
const AREA_LABEL = { produccion: 'Producción', diseno: 'Diseño' };
const WIDE_QUERY = '(min-width: 768px)';

const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, fontSize: 14, fontWeight: 500, color: COLORS.text };
const cardTitle = { margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: COLORS.text };
const meta = { fontSize: 13, color: COLORS.muted };
const chipBtn = (active) => ({ minHeight: 34, border: `1px solid ${active ? COLORS.primary : '#D6D2DC'}`, background: active ? 'rgba(124,7,166,.08)' : '#fff', color: active ? COLORS.primary : COLORS.text, borderRadius: 8, padding: '0 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' });
const onlyDigits = (v) => v.replace(/\D/g, '');
const MIN_PASSWORD = 8;
const EMPTY_PW_FORM = { current: '', next: '', confirm: '' };

function Field({ label, flex, children }) {
  return <label style={{ ...labelStyle, flex: flex || '1 1 160px' }}>{label}{children}</label>;
}

function EmptyState({ children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '56px 20px', color: COLORS.muted, fontSize: 14 }}>
      <img src="/favicon.svg" alt="" width={48} height={48} style={{ opacity: 0.9 }} />
      <div>{children}</div>
    </div>
  );
}

function seesMovements(role) { return role === 'admin' || role === 'super'; }

// Producción y Diseño se suman o quitan (al menos uno queda); Súper y Admin reemplazan a los demás.
function toggleRole(current, r) {
  if (EXCLUSIVE_ROLES.includes(r)) return r;
  const areas = parseRoles(current).filter((x) => !EXCLUSIVE_ROLES.includes(x));
  const next = areas.includes(r) ? areas.filter((x) => x !== r) : [...areas, r];
  if (!next.length) return current;
  return ROLE_KEYS.filter((x) => next.includes(x)).join(',');
}

async function api(path, opts) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { window.location.href = '/login'; }
  if (!res.ok) { const err = new Error(data.error || 'Error de red.'); err.status = res.status; throw err; }
  return data;
}

const EXPIRY_WARN_DAYS = 30;
// `car`: valores de las características de la categoría. `extra`: pares { key, value }
// propios del artículo, que no están en la categoría.
const EMPTY_ITEM_FORM = { nombre: '', cantidad: '', reorden: '', codigo: '', metraje: '', proveedor: '', descripcion: '', caducidad: '', car: {}, extra: [] };

function charSummary(cat, item) {
  const values = item.characteristics || {};
  const parts = [];
  if (item.codigo) parts.push(`Código: ${item.codigo}`);
  if (item.metraje) parts.push(`Metraje: ${item.metraje}`);
  if (item.proveedor) parts.push(`Proveedor: ${item.proveedor}`);
  (cat.schema || []).filter((k) => values[k]).forEach((k) => parts.push(`${k}: ${values[k]}`));
  extraKeys(cat.schema, values).forEach((k) => parts.push(`${k}: ${values[k]}`));
  return parts.join(' · ');
}

// Junta las características de la categoría y las extra en un solo objeto para la API.
function formCharacteristics(form, schema) {
  const out = {};
  (form.extra || []).forEach(({ key, value }) => { const k = key.trim(); if (k) out[k] = value; });
  schema.forEach((k) => { if ((form.car || {})[k]) out[k] = form.car[k]; });
  return out;
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
  if (days <= EXPIRY_WARN_DAYS) return { text: `Caduca en ${days} día${days === 1 ? '' : 's'}`, color: COLORS.warn };
  return { text: `Caduca ${fecha}`, color: COLORS.muted };
}

function itemToForm(it, schema) {
  const values = it.characteristics || {};
  const car = {};
  (schema || []).forEach((k) => { if (values[k]) car[k] = values[k]; });
  const extra = extraKeys(schema, values).map((k) => ({ key: k, value: values[k] }));
  return { nombre: it.name, reorden: String(it.reorder), codigo: it.codigo || '', metraje: it.metraje || '', proveedor: it.proveedor || '', descripcion: it.descripcion || '', caducidad: it.caducidad ? String(it.caducidad).slice(0, 10) : '', car, extra };
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
  const [busy, setBusy] = useState(null); // mensaje de la pantalla de carga, o null
  const [showNewUserPw, setShowNewUserPw] = useState(false);
  const [pwForm, setPwForm] = useState(EMPTY_PW_FORM);
  const [showPw, setShowPw] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const [tempPw, setTempPw] = useState(null); // { id, password, copied }: provisional recién generada por el admin
  const [confirmState, setConfirmState] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [installEvent, setInstallEvent] = useState(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // En escritorio (≥ 768 px) el menú lateral queda fijo; en celular se despliega con el botón ☰.
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const update = () => setIsWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // "Instalar como app" solo aparece si el navegador lo ofrece y la app no está instalada.
  useEffect(() => {
    function onPrompt(e) { e.preventDefault(); setInstallEvent(e); }
    function onInstalled() { setInstallEvent(null); }
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  async function installApp() {
    if (!installEvent) return;
    setMenuOpen(false);
    installEvent.prompt();
    await installEvent.userChoice.catch(() => {});
    setInstallEvent(null);
  }

  // Confirmación con el diálogo de la marca: `if (!(await ask({...}))) return;`
  function ask(opts) { return new Promise((resolve) => setConfirmState({ ...opts, resolve })); }
  const answerConfirm = useCallback((ok) => { setConfirmState((s) => { if (s) s.resolve(ok); return null; }); }, []);
  const cancelConfirm = useCallback(() => answerConfirm(false), [answerConfirm]);

  // Asistente de uso. Mientras user.showGuide sea true, cada pantalla muestra su guía
  // la primera vez que se visita en esta sesión (o sea, cada vez que se abre la app).
  const [guideSteps, setGuideSteps] = useState(null);
  const seenGuides = useRef(new Set());
  const closeGuide = useCallback(() => setGuideSteps(null), []);
  // En celular, los pasos del menú abren el cajón; al salir de ellos se cierra solo si lo abrió el asistente.
  const menuOpenRef = useRef(false);
  const guideOpenedMenu = useRef(false);
  useEffect(() => { menuOpenRef.current = menuOpen; }, [menuOpen]);
  const setMenuFromGuide = useCallback((open) => {
    if (open && !menuOpenRef.current) { guideOpenedMenu.current = true; setMenuOpen(true); }
    else if (!open && guideOpenedMenu.current) { guideOpenedMenu.current = false; setMenuOpen(false); }
  }, []);

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

  // La pantalla de carga se queda hasta que abre el login; si el servidor no responde, a los 3 s se va igual.
  async function logout() {
    setMenuOpen(false);
    setBusy('Cerrando sesión…');
    await Promise.race([api('/api/auth/logout', { method: 'POST' }).catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
    router.push('/login');
  }

  function showError(e) { setError(e.message || String(e)); setTimeout(() => setError(''), 4000); }
  async function withBusy(fn, message) {
    setBusy(message || 'Guardando…');
    try { await fn(); } catch (e) {
      showError(e);
      // Si el rol cambió en el servidor, sincroniza la pantalla con los permisos reales.
      if (e.status === 403) loadAll();
    } finally { setBusy(null); }
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
    }, 'Enviando la solicitud a Zoho…');
  }
  async function deleteItemRow(item) {
    if (!(await ask({ title: 'Eliminar artículo', message: `Se eliminará "${item.name}" junto con su historial de movimientos.`, confirmLabel: 'Eliminar', danger: true }))) return;
    await withBusy(async () => {
      await api(`/api/items/${item.id}`, { method: 'DELETE' });
      setItems((s) => s.filter((i) => i.id !== item.id));
      setMovements((s) => s.filter((mv) => mv.itemId !== item.id));
    }, 'Eliminando…');
  }
  async function addItemToCategory(cat) {
    const categoryId = cat.id;
    const form = newItemForms[categoryId] || EMPTY_ITEM_FORM;
    if (!form.nombre.trim()) { showError(new Error('El nombre es obligatorio.')); return; }
    await withBusy(async () => {
      await api('/api/items', { method: 'POST', body: JSON.stringify({ categoryId, name: form.nombre, qty: form.cantidad, reorder: form.reorden, codigo: form.codigo, metraje: form.metraje, proveedor: form.proveedor, descripcion: form.descripcion, caducidad: form.caducidad, characteristics: formCharacteristics(form, cat.schema || []) }) });
      setNewItemForms((s) => ({ ...s, [categoryId]: EMPTY_ITEM_FORM }));
      setOpenNewItem(null);
      await reload('items', 'movements');
    });
  }
  async function saveItemEdit(item, schema) {
    const f = editItemForm;
    if (!f.nombre.trim()) { showError(new Error('El nombre es obligatorio.')); return; }
    await withBusy(async () => {
      const r = await api(`/api/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ name: f.nombre, reorder: f.reorden, codigo: f.codigo, metraje: f.metraje, proveedor: f.proveedor, descripcion: f.descripcion, caducidad: f.caducidad, characteristics: formCharacteristics(f, schema) }) });
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
    await withBusy(async () => { await api(`/api/categories/${cat.id}`, { method: 'DELETE' }); await reload('groups', 'items', 'movements'); }, 'Eliminando…');
  }
  async function addGroup() {
    if (!newGroup.label.trim()) return;
    await withBusy(async () => {
      const r = await api('/api/groups', { method: 'POST', body: JSON.stringify(newGroup) });
      setNewGroup({ label: '', area: 'produccion', color: COLORS.primary });
      await reload('groups');
      setGroupId(r.group.id);
    }, 'Creando grupo…');
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
    await withBusy(async () => { await api(`/api/groups/${g.id}`, { method: 'DELETE' }); await reload('groups', 'items', 'movements'); }, 'Eliminando…');
  }
  async function setRole(u, role) {
    await withBusy(async () => { await api(`/api/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ role }) }); await reload('users'); });
  }
  async function deleteMovementRow(mv) {
    if (!(await ask({ title: 'Eliminar movimiento', message: `Se eliminará el registro de "${mv.item.name}" (${mv.delta > 0 ? '+' : ''}${mv.delta}). La cantidad actual del artículo no cambia.`, confirmLabel: 'Eliminar', danger: true }))) return;
    await withBusy(async () => { await api(`/api/movements?id=${mv.id}`, { method: 'DELETE' }); setMovements((s) => s.filter((m) => m.id !== mv.id)); }, 'Eliminando…');
  }
  async function clearMovements() {
    if (!(await ask({ title: 'Vaciar movimientos', message: `Se eliminarán todos los movimientos de "${currentGroup.label}".\nEsta acción no se puede deshacer.`, confirmLabel: 'Vaciar', danger: true }))) return;
    const gid = currentGroup.id;
    await withBusy(async () => {
      await api(`/api/movements?groupId=${gid}`, { method: 'DELETE' });
      setMovements((s) => s.filter((mv) => mv.item.category.groupId !== gid));
    }, 'Eliminando…');
  }
  async function deleteUserRow(u) {
    if (!(await ask({ title: 'Eliminar usuario', message: `${u.name} (${u.email}) ya no podrá entrar a la app.`, confirmLabel: 'Eliminar', danger: true }))) return;
    await withBusy(async () => { await api(`/api/users/${u.id}`, { method: 'DELETE' }); setUsers((s) => s.filter((x) => x.id !== u.id)); }, 'Eliminando…');
  }
  async function changeMyPassword() {
    if (!pwForm.current || !pwForm.next) return;
    if (pwForm.next.length < MIN_PASSWORD) { showError(new Error(`La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`)); return; }
    if (pwForm.next !== pwForm.confirm) { showError(new Error('La confirmación no coincide con la nueva contraseña.')); return; }
    await withBusy(async () => {
      await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }) });
      setPwForm(EMPTY_PW_FORM);
      setShowPw(false);
      setPwDone(true);
    });
  }
  async function resetUserPassword(u) {
    if (!(await ask({ title: 'Restablecer contraseña', message: `Se generará una contraseña provisional para ${u.name}. Su contraseña actual dejará de funcionar y, al entrar con la provisional, tendrá que crear una nueva.`, confirmLabel: 'Generar' }))) return;
    await withBusy(async () => {
      const r = await api(`/api/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ resetPassword: true }) });
      setTempPw({ id: u.id, password: r.tempPassword, copied: false });
      setUsers((s) => s.map((x) => (x.id === u.id ? { ...x, mustChangePassword: true } : x)));
    }, 'Generando…');
  }
  async function copyTempPassword() {
    try { await navigator.clipboard.writeText(tempPw.password); setTempPw((t) => ({ ...t, copied: true })); }
    catch (e) { showError(new Error('No se pudo copiar. Selecciona la contraseña y cópiala a mano.')); }
  }
  async function addUserAccount() {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password) return;
    if (newUser.password.length < MIN_PASSWORD) { showError(new Error(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`)); return; }
    await withBusy(async () => {
      await api('/api/users', { method: 'POST', body: JSON.stringify(newUser) });
      setNewUser({ name: '', email: '', password: '', role: 'produccion' });
      await reload('users');
    }, 'Creando usuario…');
  }

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16, textAlign: 'center' }}>
        <img src="/favicon.svg" alt="Inventario" width={56} height={56} />
        <div style={{ fontSize: 14, color: COLORS.muted }}>{loadError}</div>
        <button onClick={loadAll} className="btn btn-primario">Reintentar</button>
      </div>
    );
  }
  if (loading || !user) return <LoadingScreen label="Cargando inventario…" />;

  const currentGroup = groups.find((g) => g.id === groupId) || groups[0];
  const groupCanModify = currentGroup ? canModify(user.role, currentGroup.area) : false;
  const groupItems = items.filter((it) => it.category.groupId === (currentGroup ? currentGroup.id : null));
  const groupMovements = movements.filter((mv) => mv.item.category.groupId === (currentGroup ? currentGroup.id : null));

  const canSeeMovements = seesMovements(user.role);
  const canEditGroups = canManageGroups(user.role);
  // Vistas del grupo seleccionado y vistas de administración (menú lateral).
  const views = [
    { key: 'inventarios', label: 'Artículos', icon: 'package' },
    ...(canSeeMovements ? [{ key: 'movimientos', label: 'Movimientos', icon: 'history' }] : []),
    { key: 'categorias', label: 'Categorías', icon: 'tags' },
  ];
  const adminViews = [
    ...(canEditGroups ? [{ key: 'grupos', label: 'Grupos', icon: 'layers' }] : []),
    ...(user.role === 'admin' ? [{ key: 'admin', label: 'Usuarios', icon: 'users' }] : []),
  ];
  const currentView = views.find((v) => v.key === section);
  const pageTitle = currentView ? currentView.label : section === 'perfil' ? 'Mi perfil' : (adminViews.find((v) => v.key === section) || {}).label;
  const pageContext = currentView ? (currentGroup ? currentGroup.label : null) : section === 'perfil' ? `Hola, ${(user.name || '').trim().split(/\s+/)[0]}` : 'Administración';
  function selectGroup(id) {
    setGroupId(id);
    if (!currentView) setSection('inventarios');
    setMenuOpen(false);
  }
  function selectSection(key) { setSection(key); setMenuOpen(false); }
  function helpFromMenu() { setMenuOpen(false); openGuide(section, false); }
  function toggleGuideFromMenu() { if (!isWide) setMenuOpen(false); setGuidePreference(!user.showGuide); }
  const noGroups = !currentGroup && ['inventarios', 'movimientos', 'categorias'].includes(section);

  function groupForm(form, setForm) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <Field label="Nombre" flex="1 1 auto">
            <input className="campo" placeholder="p. ej. Producción · Insumos" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          </Field>
          <Field label="Color" flex="0 0 auto">
            <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} title="Color que identifica al grupo" style={{ width: 48, height: 42, border: '1px solid #D6D2DC', borderRadius: 8, padding: 3, background: '#fff', cursor: 'pointer' }} />
          </Field>
        </div>
        <div style={labelStyle}>
          Área que lo modifica
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AREA_KEYS.map((a) => (
              <button key={a} type="button" onClick={() => setForm((f) => ({ ...f, area: a }))} style={chipBtn(form.area === a)}>{AREA_LABEL[a]}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Formulario de artículo, compartido por "nuevo" (con cantidad inicial) y "editar".
  function itemForm(form, patch, schema, isNew) {
    const field = (label, key, props, flex, clean) => (
      <Field key={key} label={label} flex={flex}>
        <input className="campo" value={form[key] || ''} onChange={(e) => patch({ [key]: clean ? clean(e.target.value) : e.target.value })} {...props} />
      </Field>
    );
    const number = { inputMode: 'numeric', pattern: '[0-9]*' };
    const extra = form.extra || [];
    const setExtra = (i, change) => patch({ extra: extra.map((row, j) => (j === i ? { ...row, ...change } : row)) });
    return (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {field('Nombre *', 'nombre', {}, '2 1 220px')}
        {field('Código', 'codigo')}
        {isNew && field('Cantidad', 'cantidad', number, '0 1 110px', onlyDigits)}
        {field('Reorden', 'reorden', number, '0 1 110px', onlyDigits)}
        {field('Metraje', 'metraje', { placeholder: 'p. ej. 1.22 x 50 m' })}
        {field('Proveedor', 'proveedor')}
        {field('Fecha de caducidad', 'caducidad', { type: 'date' })}
        {schema.map((k) => (
          <Field key={`car-${k}`} label={k}>
            <input className="campo" value={(form.car || {})[k] || ''} onChange={(e) => patch({ car: { ...(form.car || {}), [k]: e.target.value } })} />
          </Field>
        ))}
        {extra.map((row, i) => (
          <div key={`extra-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flex: '1 1 100%', flexWrap: 'wrap' }}>
            <Field label="Característica" flex="1 1 140px">
              <input className="campo" placeholder="p. ej. Acabado" maxLength={60} value={row.key} onChange={(e) => setExtra(i, { key: e.target.value })} />
            </Field>
            <Field label="Valor" flex="2 1 180px">
              <input className="campo" value={row.value} onChange={(e) => setExtra(i, { value: e.target.value })} />
            </Field>
            <button type="button" onClick={() => patch({ extra: extra.filter((_, j) => j !== i) })} className="btn btn-fantasma" aria-label="Quitar característica" style={{ width: 42, height: 42, padding: 0 }}><Icon name="x" size={16} /></button>
          </div>
        ))}
        <div style={{ flex: '1 1 100%' }}>
          <button type="button" onClick={() => patch({ extra: [...extra, { key: '', value: '' }] })} className="btn btn-fantasma btn-sm"><Icon name="plus" size={14} />Agregar característica</button>
        </div>
        <Field label="Descripción" flex="1 1 100%">
          <textarea className="campo" rows={2} value={form.descripcion || ''} onChange={(e) => patch({ descripcion: e.target.value })} />
        </Field>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', color: COLORS.text }}>
      {guideSteps && (
        <GuideTour steps={guideSteps} onClose={closeGuide} onDisable={() => setGuidePreference(false)} onMenu={setMenuFromGuide} sideMenu={isWide} />
      )}
      {confirmState && (
        <ConfirmDialog title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={() => answerConfirm(true)} onCancel={cancelConfirm} />
      )}
      {busy && <LoadingOverlay message={busy} />}
      <SideMenu
        open={menuOpen} persistent={isWide} onClose={closeMenu}
        groups={groups} groupId={currentGroup ? currentGroup.id : null} onSelectGroup={selectGroup}
        views={views} adminViews={adminViews} section={section} onSelectSection={selectSection}
        user={user} roleLabel={roleLabel(user.role)} onLogout={logout}
        showGuide={user.showGuide} onToggleGuide={toggleGuideFromMenu} onHelp={helpFromMenu}
        onInstall={installEvent ? installApp : null}
      />

      <div style={{ paddingLeft: isWide ? SIDE_MENU_WIDTH : 0 }}>
      {!isWide && (
        <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--morado)', color: '#fff', paddingTop: 'env(safe-area-inset-top)' }}>
          <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px' }}>
            <button data-guide="menu-button" className="menu-icono" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
              <Icon name="menu" size={24} />
            </button>
            <img src="/favicon.svg" alt="" width={30} height={30} />
            <span style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>Inventario</span>
            <button data-guide="help-button" className="menu-icono" onClick={() => openGuide(section, false)} aria-label="Ver guía de esta pantalla" title="Ver guía de esta pantalla">
              <Icon name="help" size={22} />
            </button>
          </div>
          <div style={{ height: 3, background: 'var(--filete)' }} />
        </header>
      )}

      <main style={{ maxWidth: 900, margin: '0 auto', padding: isWide ? '32px 24px 48px' : '20px 16px 40px' }}>
        <div data-guide="header-title" style={{ marginBottom: 20 }}>
          {pageContext && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: COLORS.muted, marginBottom: 2 }}>
              {currentView && currentGroup && <span style={{ width: 10, height: 10, borderRadius: 5, background: currentGroup.color, flexShrink: 0 }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pageContext}</span>
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: isWide ? 28 : 24, fontWeight: 600, color: COLORS.primary }}>{pageTitle}</h1>
        </div>

        {error && <div role="alert" style={{ background: 'var(--error-fondo)', color: COLORS.danger, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>{error}</div>}

        {noGroups && (
          <EmptyState>Aún no hay grupos de inventario.{canEditGroups && <> Créalos en la sección <b>Grupos</b>.</>}</EmptyState>
        )}

        {section === 'inventarios' && currentGroup && (
          <div>
            {currentGroup.categories.map((cat) => {
              const catItems = groupItems.filter((it) => it.categoryId === cat.id);
              const schema = cat.schema || [];
              const form = newItemForms[cat.id] || EMPTY_ITEM_FORM;
              const setForm = (patch) => setNewItemForms((s) => ({ ...s, [cat.id]: { ...(s[cat.id] || EMPTY_ITEM_FORM), ...patch } }));
              return (
                <section key={cat.id} style={{ marginBottom: 24 }}>
                  <h2 data-guide="cat-heading" style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: COLORS.muted, padding: '0 4px 8px' }}>{cat.name} · {cat.unit}</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {catItems.map((it) => {
                      const low = it.qty <= it.reorder;
                      const details = charSummary(cat, it);
                      const expiry = expiryInfo(it.caducidad);
                      const isEditing = editingItem === it.id;
                      return (
                        <div key={it.id} data-guide="item-card" className="tarjeta" style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 600 }}>{it.name}</div>
                              {details && <div style={{ fontSize: 13, color: '#4B4853' }}>{details}</div>}
                              {it.descripcion && <div style={{ fontSize: 13, color: COLORS.muted, whiteSpace: 'pre-wrap' }}>{it.descripcion}</div>}
                              <div style={meta}>
                                <span style={{ color: low ? COLORS.warn : COLORS.muted, fontWeight: low ? 600 : 400 }}>{it.qty === 0 ? 'Agotado' : low ? 'Bajo mínimo' : 'Stock ok'}</span> · reorden {it.reorder}
                                {expiry && <> · <span style={{ color: expiry.color, fontWeight: expiry.color === COLORS.muted ? 400 : 600 }}>{expiry.text}</span></>}
                              </div>
                              {low && (it.zohoTaskId ? (
                                <div data-guide="item-restock-status" style={{ ...meta, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  Solicitado{it.zohoRequestedAt && ` el ${new Date(it.zohoRequestedAt).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })}`} ·
                                  <a href={taskWebUrl(it.zohoTaskId)} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.primary, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ver en Zoho <Icon name="external" size={13} /></a>
                                </div>
                              ) : (
                                <button data-guide="item-restock" onClick={() => requestRestock(it)} className="btn btn-contorno btn-sm" style={{ marginTop: 8 }}>
                                  Solicitar reabastecimiento
                                </button>
                              ))}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 'auto' }}>
                              <div data-guide="item-qty" style={{ fontSize: 22, fontWeight: 700, whiteSpace: 'nowrap' }}>{it.qty}<span style={{ fontSize: 12, fontWeight: 400, color: COLORS.muted }}> {cat.unit}</span></div>
                              {groupCanModify && (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button data-guide="item-minus" onClick={() => adjustItem(it, -1)} disabled={it.qty === 0} className="btn btn-contorno" aria-label={`Restar 1 a ${it.name}`} style={{ width: 38, height: 38, padding: 0 }}><Icon name="minus" size={18} /></button>
                                  <button data-guide="item-plus" onClick={() => adjustItem(it, 1)} className="btn btn-contorno" aria-label={`Sumar 1 a ${it.name}`} style={{ width: 38, height: 38, padding: 0 }}><Icon name="plus" size={18} /></button>
                                </div>
                              )}
                            </div>
                          </div>
                          {groupCanModify && !isEditing && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
                              <button data-guide="item-edit" onClick={() => { setEditingItem(it.id); setEditItemForm(itemToForm(it, schema)); }} className="btn btn-fantasma btn-sm"><Icon name="pencil" size={14} />Editar</button>
                              <button data-guide="item-delete" onClick={() => deleteItemRow(it)} className="btn btn-peligro btn-sm"><Icon name="trash" size={14} />Eliminar</button>
                            </div>
                          )}
                          {isEditing && (
                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.border}` }}>
                              {itemForm(editItemForm, (p) => setEditItemForm((f) => ({ ...f, ...p })), schema, false)}
                              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                                <button onClick={() => saveItemEdit(it, schema)} className="btn btn-primario">Guardar</button>
                                <button onClick={() => setEditingItem(null)} className="btn btn-contorno">Cancelar</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {groupCanModify && (openNewItem === cat.id ? (
                    <div data-guide="add-item" className="tarjeta" style={{ padding: 16, marginTop: 8 }}>
                      <h3 style={cardTitle}>Nuevo artículo en {cat.name}</h3>
                      {itemForm(form, setForm, schema, true)}
                      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <button onClick={() => addItemToCategory(cat)} className="btn btn-primario">Agregar</button>
                        <button onClick={() => setOpenNewItem(null)} className="btn btn-contorno">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button data-guide="add-item" onClick={() => setOpenNewItem(cat.id)} className="btn btn-fantasma" style={{ marginTop: 8 }}><Icon name="plus" size={16} />Agregar artículo</button>
                  ))}
                </section>
              );
            })}
            {currentGroup.categories.length === 0 && <EmptyState>Aún no hay categorías en este inventario.</EmptyState>}
          </div>
        )}

        {section === 'movimientos' && canSeeMovements && currentGroup && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button data-guide="mov-clear" onClick={clearMovements} disabled={groupMovements.length === 0} className="btn btn-peligro btn-sm"><Icon name="trash" size={14} />Vaciar movimientos de este inventario</button>
            </div>
            <div className="tarjeta" style={{ padding: '4px 20px' }}>
              {groupMovements.length === 0 && <EmptyState>Aún no hay movimientos.</EmptyState>}
              {groupMovements.map((mv, n) => (
                <div key={mv.id} data-guide="mov-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: n ? `1px solid ${COLORS.border}` : 'none' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{mv.item.name}</div>
                    <div style={meta}>{mv.item.category.name} · {new Date(mv.fecha).toLocaleString('es-MX')} · {mv.usuario}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: mv.delta > 0 ? COLORS.success : COLORS.primary }}>{mv.delta > 0 ? `+${mv.delta}` : mv.delta}</div>
                      <div style={{ fontSize: 12, color: COLORS.muted, whiteSpace: 'nowrap' }}>{mv.antes} → {mv.despues}</div>
                    </div>
                    <button data-guide="mov-delete" onClick={() => deleteMovementRow(mv)} className="btn btn-peligro btn-sm" aria-label={`Eliminar movimiento de ${mv.item.name}`} title="Eliminar" style={{ padding: '0 8px' }}><Icon name="trash" size={16} /></button>
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
                <div key={cat.id} data-guide="cat-card" className="tarjeta" style={{ padding: '14px 18px' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <Field label="Nombre" flex="2 1 180px"><input className="campo" value={editCatForm.name} onChange={(e) => setEditCatForm((f) => ({ ...f, name: e.target.value }))} /></Field>
                      <Field label="Unidad" flex="1 1 140px"><input className="campo" value={editCatForm.unit} onChange={(e) => setEditCatForm((f) => ({ ...f, unit: e.target.value }))} /></Field>
                      <Field label="Características (separadas por comas)" flex="1 1 100%"><input className="campo" value={editCatForm.schema} onChange={(e) => setEditCatForm((f) => ({ ...f, schema: e.target.value }))} /></Field>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => saveEditCategory(cat)} className="btn btn-primario">Guardar</button>
                        <button onClick={() => setEditingCat(null)} className="btn btn-contorno">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{cat.name}</div>
                        <div style={meta}>{cat.unit} · {count} artículo(s){schema.length > 0 && ` · ${schema.join(', ')}`}</div>
                      </div>
                      {groupCanModify && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button data-guide="cat-edit" onClick={() => { setEditingCat(cat.id); setEditCatForm({ name: cat.name, unit: cat.unit, schema: schema.join(', ') }); }} className="btn btn-fantasma btn-sm"><Icon name="pencil" size={14} />Editar</button>
                          <button data-guide="cat-delete" onClick={() => deleteCategoryRow(cat)} className="btn btn-peligro btn-sm"><Icon name="trash" size={14} />Eliminar</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {currentGroup.categories.length === 0 && <EmptyState>Aún no hay categorías en este inventario.</EmptyState>}
            {groupCanModify && (
              <div data-guide="cat-new" className="tarjeta" style={{ padding: 18 }}>
                <h3 style={cardTitle}>Nueva categoría</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Field label="Nombre" flex="2 1 180px"><input className="campo" placeholder="p. ej. Acrílicos" value={newCat.name} onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value }))} /></Field>
                  <Field label="Unidad" flex="1 1 140px"><input className="campo" placeholder="piezas" value={newCat.unit} onChange={(e) => setNewCat((c) => ({ ...c, unit: e.target.value }))} /></Field>
                  <Field label="Características (opcional)" flex="1 1 100%"><input className="campo" placeholder="p. ej. Color, Espesor" value={newCat.schema} onChange={(e) => setNewCat((c) => ({ ...c, schema: e.target.value }))} /></Field>
                </div>
                <button onClick={addCategory} className="btn btn-primario" style={{ marginTop: 14 }}>Agregar</button>
              </div>
            )}
          </div>
        )}

        {section === 'grupos' && canEditGroups && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map((g) => {
              const isEditing = editingGroup === g.id;
              return (
                <div key={g.id} data-guide="group-card" className="tarjeta" style={{ padding: '14px 18px' }}>
                  {isEditing ? (
                    <div>
                      {groupForm(editGroupForm, setEditGroupForm)}
                      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <button onClick={() => saveEditGroup(g)} className="btn btn-primario">Guardar</button>
                        <button onClick={() => setEditingGroup(null)} className="btn btn-contorno">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 6, background: g.color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>{g.label}</div>
                          <div style={meta}>Área: {AREA_LABEL[g.area] || g.area} · {g.categories.length} categoría(s)</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button data-guide="group-edit" onClick={() => { setEditingGroup(g.id); setEditGroupForm({ label: g.label, area: g.area, color: g.color }); }} className="btn btn-fantasma btn-sm"><Icon name="pencil" size={14} />Editar</button>
                        <button data-guide="group-delete" onClick={() => deleteGroupRow(g)} className="btn btn-peligro btn-sm"><Icon name="trash" size={14} />Eliminar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div data-guide="group-new" className="tarjeta" style={{ padding: 18 }}>
              <h3 style={cardTitle}>Nuevo grupo de inventario</h3>
              {groupForm(newGroup, setNewGroup)}
              <button onClick={addGroup} className="btn btn-primario" style={{ marginTop: 14 }}>Agregar grupo</button>
            </div>
          </div>
        )}

        {section === 'admin' && user.role === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map((u) => {
              const isMe = u.id === user.id;
              return (
                <div key={u.id} data-guide="user-card" className="tarjeta" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}{isMe && <span style={{ fontWeight: 400, color: COLORS.muted }}> (tú)</span>}</div>
                    <div style={{ ...meta, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div data-guide="user-roles" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {ROLE_KEYS.map((r) => (
                        <button key={r} onClick={() => { const next = toggleRole(u.role, r); if (next !== u.role) setRole(u, next); }} disabled={isMe && r !== 'admin'} aria-pressed={hasRole(u.role, r)} style={{ ...chipBtn(hasRole(u.role, r)), opacity: isMe && r !== 'admin' ? 0.4 : 1, cursor: isMe && r !== 'admin' ? 'default' : 'pointer' }}>
                          {ROLE_LABEL[r]}
                        </button>
                      ))}
                    </div>
                    {!isMe && <button data-guide="user-password" onClick={() => resetUserPassword(u)} className="btn btn-fantasma btn-sm"><Icon name="key" size={14} />Contraseña</button>}
                    <button data-guide="user-delete" onClick={() => deleteUserRow(u)} disabled={isMe} className="btn btn-peligro btn-sm"><Icon name="trash" size={14} />Eliminar</button>
                  </div>
                  {tempPw && tempPw.id === u.id ? (
                    <div style={{ flexBasis: '100%', border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '12px 14px' }}>
                      <div style={meta}>Contraseña provisional de {u.name}. Compártela por un medio privado; solo se muestra esta vez.</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <code style={{ fontSize: 18, fontWeight: 600, letterSpacing: 1, color: COLORS.text, userSelect: 'all' }}>{tempPw.password}</code>
                        <button onClick={copyTempPassword} className="btn btn-contorno btn-sm">{tempPw.copied ? 'Copiada' : 'Copiar'}</button>
                        <button onClick={() => setTempPw(null)} className="btn btn-fantasma btn-sm">Listo</button>
                      </div>
                    </div>
                  ) : u.mustChangePassword && (
                    <div style={{ flexBasis: '100%', ...meta }}>Contraseña provisional: la cambiará al entrar.</div>
                  )}
                </div>
              );
            })}
            <div data-guide="user-new" className="tarjeta" style={{ padding: 18 }}>
              <h3 style={cardTitle}>Nuevo usuario</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Field label="Nombre"><input className="campo" value={newUser.name} onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))} /></Field>
                <Field label="Correo"><input className="campo" type="email" autoComplete="off" placeholder="nombre@disenartemx.com" value={newUser.email} onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))} /></Field>
                <Field label="Contraseña">
                  <div style={{ position: 'relative' }}>
                    <input className="campo" autoComplete="new-password" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} type={showNewUserPw ? 'text' : 'password'} style={{ paddingRight: 84 }} />
                    <button type="button" onClick={() => setShowNewUserPw((v) => !v)} className="btn btn-fantasma btn-sm" style={{ position: 'absolute', right: 5, top: 5 }}>{showNewUserPw ? 'Ocultar' : 'Ver'}</button>
                  </div>
                </Field>
              </div>
              <div style={{ ...labelStyle, marginTop: 14 }}>
                Rol
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ROLE_KEYS.map((r) => (
                    <button key={r} type="button" onClick={() => setNewUser((u) => ({ ...u, role: toggleRole(u.role, r) }))} aria-pressed={hasRole(newUser.role, r)} style={chipBtn(hasRole(newUser.role, r))}>
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={addUserAccount} className="btn btn-primario" style={{ marginTop: 14 }}>Agregar usuario</button>
            </div>
          </div>
        )}

        {section === 'perfil' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div data-guide="profile-data" className="tarjeta" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 48, height: 48, borderRadius: 24, background: COLORS.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, flexShrink: 0 }}>{(user.name || '?').trim().charAt(0).toUpperCase()}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{user.name}</div>
                <div style={{ ...meta, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                <div style={{ display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 600, color: COLORS.primary, background: 'var(--muted)', borderRadius: 6, padding: '2px 8px' }}>{roleLabel(user.role)}</div>
              </div>
            </div>
            <div data-guide="profile-guide" className="tarjeta" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Asistente de uso</div>
                  <div style={{ ...meta, marginTop: 2 }}>
                    {user.showGuide ? 'Activado: la guía de cada pantalla aparece cada vez que abres la app.' : 'Desactivado: la guía no aparece al abrir la app.'}
                  </div>
                </div>
                <button role="switch" aria-checked={!!user.showGuide} aria-label="Asistente de uso" onClick={() => setGuidePreference(!user.showGuide)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', background: user.showGuide ? COLORS.teal : '#D6D2DC', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background .2s' }}>
                  <span style={{ position: 'absolute', top: 3, left: user.showGuide ? 23 : 3, width: 22, height: 22, borderRadius: 11, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .2s' }} />
                </button>
              </div>
              <button onClick={replayGuideEverywhere} className="btn btn-fantasma" style={{ marginTop: 12, marginLeft: -10 }}>Ver guía ahora</button>
            </div>
            {user.role === 'admin' && <form data-guide="profile-password" className="tarjeta" style={{ padding: 18 }} onSubmit={(e) => { e.preventDefault(); changeMyPassword(); }}>
              <h3 style={cardTitle}>Cambiar contraseña</h3>
              <input type="email" autoComplete="username" value={user.email} readOnly hidden />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[['current', 'Contraseña actual', 'current-password'], ['next', 'Nueva contraseña', 'new-password'], ['confirm', 'Confirmar nueva', 'new-password']].map(([key, label, ac]) => (
                  <Field key={key} label={label}>
                    <input className="campo" type={showPw ? 'text' : 'password'} autoComplete={ac} value={pwForm[key]} onChange={(e) => { setPwDone(false); setPwForm((f) => ({ ...f, [key]: e.target.value })); }} />
                  </Field>
                ))}
              </div>
              <div style={{ ...meta, marginTop: 8 }}>Mínimo {MIN_PASSWORD} caracteres.</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn-primario" disabled={!pwForm.current || !pwForm.next || !pwForm.confirm}>Cambiar contraseña</button>
                <button type="button" onClick={() => setShowPw((v) => !v)} className="btn btn-fantasma">{showPw ? 'Ocultar' : 'Ver'}</button>
                {pwDone && <span role="status" style={{ fontSize: 14, fontWeight: 500, color: COLORS.success }}>Contraseña actualizada.</span>}
              </div>
            </form>}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
