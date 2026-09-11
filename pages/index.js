import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import LoadingScreen from '../components/LoadingScreen';

const COLORS = { primary: '#A53692', teal: '#5CC6D0', bg: '#FDF8FB', border: '#F1EEF0', muted: '#96989A', text: '#1D1B1E', danger: '#B3261E', light: '#FBD9F2' };
const ROLE_LABEL = { produccion: 'Producción', diseno: 'Diseño', super: 'Súper', admin: 'Admin' };
const ROLE_KEYS = ['produccion', 'diseno', 'super', 'admin'];

function canModify(role, area) {
  if (!role) return false;
  if (role === 'admin' || role === 'super') return true;
  if (role === 'produccion') return area === 'produccion';
  if (role === 'diseno') return area === 'diseno';
  return false;
}

async function api(path, opts) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de red.');
  return data;
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [users, setUsers] = useState([]);
  const [groupId, setGroupId] = useState(null);
  const [section, setSection] = useState('inventarios');
  const [error, setError] = useState('');
  const [newCat, setNewCat] = useState({ name: '', unit: '' });
  const [newItemForms, setNewItemForms] = useState({});
  const [editingCat, setEditingCat] = useState(null);
  const [editCatForm, setEditCatForm] = useState({ name: '', unit: '' });
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'produccion' });
  const [busy, setBusy] = useState(false);
  const [showNewUserPw, setShowNewUserPw] = useState(false);

  const loadAll = useCallback(async () => {
    const me = await api('/api/auth/me');
    if (!me.user) { router.push('/login'); return; }
    setUser(me.user);
    const g = await api('/api/groups');
    setGroups(g.groups);
    if (g.groups.length) setGroupId((prev) => prev || g.groups[0].id);
    const it = await api('/api/items');
    setItems(it.items);
    const mv = await api('/api/movements');
    setMovements(mv.movements);
    if (me.user.role === 'admin') {
      const us = await api('/api/users');
      setUsers(us.users);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  function showError(e) { setError(e.message || String(e)); setTimeout(() => setError(''), 4000); }
  async function withBusy(fn) { setBusy(true); try { await fn(); } catch (e) { showError(e); } finally { setBusy(false); } }

  async function adjustItem(item, delta) {
    await withBusy(async () => { await api(`/api/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ delta }) }); await loadAll(); });
  }
  async function deleteItemRow(item) {
    if (!window.confirm(`¿Eliminar "${item.name}"?`)) return;
    await withBusy(async () => { await api(`/api/items/${item.id}`, { method: 'DELETE' }); await loadAll(); });
  }
  async function addItemToCategory(categoryId) {
    const form = newItemForms[categoryId] || {};
    if (!form.nombre) return;
    await withBusy(async () => {
      await api('/api/items', { method: 'POST', body: JSON.stringify({ categoryId, name: form.nombre, qty: form.cantidad, reorder: form.reorden }) });
      setNewItemForms((s) => ({ ...s, [categoryId]: { nombre: '', cantidad: '', reorden: '' } }));
      await loadAll();
    });
  }
  async function addCategory() {
    if (!newCat.name.trim()) return;
    await withBusy(async () => {
      await api('/api/categories', { method: 'POST', body: JSON.stringify({ groupId, name: newCat.name, unit: newCat.unit || 'piezas' }) });
      setNewCat({ name: '', unit: '' });
      await loadAll();
    });
  }
  async function saveEditCategory(cat) {
    await withBusy(async () => {
      await api(`/api/categories/${cat.id}`, { method: 'PATCH', body: JSON.stringify({ name: editCatForm.name, unit: editCatForm.unit }) });
      setEditingCat(null);
      await loadAll();
    });
  }
  async function deleteCategoryRow(cat) {
    const count = groupItems.filter((it) => it.categoryId === cat.id).length;
    if (!window.confirm(count > 0 ? `"${cat.name}" tiene ${count} artículo(s). ¿Eliminar la categoría y todos sus artículos?` : `¿Eliminar la categoría "${cat.name}"?`)) return;
    await withBusy(async () => { await api(`/api/categories/${cat.id}`, { method: 'DELETE' }); await loadAll(); });
  }
  async function setRole(u, role) {
    await withBusy(async () => { await api(`/api/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ role }) }); await loadAll(); });
  }
  async function deleteUserRow(u) {
    if (!window.confirm(`¿Eliminar a ${u.name}?`)) return;
    await withBusy(async () => { await api(`/api/users/${u.id}`, { method: 'DELETE' }); await loadAll(); });
  }
  async function addUserAccount() {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password) return;
    await withBusy(async () => {
      await api('/api/users', { method: 'POST', body: JSON.stringify(newUser) });
      setNewUser({ name: '', email: '', password: '', role: 'produccion' });
      await loadAll();
    });
  }

  if (loading || !user) return <LoadingScreen label="Cargando inventario..." />;

  const currentGroup = groups.find((g) => g.id === groupId) || groups[0];
  const groupCanModify = currentGroup ? canModify(user.role, currentGroup.area) : false;
  const groupItems = items.filter((it) => it.category.groupId === (currentGroup ? currentGroup.id : null));
  const groupMovements = movements.filter((mv) => mv.item.category.groupId === (currentGroup ? currentGroup.id : null));

  const navDefs = [
    { key: 'inventarios', label: 'Inventarios' },
    { key: 'movimientos', label: 'Movimientos' },
    { key: 'categorias', label: 'Categorías' },
  ];
  if (user.role === 'admin') navDefs.push({ key: 'admin', label: 'Administración' });

  return (
    <div style={{ fontFamily: "'Outfit', system-ui, sans-serif", minHeight: '100vh', background: COLORS.bg, color: COLORS.text, position: 'relative' }}>
      {busy && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(253,248,251,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ width: 40, height: 40, border: '4px solid #F1EEF0', borderTopColor: COLORS.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: `1px solid ${COLORS.border}`, position: 'sticky', top: 0, background: COLORS.bg, zIndex: 5 }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: COLORS.primary }}>Inventario</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: COLORS.muted }}>{ROLE_LABEL[user.role]}</div>
          </div>
          <button onClick={logout} style={{ border: 'none', background: 'none', color: COLORS.muted, fontSize: 12, cursor: 'pointer' }}>Salir</button>
        </div>
      </div>

      {section !== 'admin' && (
        <div style={{ display: 'flex', gap: 4, padding: '0 12px', borderBottom: `1px solid ${COLORS.border}`, overflowX: 'auto' }}>
          {groups.map((g) => (
            <button key={g.id} onClick={() => setGroupId(g.id)} style={{ border: 'none', background: 'none', padding: '14px 14px 12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', color: g.id === groupId ? g.color : COLORS.muted, borderBottom: g.id === groupId ? `3px solid ${g.color}` : '3px solid transparent' }}>
              {g.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}` }}>
        {navDefs.map((n) => (
          <button key={n.key} onClick={() => setSection(n.key)} style={{ border: 'none', background: section === n.key ? COLORS.light : 'transparent', color: section === n.key ? COLORS.primary : COLORS.muted, borderRadius: 20, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {n.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
        {error && <div style={{ background: '#FDEDEE', color: COLORS.danger, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>{error}</div>}

        {section === 'inventarios' && currentGroup && (
          <div>
            {currentGroup.categories.map((cat) => {
              const catItems = groupItems.filter((it) => it.categoryId === cat.id);
              const form = newItemForms[cat.id] || { nombre: '', cantidad: '', reorden: '' };
              return (
                <div key={cat.id} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: COLORS.muted, padding: '8px 4px' }}>{cat.name} · {cat.unit}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {catItems.map((it) => {
                      const low = it.qty <= it.reorder;
                      return (
                        <div key={it.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 600 }}>{it.name}</div>
                            <div style={{ fontSize: 12, color: low ? '#E8A33D' : COLORS.muted }}>{low ? 'Bajo mínimo' : 'Stock ok'} · reorden {it.reorder}</div>
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 700 }}>{it.qty}<span style={{ fontSize: 12, fontWeight: 400, color: COLORS.muted }}> {cat.unit}</span></div>
                          {groupCanModify && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => adjustItem(it, -1)} style={{ width: 34, height: 34, borderRadius: 17, border: `1px solid ${COLORS.muted}`, background: '#fff', cursor: 'pointer' }}>−</button>
                              <button onClick={() => adjustItem(it, 1)} style={{ width: 34, height: 34, borderRadius: 17, border: `1px solid ${COLORS.muted}`, background: '#fff', cursor: 'pointer' }}>+</button>
                              <button onClick={() => deleteItemRow(it)} style={{ border: 'none', background: 'none', color: COLORS.danger, fontSize: 12, cursor: 'pointer' }}>Eliminar</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {groupCanModify && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <input placeholder="Nombre" value={form.nombre} onChange={(e) => setNewItemForms((s) => ({ ...s, [cat.id]: { ...form, nombre: e.target.value } }))} style={{ flex: 2, minWidth: 140, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13 }} />
                      <input placeholder="Cantidad" type="number" value={form.cantidad} onChange={(e) => setNewItemForms((s) => ({ ...s, [cat.id]: { ...form, cantidad: e.target.value } }))} style={{ width: 90, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13 }} />
                      <input placeholder="Reorden" type="number" value={form.reorden} onChange={(e) => setNewItemForms((s) => ({ ...s, [cat.id]: { ...form, reorden: e.target.value } }))} style={{ width: 90, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13 }} />
                      <button onClick={() => addItemToCategory(cat.id)} style={{ border: 'none', background: COLORS.primary, color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Agregar</button>
                    </div>
                  )}
                </div>
              );
            })}
            {currentGroup.categories.length === 0 && <div style={{ textAlign: 'center', padding: '60px 20px', color: COLORS.muted }}>Aún no hay categorías en este inventario.</div>}
          </div>
        )}

        {section === 'movimientos' && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '4px 20px' }}>
            {groupMovements.length === 0 && <div style={{ textAlign: 'center', padding: '60px 20px', color: COLORS.muted }}>Aún no hay movimientos.</div>}
            {groupMovements.map((mv) => (
              <div key={mv.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{mv.item.name}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>{mv.item.category.name} · {new Date(mv.fecha).toLocaleString('es-MX')} · {mv.usuario}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: mv.delta > 0 ? COLORS.teal : COLORS.primary }}>{mv.delta > 0 ? `+${mv.delta}` : mv.delta}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{mv.antes} → {mv.despues}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {section === 'categorias' && currentGroup && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentGroup.categories.map((cat) => {
              const count = groupItems.filter((it) => it.categoryId === cat.id).length;
              const isEditing = editingCat === cat.id;
              return (
                <div key={cat.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 18px' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input value={editCatForm.name} onChange={(e) => setEditCatForm((f) => ({ ...f, name: e.target.value }))} style={{ flex: 2, minWidth: 120, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 14 }} />
                      <input value={editCatForm.unit} onChange={(e) => setEditCatForm((f) => ({ ...f, unit: e.target.value }))} style={{ flex: 1, minWidth: 100, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 14 }} />
                      <button onClick={() => saveEditCategory(cat)} style={{ border: 'none', background: COLORS.primary, color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
                      <button onClick={() => setEditingCat(null)} style={{ border: 'none', background: 'none', color: COLORS.muted, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{cat.name}</div>
                        <div style={{ fontSize: 12, color: COLORS.muted }}>{cat.unit} · {count} artículo(s)</div>
                      </div>
                      {groupCanModify && (
                        <div style={{ display: 'flex', gap: 12 }}>
                          <button onClick={() => { setEditingCat(cat.id); setEditCatForm({ name: cat.name, unit: cat.unit }); }} style={{ border: 'none', background: 'none', fontSize: 13, cursor: 'pointer' }}>Editar</button>
                          <button onClick={() => deleteCategoryRow(cat)} style={{ border: 'none', background: 'none', color: COLORS.danger, fontSize: 13, cursor: 'pointer' }}>Eliminar</button>
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
                  <input placeholder="Nombre" value={newCat.name} onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value }))} style={{ flex: 2, minWidth: 140, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 14 }} />
                  <input placeholder="Unidad (p.ej. piezas)" value={newCat.unit} onChange={(e) => setNewCat((c) => ({ ...c, unit: e.target.value }))} style={{ flex: 1.5, minWidth: 140, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 14 }} />
                  <button onClick={addCategory} style={{ border: 'none', background: COLORS.primary, color: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Agregar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {section === 'admin' && user.role === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map((u) => (
              <div key={u.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>{u.email}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ROLE_KEYS.map((r) => (
                    <button key={r} onClick={() => setRole(u, r)} style={{ border: `1px solid ${u.role === r ? COLORS.primary : COLORS.border}`, background: u.role === r ? COLORS.light : '#fff', color: u.role === r ? COLORS.primary : COLORS.text, borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
                <button onClick={() => deleteUserRow(u)} disabled={u.email === user.email} style={{ border: 'none', background: 'none', color: u.email === user.email ? '#C7C5C7' : COLORS.danger, fontSize: 12, cursor: 'pointer' }}>Eliminar</button>
              </div>
            ))}
            <div style={{ background: '#fff', borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Nuevo usuario</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input placeholder="Nombre" value={newUser.name} onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))} style={{ flex: 1.5, minWidth: 140, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 14 }} />
                <input placeholder="Correo" value={newUser.email} onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))} style={{ flex: 1.5, minWidth: 160, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 14 }} />
                <input placeholder="Contraseña" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} type={showNewUserPw ? 'text' : 'password'} style={{ flex: 1, minWidth: 120, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 14 }} />
                <button type="button" onClick={() => setShowNewUserPw((v) => !v)} style={{ border: 'none', background: 'none', color: COLORS.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{showNewUserPw ? 'Ocultar' : 'Ver'}</button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {ROLE_KEYS.map((r) => (
                  <button key={r} onClick={() => setNewUser((u) => ({ ...u, role: r }))} style={{ border: `1px solid ${newUser.role === r ? COLORS.primary : COLORS.border}`, background: newUser.role === r ? COLORS.light : '#fff', color: newUser.role === r ? COLORS.primary : COLORS.text, borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
              <button onClick={addUserAccount} style={{ marginTop: 12, border: 'none', background: COLORS.primary, color: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Agregar usuario</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
