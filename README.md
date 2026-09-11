# Inventario Diseñarte — despliegue con Postgres (Hostinger) + Vercel

App Next.js con login, roles por área (Producción / Diseño / Súper / Admin) y panel de administración de usuarios, respaldada por Postgres.

## 1. Crear la base de datos Postgres en Hostinger
1. Entra a hPanel → tu plan → **Bases de datos** → **PostgreSQL** (o **Databases** si usas VPS).
2. Clic **Crear nueva base de datos**. Ponle nombre (ej. `inventario`), usuario y contraseña. Guárdalos.
3. Copia: host, puerto (normalmente 5432), nombre de BD, usuario, contraseña.
4. Activa acceso remoto ("Remote MySQL/Postgres access" o similar) y permite conexiones desde cualquier IP (`%` o `0.0.0.0/0`) — Vercel usa IPs dinámicas.
5. Arma tu cadena de conexión:
   `postgresql://USUARIO:CONTRASENA@HOST:5432/NOMBRE_BD?sslmode=require`

## 2. Preparar el proyecto en VS Code
1. `git clone` tu repositorio (`appInventarioDisenarte`) y copia todo el contenido de esta carpeta (`app-code/`) dentro, en la raíz del repo.
2. Abre la carpeta en VS Code.
3. Terminal: `npm install`.
4. Copia `.env.example` como `.env` y pega tu `DATABASE_URL` de Hostinger. En `JWT_SECRET` pon un texto largo aleatorio.

## 3. Crear tablas y datos de prueba
1. `npx prisma migrate dev --name init`
2. `npx prisma db seed`
3. Esto crea las tablas y siembra: 3 grupos de inventario (Producción·Insumos, Producción·Herramienta, Diseño·Insumos) con sus categorías/artículos de ejemplo, y un solo usuario: it@disenartemx.com / Intothenewerait2026 (admin). El resto de las cuentas las creas tú desde el panel de Administración dentro de la app, una vez logueado como admin.

## 4. Probar en local
1. `npm run dev`
2. Abre `http://localhost:3000` → deberías caer en el login.

## 5. Subir a GitHub
1. `git add .`
2. `git commit -m "App de inventario con login, roles y Postgres"`
3. `git push origin main`

## 6. Desplegar en Vercel
1. Entra a vercel.com, inicia sesión con GitHub.
2. **Add New...** → **Project** → elige tu repo → **Import**.
3. En "Environment Variables" agrega `DATABASE_URL` y `JWT_SECRET` (los mismos valores de tu `.env`).
4. Clic **Deploy**.
5. Al terminar, abre la URL que te da Vercel y prueba el login.

## Notas
- Las migraciones (paso 3) hay que correrlas tú, contra la base de Hostinger, cada vez que cambie el esquema (`npx prisma migrate deploy`). Vercel no las corre solo.
- Áreas y permisos: Producción = grupos "Producción · Insumos" y "Producción · Herramienta"; Diseño = "Diseño · Insumos". Roles `produccion`/`diseno` solo pueden agregar, ajustar cantidades, editar categorías y eliminar en su propia área; ven (solo lectura) la otra área. `super` y `admin` pueden todo. Solo `admin` (it@disenartemx.com) ve el panel de Administración de usuarios.
- Para cambiar contraseñas o agregar áreas nuevas más adelante, dímelo y ajustamos el esquema.
