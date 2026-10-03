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
- `pages/index.js`: toda la app autenticada en una sola página. Navegación con menú lateral morado de 256 px (`components/SideMenu.js`): fijo desde 768 px; en celular hay barra superior morada (☰, ícono, botón ?) y el menú sale como cajón. Lista los grupos (Inventarios), las vistas del grupo (Artículos, Movimientos, Categorías), Administración (Grupos para admin/super, Usuarios para admin) y Cuenta (Mi perfil, interruptor del asistente, Ver guía de esta pantalla, Instalar como app si el navegador lo ofrece); al pie, usuario, rol y Salir. Sin barras de pestañas con scroll horizontal. Tras cada acción solo se recarga lo que cambió (`reload(...)`) o se actualiza el estado local.
- `pages/login.js`: login de dos columnas (panel morado + tarjeta sobre textura; en celular, marca arriba), con toggle "Ver/Ocultar" contraseña. No mostrar credenciales en pantalla.
- `pages/_document.js`: manifest, favicons, meta tags de Apple.
- `pages/_app.js`: registra `/sw.js`, carga Poppins con `next/font/google` (se sirve desde la app, no desde Google) e importa `styles/globals.css`.
- `pages/api/auth/{login,logout,me}.js`
- `pages/api/groups/index.js` (GET; POST solo admin/super) y `[id].js` (PATCH label/area/color; DELETE en cascada; solo admin/super).
- `pages/api/items/index.js` (GET, POST con campos fijos y `characteristics`) y `[id].js` (PATCH con `delta`: increment atómico en transacción, no baja de 0 y no registra movimientos sin cambio real; PATCH sin `delta`: edita nombre, reorden, campos fijos y `characteristics`; DELETE). Los campos fijos se limpian en `lib/itemFields.js`.
- `pages/api/categories/index.js` (POST) y `[id].js` (PATCH nombre/unidad/schema; DELETE en cascada de items y movimientos). `schema` es la lista de características de la categoría; `Item.characteristics` guarda sus valores y también características extra propias del artículo (botón "Agregar característica" del formulario; hasta 20). `lib/characteristics.js` limpia ambos.
- `pages/api/movements.js`: solo admin/super. GET; DELETE `?id=` borra uno, `?groupId=` vacía un grupo; sin parámetros responde 400 (ya no borra todo).
- `pages/api/users/index.js` y `[id].js`: solo admin. Listar, crear, cambiar rol, eliminar. Rol validado contra `ROLE_KEYS`. El admin no puede borrarse ni quitarse el rol admin.
- `lib/prisma.js`, `lib/auth.js`, `lib/permissions.js` (también lo importa el frontend), `lib/characteristics.js`
- Asistente de uso: `components/GuideTour.js` (ventanas flotantes que resaltan elementos marcados con `data-guide="..."`) y `lib/guideSteps.js` (textos por pantalla, adaptados al rol). Si `User.showGuide` es true, cada pantalla muestra su guía la primera vez que se visita en la sesión (cada vez que se abre la app). Se desactiva desde la propia guía o en Mi perfil (`PATCH /api/profile`). El botón "?" del encabezado la muestra siempre. Al agregar botones o secciones nuevas, marcar el elemento con `data-guide` y agregar su paso en `lib/guideSteps.js`.
- Zoho Projects: `lib/zoho.js` + `pages/api/zoho/restock.js` (POST `{ itemId }`, cualquier usuario, solo si qty ≤ reorden) y `pages/api/zoho/sync.js` (libera solicitudes cuya tarea se cerró). Crea la tarea en DI-5 "Gestión de Compras y Materiales" → lista General → estado Solicitud, etiqueta "stock". La app actúa como `it@disenartemx.com` vía refresh token (Self Client en api-console.zoho.com, scopes `ZohoProjects.tasks.CREATE,ZohoProjects.tasks.READ`). Env: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`; sin ellas el botón responde 503. `Item.zohoTaskId`/`zohoRequestedAt` evitan duplicados; se limpian cuando la existencia vuelve a superar el reorden o la tarea se cierra.
- `pages/api/profile.js`: PATCH `{ showGuide }` del propio usuario (cualquier rol).
- `components/ConfirmDialog.js`: diálogo de confirmación con la marca. No usar `window.confirm`/`alert`; en `index.js` se usa `if (!(await ask({ title, message, confirmLabel, danger }))) return;`.
- `components/LoadingScreen.js`: pantalla de arranque y `LoadingOverlay` (tarjeta con spinner y mensaje en gerundio, entra con 180 ms de retraso). En `index.js`, `withBusy(fn, 'Eliminando…')` la muestra en cada operación con servidor (por defecto "Guardando…").
- `components/Brand.js` (ícono + "Inventario" + "DISEÑARTE MÉXICO") e `components/Icon.js` (íconos de línea con paths de lucide).
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
- Sigue la guía unificada de las apps Diseñarte (estándar: Cotizador). Primario morado `#7C07A6` (hover `#6A0590`); magenta `#A53692` solo en el filete y detalles; turquesa `#5CC6D0` en detalles, aro del asistente e interruptores (nunca texto pequeño); gris `#96989A`.
- Fondo `#FAFAFB` con `public/textura.jpg` al 7 %; texto `#1D1B22`; bordes `#E4E1E8`; borde de campo `#D6D2DC`; error `#B3261E` sobre `#FCEEEE`. Sin fondos rosas ni lilas.
- Filete de marca turquesa → magenta: bajo la marca del menú, en la barra móvil, en el login y en diálogos/asistente.
- `styles/globals.css`: tokens y clases `.campo`, `.btn` (`-primario`, `-contorno`, `-fantasma`, `-peligro`), `.tarjeta`, `.menu-item`. Campos con etiqueta arriba, radio 8 y anillo morado; botones radio 8 (sin píldoras); tarjetas blancas radio 14; títulos de pantalla (h1) en morado.
- Ícono: hoja turquesa (esquinas 40 %/11 %) con caja blanca, en `public/favicon.svg`. Derivados: `favicon.ico`, `icono-192/512.png`, `icono-512-maskable.png` y `apple-touch-icon.png` (opaco, se referencia con `?v=2`). Si cambia, usar nombres o versiones nuevos (caché del favicon) y subir `CACHE` en `public/sw.js`.
- No usar los "tres puntos" decorativos del Cotizador.
- No distorsionar, recolorear ni poner el logo sobre fondos sin contraste. Respetar el área de protección.
- Tipografía: Poppins 300–700 (latin y latin-ext).
- Estilos inline en los componentes React; `globals.css` solo para tokens, hover, foco, media queries y animaciones.

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
- Decidir si se limita a una sesión por usuario.
- Posible dominio propio.
- Esta app es la primera del "HUB Diseñarte". Las siguientes apps reutilizan esta arquitectura (ver `SKILL_APPS_WEB_CON_BD.md`).

## Seguridad
- Nunca commitear `.env`, que ya está en `.gitignore`.
- La contraseña de la BD y la del admin viven solo en `.env` y en Vercel. Considerar rotar la contraseña de la BD, porque se compartió en chat.
