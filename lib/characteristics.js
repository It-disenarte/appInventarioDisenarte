// Deja solo las claves definidas en el schema de la categoría, como texto recortado.
export function cleanCharacteristics(schema, input) {
  const out = {};
  const keys = Array.isArray(schema) ? schema : [];
  const src = input && typeof input === 'object' ? input : {};
  for (const k of keys) {
    const v = src[k] == null ? '' : String(src[k]).trim();
    if (v) out[k] = v;
  }
  return out;
}

// Normaliza el schema: lista de nombres de campo únicos y no vacíos.
export function cleanSchema(input) {
  const list = Array.isArray(input) ? input : String(input || '').split(',');
  const out = [];
  for (const raw of list) {
    const k = String(raw).trim();
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}
