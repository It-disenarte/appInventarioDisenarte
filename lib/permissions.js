export function canModify(role, area) {
  if (!role) return false;
  if (role === 'admin' || role === 'super') return true;
  if (role === 'produccion') return area === 'produccion';
  if (role === 'diseno') return area === 'diseno';
  return false;
}

export function roleLabel(role) {
  return { produccion: 'Producción', diseno: 'Diseño', super: 'Súper', admin: 'Admin' }[role] || role;
}
