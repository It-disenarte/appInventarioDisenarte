# Skill: Construir apps web con base de datos (Next.js + Postgres + Vercel)

Estrategia de referencia y arquitectura base para construir **cualquier** app web interna con datos persistentes, roles de usuario y despliegue en producción — sin importar el dominio (inventario, cotizaciones, clientes, proyectos, reservas, etc.). Se extrajo del proyecto Inventario Diseñarte, pero el patrón es genérico.

## 1. Stack técnico (fijo, cambia solo el dominio)

- **Framework**: Next.js (Pages Router) — simple, mezcla páginas y API routes en el mismo proyecto.
- **Lenguaje**: JavaScript plano (sin TypeScript) para velocidad de desarrollo.
- **Base de datos**: PostgreSQL. Alojado como servicio en el VPS (panel tipo Railway/hPanel), o cualquier Postgres administrado. Un servicio de BD por app (`nombreapp-db`), puerto expuesto públicamente (5432) para poder migrar desde cualquier entorno (local y Vercel).
- **ORM**: Prisma. Esquema en `prisma/schema.prisma`, migraciones con `prisma migrate dev` (local) / `prisma migrate deploy` (producción), datos iniciales con `prisma/seed.js`.
- **Autenticación**: JWT propio (`jsonwebtoken`) en cookie `httpOnly` + `secure` + `sameSite=lax`. Contraseñas con `bcryptjs` (hash siempre, nunca texto plano).
- **Hosting**: Vercel, deploy automático desde GitHub (branch `main`).
- **Repositorio**: un repo de GitHub por app.

Este stack es el punto de partida por defecto para cualquier app nueva de este tipo, sin importar qué gestiona (inventario, clientes, tickets, reservas, cotizaciones...).

## 2. Arquitectura de carpetas (genérica, aplica a cualquier dominio)

```
/pages
  _app.js          -> wrapper global (registra service worker si es PWA)
  _document.js     -> <head> compartido (manifest, íconos, meta tags)
  index.js         -> pantalla principal (protegida, redirige a /login si no hay sesión)
  login.js         -> pantalla de login (pública)
  /api
    /auth
      login.js     -> POST: valida credenciales, firma JWT, setea cookie
      logout.js    -> POST: borra cookie
      me.js         -> GET: devuelve sesión actual (o null)
    /users
      index.js     -> GET (listar) / POST (crear) — solo admin
      [id].js      -> PATCH (rol) / DELETE — solo admin
    <recurso>.js / <recurso>/[id].js -> un archivo por recurso del dominio (el recurso lo define cada app: productos, clientes, tickets, reservas...)
/lib
  prisma.js        -> instancia única de PrismaClient (evita reconexiones en dev)
  auth.js           -> firmar/verificar JWT, hash/compare de password, leer sesión de la request
  permissions.js    -> funciones puras de reglas de negocio (quién puede hacer qué)
/components
  LoadingScreen.js  -> pantalla de carga reutilizable
/prisma
  schema.prisma
  seed.js
/public
  manifest.json, sw.js, icon-192.png, icon-512.png  -> si la app debe ser instalable (PWA)
```

Principio: **una página (`index.js`) hace de "app" completa**, con secciones controladas por estado de React (`useState`), en vez de multiplicar rutas de Next.js. Crear páginas nuevas solo para flujos realmente separados (`/login`, quizás `/reportes` si es un flujo de impresión aparte).

Lo único que cambia entre apps es qué recursos viven bajo `/pages/api/` y qué modela `schema.prisma` — la auth, permisos, estructura de carpetas y flujo de despliegue se reutilizan igual.

## 3. Modelo de datos: patrón estándar de partida

Toda app de este tipo arranca con esta tabla base, y le agrega el dominio propio encima:

```prisma
model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  name         String
  passwordHash String
  role         String   // roles de negocio, definidos por cada app
  createdAt    DateTime @default(now())
}
```

A partir de ahí, modela las entidades específicas del dominio (en un inventario: Grupo → Categoría → Artículo → Movimiento; en un CRM: Cliente → Contacto → Oportunidad → Actividad; en un helpdesk: Ticket → Comentario → Adjunto). Reglas generales:
- IDs simples con `@id @default(autoincrement())`.
- Si la app necesita trazabilidad ("quién hizo qué y cuándo"), agregar una tabla de historial/auditoría (`Movement`, `AuditLog`, `Activity`) en vez de sobreescribir datos sin rastro.
- Usar `Json` para campos flexibles que varían por tipo/categoría en vez de multiplicar columnas opcionales.

## 4. Modelo de permisos por rol (genérico, no solo "áreas")

Patrón reutilizable para cualquier app que necesite: todos ven, no todos editan.

- Cada recurso protegido pertenece a un **ámbito** (área, departamento, cliente, proyecto — lo que aplique al dominio).
- Cada usuario tiene un **rol**: roles "de ámbito" (ven todo en modo lectura, editan solo lo suyo), un rol "súper" (edita todo), y un rol **admin** (todo + panel de gestión de usuarios).
- Centralizar la regla en una función pura en `lib/permissions.js`, nunca repetirla inline en cada endpoint:

