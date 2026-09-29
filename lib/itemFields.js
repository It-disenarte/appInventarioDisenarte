const TEXT_FIELDS = ['codigo', 'metraje', 'proveedor', 'descripcion'];

// Toma del body solo los campos fijos del artículo que vengan definidos.
// Texto vacío se guarda como null; la caducidad llega como 'AAAA-MM-DD'.
export function cleanItemFields(body) {
  const src = body || {};
  const data = {};
  for (const k of TEXT_FIELDS) {
    if (src[k] !== undefined) data[k] = src[k] == null ? null : (String(src[k]).trim() || null);
  }
  if (src.caducidad !== undefined) {
    const v = src.caducidad == null ? '' : String(src.caducidad).trim();
    if (!v) {
      data.caducidad = null;
    } else {
      const date = new Date(`${v}T00:00:00Z`);
      // El round-trip descarta fechas que no existen (p.ej. 2026-02-31).
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(date) || date.toISOString().slice(0, 10) !== v) throw new Error('Fecha de caducidad inválida.');
      data.caducidad = date;
    }
  }
  return data;
}
