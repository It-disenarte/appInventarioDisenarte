const MAX_EXTRA = 20;
const MAX_KEY = 60;
const MAX_VALUE = 500;

// Valores de características como texto recortado. Primero van las claves del schema de
// la categoría; después las extra propias del artículo (hasta MAX_EXTRA). Se omiten vacíos.
export function cleanCharacteristics(schema, input) {
  const out = {};
  const keys = Array.isArray(schema) ? schema : [];
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  for (const k of keys) {
    const v = src[k] == null ? '' : String(src[k]).trim().slice(0, MAX_VALUE);
    if (v) out[k] = v;
  }
  let extra = 0;
  for (const [rawKey, rawValue] of Object.entries(src)) {
    if (extra >= MAX_EXTRA) break;
    const k = String(rawKey).trim().slice(0, MAX_KEY);
    const v = rawValue == null ? '' : String(rawValue).trim().slice(0, MAX_VALUE);
    if (!k || !v || keys.includes(k) || k in out) continue;
    out[k] = v;
    extra++;
  }
  return out;
}

// Claves de un artículo que no están en el schema de su categoría.
export function extraKeys(schema, values) {
  const keys = Array.isArray(schema) ? schema : [];
  return Object.keys(values || {}).filter((k) => !keys.includes(k));
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