```js
export function canModify(role, scope) {
  if (!role) return false;
  if (role === 'admin' || role === 'super') return true;
  return role === scope; // el rol coincide con el ámbito del recurso
}
```

- Cada endpoint de escritura (`POST`/`PATCH`/`DELETE`) valida el permiso en el **servidor** — el frontend puede ocultar botones por comodidad, pero la seguridad real vive en la API.
- El primer usuario admin se siembra por `seed.js` con credenciales reales dadas por el cliente; el resto de usuarios se crean desde un panel de Administración dentro de la app — nunca varios "usuarios de prueba" hardcodeados en producción salvo que el usuario los pida explícitamente.

## 5. Flujo de desarrollo (paso a paso, repetible para cualquier app)

1. **Diseño primero**: prototipar la UI/UX como Design Component (`.dc.html`) en este entorno, iterar con el usuario hasta aprobar look & feel, roles y flujos — sin tocar backend todavía.
2. **Traducir a código real**: reimplementar el DC aprobado como app Next.js (no reusar el DC — es de exploración visual, no el artefacto de producción).
3. **Crear la base de datos**: nuevo servicio Postgres (VPS, Railway, Supabase, RDS, lo que use el cliente), nombre `nombreapp-db`, exponer el puerto públicamente, copiar la connection URL.
4. **Levantar el esquema**: local, `.env` con `DATABASE_URL` + `JWT_SECRET`, `npm install`, `npx prisma migrate dev --name init`, `npx prisma db seed` (solo con el/los usuario(s) admin reales, sin datos ficticios salvo pedido explícito).
5. **Probar en local** (`npm run dev`) contra la BD real remota antes de desplegar — nunca contra una BD de mentira que luego no coincide con producción.
6. **Subir a GitHub**: repo dedicado, `.env` en `.gitignore`, `.env.example` como referencia de qué variables se necesitan.
7. **Desplegar en Vercel**: importar el repo, confirmar Root Directory si el código no está en la raíz del repo, configurar variables de entorno (`DATABASE_URL`, `JWT_SECRET`, y cualquier otra que la app use) como Environment Variables, deploy.
8. **Checklist de errores comunes**:
   - `PrismaClientInitializationError` en Vercel → falta `"postinstall": "prisma generate"` en `package.json` (Vercel cachea `node_modules` y no regenera el cliente solo).
   - Login o cualquier API con 500 → revisar Vercel → Logs; casi siempre es conexión a BD faltante/mal escrita o env var faltante.
   - Verificar que la BD acepte conexiones externas (IP pública expuesta) antes de asumir error de código.

## 6. Estándares de UI/UX (aplican a cualquier dominio)

- Usar la identidad de marca del cliente (colores, tipografía) de forma consistente en toda la app — pedirla si no está definida.
- Estilos inline en los componentes React (sin CSS-in-file separado) para apps chicas — mantiene todo visible y editable en el mismo archivo.
- **Pantalla de login**: nunca mostrar credenciales de prueba/admin en pantalla en producción. Incluir estado de carga (spinner en botón) y manejo de error visible pero discreto.
- **Estado de carga global**: un overlay/spinner reutilizable (`components/LoadingScreen.js`) para la carga inicial de datos, y un overlay ligero (semi-transparente, blur) para acciones en segundo plano (guardar, eliminar, editar) — nunca dejar un botón "colgado" sin feedback.
- **Confirmación destructiva**: toda eliminación (usuario, registro, recurso) pide confirmación explícita con el nombre del elemento antes de proceder.
- **Instalable (PWA)** cuando el uso principal es desde celular: `manifest.json`, `sw.js` (network-first si los datos deben estar siempre frescos), ícono real de marca, meta tags de Apple en `_document.js`.

## 7. Seguridad — mínimos no negociables en cualquier app

- Contraseñas siempre con `bcrypt` hash, nunca texto plano en BD ni en código.
- Cookie de sesión `httpOnly` + `secure` + `sameSite=lax` — nunca guardar el token en `localStorage`.
- Toda ruta de API valida sesión (`getSessionFromReq`) antes de tocar datos.
- Toda ruta de escritura valida el rol/permiso en el servidor, nunca confiar en que el frontend ocultó el botón.
- Decisión explícita y documentada sobre sesiones múltiples: por defecto se permiten (JWT con expiración larga, sin invalidación); si el negocio pide "una sesión por usuario", se implementa guardando el token vigente en la tabla `User` y comparándolo en cada request.

## 8. Preguntas a hacer antes de empezar cualquier app nueva de este tipo

- ¿Qué entidades/recursos maneja la app (el "qué" del negocio)?
- ¿Qué roles y ámbitos existen, y qué puede ver/editar cada uno?
- ¿Quién es el admin inicial (correo + password reales)?
- ¿Necesita ser instalable en celular (PWA)?
- ¿Debe permitir sesiones simultáneas en varios dispositivos, o solo una activa?
- ¿Dónde vivirá la base de datos (VPS propio, servicio administrado)? ¿Ya existe o hay que crearla?
- ¿Hay datos de ejemplo que quiera conservar, o debe partir vacía para que el usuario cargue todo manual o vía panel de administración?
