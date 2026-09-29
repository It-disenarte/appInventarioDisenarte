# CLAUDE.md — Inventario Diseñarte México

Contexto para continuar el desarrollo con Claude Code.

## Qué es
App web interna de inventario para Diseñarte México (agencia de publicidad, San Juan del Río, Qro.). Ya está en producción en Vercel y conectada a Postgres en el VPS de Hostinger.

## Stack
- Next.js 14 (Pages Router), JavaScript plano (sin TypeScript)
- Prisma 5 + PostgreSQL 17 (servicio `inventario-db` en el proyecto `hub_disenarte` del VPS Hostinger, puerto 5432 expuesto)
- Auth propia: JWT (`jsonwebtoken`) en cookie `session` httpOnly/secure/sameSite=lax, 30 días. Passwords con `bcryptjs`. `getSessionFromReq` (async) solo toma el `id` del JWT y relee nombre/rol de la BD en cada petición: cambios de rol y usuarios eliminados surten efecto de inmediato.
- Deploy: GitHub `It-disenarte/appInventarioDisenarte` (branch `main`) → Vercel. Variables en Vercel: `DATABASE_URL`, `JWT_SECRET`.
- PWA instalable (manifest + service worker network-first que cachea solo páginas/estáticos, nunca `/api`).

## Estructura
- `pages/index.js`: toda la app autenticada en una sola página. Navegación con menú lateral (`components/SideMenu.js`): fijo en pantallas de 1024px o más, desplegable con ☰ en celular. Lista los grupos (Inventarios), las vistas del grupo (Artículos, Movimientos, Categorías) y Administración (Grupos para admin/super, Usuarios para admin). Sin barras de pestañas con scroll horizontal. Tras cada acción solo se recarga lo que cambió (`reload(...)`) o se actualiza el estado local.
- `pages/login.js`: login con toggle "Ver/Ocultar" contraseña. No mostrar credenciales en pantalla.
- `pages/_document.js`: fuente Outfit (Google Fonts), manifest, íconos, meta tags de Apple.
- `pages/_app.js`: registra `/sw.js`.
- `pages/api/auth/{login,logout,me}.js`
- `pages/api/groups/index.js` (GET; POST solo admin/super) y `[id].js` (PATCH label/area/color; DELETE en cascada; solo admin/super).
- `pages/api/items/index.js` (GET, POST con campos fijos y `characteristics`) y `[id].js` (PATCH con `delta`: increment atómico en transacción, no baja de 0 y no registra movimientos sin cambio real; PATCH sin `delta`: edita nombre, reorden, campos fijos y `characteristics`; DELETE). Los campos fijos se limpian en `lib/itemFields.js`.
- `pages/api/categories/index.js` (POST) y `[id].js` (PATCH nombre/unidad/schema; DELETE en cascada de items y movimientos). `schema` es la lista de características de la categoría; `Item.characteristics` guarda sus valores (`lib/characteristics.js` limpia ambos).
- `pages/api/movements.js`: solo admin/super. GET; DELETE `?id=` borra uno, `?groupId=` vacía un grupo; sin parámetros responde 400 (ya no borra todo).
- `pages/api/users/index.js` y `[id].js`: solo admin. Listar, crear, cambiar rol, eliminar. Rol validado contra `ROLE_KEYS`. El admin no puede borrarse ni quitarse el rol admin.
- `lib/prisma.js`, `lib/auth.js`, `lib/permissions.js` (también lo importa el frontend), `lib/characteristics.js`
- Asistente de uso: `components/GuideTour.js` (ventanas flotantes que resaltan elementos marcados con `data-guide="..."`) y `lib/guideSteps.js` (textos por pantalla, adaptados al rol). Si `User.showGuide` es true, cada pantalla muestra su guía la primera vez que se visita en la sesión (cada vez que se abre la app). Se desactiva desde la propia guía o en Mi perfil (`PATCH /api/profile`). El botón "?" del encabezado la muestra siempre. Al agregar botones o secciones nuevas, marcar el elemento con `data-guide` y agregar su paso en `lib/guideSteps.js`.
- `pages/api/profile.js`: PATCH `{ showGuide }` del propio usuario (cualquier rol).
- `components/ConfirmDialog.js`: diálogo de confirmación con la marca. No usar `window.confirm`/`alert`; en `index.js` se usa `if (!(await ask({ title, message, confirmLabel, danger }))) return;`.
- `components/LoadingScreen.js`: carga inicial. `index.js` además muestra un overlay `busy` en cada acción.
- `prisma/schema.prisma`: User, Group(area), Category(unit, schema Json), Item(qty, reorder, characteristics Json, codigo, metraje, proveedor, descripcion: texto opcional; caducidad: fecha opcional, la UI avisa desde 30 días antes), Movement(tipo, delta, antes, despues, usuario, fecha).
- `prisma/seed.js`: crea solo el admin `it@disenartemx.com` y grupos/categorías de ejemplo, solo si no hay grupos. El usuario borra los datos de ejemplo desde la app.

