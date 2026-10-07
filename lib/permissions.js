export const ROLE_KEYS = ['produccion', 'diseno', 'super', 'admin'];
export const AREA_KEYS = ['produccion', 'diseno'];
// Súper y Admin ya abarcan todo: no se combinan con otros roles. Producción y Diseño sí.
export const EXCLUSIVE_ROLES = ['super', 'admin'];

const LABELS = { produccion: 'Producción', diseno: 'Diseño', super: 'Súper', admin: 'Admin' };

// User.role guarda uno o varios roles separados por coma, p. ej. "produccion,diseno".
export function parseRoles(role) {
  return String(role || '').split(',').map((r) => r.trim()).filter((r) => ROLE_KEYS.includes(r));
}

export function hasRole(role, key) {
  return parseRoles(role).includes(key);
}

// Convierte la entrada (arreglo o texto) al valor que se guarda en User.role. null si no es válida.
export function normalizeRoles(input) {
  const list = Array.isArray(input) ? input : String(input || '').split(',');
  const clean = list.map((r) => String(r).trim()).filter(Boolean);
  if (!clean.length || clean.some((r) => !ROLE_KEYS.includes(r))) return null;
  const unique = ROLE_KEYS.filter((r) => clean.includes(r));
  if (unique.length > 1 && unique.some((r) => EXCLUSIVE_ROLES.includes(r))) return null;
  return unique.join(',');
}

export function canModify(role, area) {
  const roles = parseRoles(role);
  if (roles.includes('admin') || roles.includes('super')) return true;
  return AREA_KEYS.includes(area) && roles.includes(area);
}

export function canManageGroups(role) {
  return hasRole(role, 'admin') || hasRole(role, 'super');
}

export function roleLabel(role) {
  const roles = parseRoles(role);
  return roles.length ? roles.map((r) => LABELS[r]).join(' + ') : role;
}
