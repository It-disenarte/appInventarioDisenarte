// Integración con Zoho Projects (proyecto DI-5 · Gestión de Compras y Materiales).
// La app actúa como la cuenta que autorizó el refresh token (it@disenartemx.com).
// Credenciales solo en variables de entorno: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN.
// Los IDs del proyecto no son secretos; se pueden sobrescribir por env si cambian.

const CONFIG = {
  accountsUrl: process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com',
  apiUrl: process.env.ZOHO_API_URL || 'https://projectsapi.zoho.com',
  webUrl: process.env.ZOHO_WEB_URL || 'https://projects.zoho.com/portal/diseartemxico',
  portalId: process.env.ZOHO_PORTAL_ID || '921155242',
  projectId: process.env.ZOHO_PROJECT_ID || '2662392000000290007', // DI-5 Gestión de Compras y Materiales
  tasklistId: process.env.ZOHO_TASKLIST_ID || '2662392000000290146', // General
  statusId: process.env.ZOHO_STATUS_ID || '2662392000000290126', // Solicitud
  tagId: process.env.ZOHO_TAG_ID || '2662392000000332001', // stock
};

export function zohoConfigured() {
  return Boolean(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET && process.env.ZOHO_REFRESH_TOKEN);
}

// El access token dura 1 hora; se reutiliza mientras la instancia del servidor siga viva.
let cachedToken = null;
let cachedUntil = 0;

async function accessToken() {
  if (cachedToken && Date.now() < cachedUntil) return cachedToken;
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const res = await fetch(`${CONFIG.accountsUrl}/oauth/v2/token`, { method: 'POST', body: params });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`Zoho no entregó un token (${data.error || res.status}).`);
  cachedToken = data.access_token;
  cachedUntil = Date.now() + ((Number(data.expires_in) || 3600) - 120) * 1000;
  return cachedToken;
}

async function zohoFetch(path, opts = {}) {
  const token = await accessToken();
  const res = await fetch(`${CONFIG.apiUrl}/api/v3/portal/${CONFIG.portalId}/projects/${CONFIG.projectId}${path}`, {
    ...opts,
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data.error && (data.error.title || data.error.message)) || data.message || res.status;
    const err = new Error(`Zoho Projects respondió con error (${msg}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Las respuestas de v3 pueden venir como el objeto de la tarea o dentro de `tasks`.
function unwrapTask(data) {
  return (Array.isArray(data.tasks) && data.tasks[0]) || data.task || data;
}

export function taskWebUrl(taskId) {
  return `${CONFIG.webUrl}#taskdetail/${CONFIG.projectId}/${CONFIG.tasklistId}/${taskId}`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Crea la solicitud de reabastecimiento en la columna "Solicitud" del tablero DI-5.
export async function createRestockTask({ item, category, group, requestedBy }) {
  const rows = [
    ['Inventario', group.label],
    ['Categoría', category.name],
    ['Existencia actual', `${item.qty} ${category.unit}`],
    ['Punto de reorden', `${item.reorder} ${category.unit}`],
    ['Código', item.codigo],
    ['Proveedor', item.proveedor],
    ['Metraje', item.metraje],
    ['Descripción', item.descripcion],
  ].filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');

  const description =
    `<div>${rows.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`).join('<br/>')}</div>` +
    `<div><br/>Solicitado por <b>${esc(requestedBy.name)}</b> (${esc(requestedBy.email)}) desde la app de Inventario.</div>`;

  const body = {
    name: `${item.qty === 0 ? 'Agotado' : 'Reabastecer'}: ${item.name}`.slice(0, 200),
    description,
    tasklist: { id: CONFIG.tasklistId },
    status: { id: CONFIG.statusId },
    priority: item.qty === 0 ? 'high' : 'medium',
    ...(CONFIG.tagId ? { tags: [{ id: CONFIG.tagId }] } : {}),
  };

  const task = unwrapTask(await zohoFetch('/tasks', { method: 'POST', body: JSON.stringify(body) }));
  if (!task || !task.id) throw new Error('Zoho Projects no devolvió la tarea creada.');
  return { id: String(task.id), prefix: task.prefix || null, url: taskWebUrl(task.id) };
}

// true si la tarea ya se cerró (p. ej. Entregado-Finalizado) o ya no existe.
export async function isTaskClosed(taskId) {
  try {
    const task = unwrapTask(await zohoFetch(`/tasks/${taskId}`));
    return Boolean(task.is_completed || (task.status && task.status.is_closed_type));
  } catch (e) {
    if (e.status === 404) return true;
    throw e;
  }
}