## Roles y permisos (regla central en `lib/permissions.js` → `canModify(role, area)`)
- `produccion`: ve todo; modifica solo los grupos con area `produccion`.
- `diseno`: ve todo; modifica solo los grupos con area `diseno`.
- `super`: ve y modifica todo. Ve Movimientos.
- `admin`: todo lo anterior más el panel de Administración de usuarios. La cuenta es `it@disenartemx.com`.
- Movimientos: solo admin y super (se valida en la API y en la UI).
- Toda escritura se valida en el servidor. El frontend solo oculta botones.
- Sesiones: se permiten sesiones múltiples simultáneas. Está pendiente decidir si se limita a una por usuario.

## Identidad de marca (Manual de marca Diseñarte)
- Primario magenta `#A53692`, secundario morado `#7C07A6`, acento turquesa `#5CC6D0`, gris `#96989A`.
- Fondo de la app `#F7F7F8`, bordes `#E4E4E5`, estado activo `#F6E4F2`.
- Degradado de marca turquesa → magenta (como la palabra "Diseñarte"). Se usa como franja en el login.
- `public/logo.png`: imagotipo completo (login). `public/isotipo.png`: símbolo "D" (header, pantalla de carga). `icon-192/512.png`: íconos de la PWA.
- No distorsionar, recolorear ni poner el logo sobre fondos sin contraste. Respetar el área de protección.
- Tipografía: se usa Outfit de forma provisional. La tipografía oficial del manual está pendiente de confirmar.
- Estilos inline en los componentes React.

## Comandos
- `npm install`
- `npm run dev`: localhost:3000 contra la BD remota real (local y producción comparten la BD).
- `npx prisma db push`: cambios de esquema contra la BD de Hostinger. La BD no tiene historial de migraciones (no existe `prisma/migrations`), así que NO usar `migrate dev`: pediría resetear la BD de producción. Vercel no migra solo: aplicar el esquema ANTES de desplegar código que use columnas nuevas.
- `npx prisma db seed`
- `package.json` tiene `"postinstall": "prisma generate"`, que Vercel necesita.

## Errores conocidos
- `PrismaClientInitializationError` en Vercel: falta `postinstall: prisma generate`.
- Error 500 en login: revisar Vercel → Logs. Casi siempre es la conexión a la BD o una env var faltante.

## Pendientes / ideas
- Confirmar la tipografía oficial del manual.
- Decidir si se limita a una sesión por usuario.
- Posible dominio propio.
- Esta app es la primera del "HUB Diseñarte". Las siguientes apps reutilizan esta arquitectura (ver `SKILL_APPS_WEB_CON_BD.md`).

## Seguridad
- Nunca commitear `.env`, que ya está en `.gitignore`.
- La contraseña de la BD y la del admin viven solo en `.env` y en Vercel. Considerar rotar la contraseña de la BD, porque se compartió en chat.
