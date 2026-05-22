# Polla Mundial 2026

Sistema de pronósticos para el Mundial FIFA 2026. Participantes reciben un código QR para acceder y predecir resultados de los 104 partidos. Tabla de posiciones en tiempo real.

## Características

- **Acceso por QR** — cada participante recibe un QR único, sin contraseña
- **104 partidos** — grupos (A–L) + dieciseisavos → final
- **3 tipos de pronósticos** — marcadores de partidos, clasificados por grupo, predicciones especiales (campeón, finalista, 3° lugar)
- **Resultados automáticos** — sincronización con football-data.org API
- **Puntaje configurable** — admin ajusta puntos para cada tipo desde el panel
- **Tabla de posiciones en tiempo real** — actualización automática cada 30s
- **Panel de admin** — gestión de participantes, resultados, configuración de reglas

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Base de datos | Supabase (PostgreSQL) |
| ORM | Drizzle ORM |
| Auth | JWT con `jose` (cookies httpOnly) |
| Datos del mundial | football-data.org (free) + openfootball/worldcup.json |
| Deploy | Vercel |

---

## Setup completo

### Paso 1 — Clonar e instalar dependencias

```bash
git clone <repo-url>
cd polla-mundial-2026
pnpm install
```

### Paso 2 — Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → crear cuenta gratis → **New Project**
2. En el dashboard del proyecto: **Settings → Database**
3. Buscar **Connection string** → seleccionar **Transaction pooler** (puerto 6543)
4. Copiar la URL — es tu `DATABASE_URL`
5. Buscar **Direct connection** (puerto 5432) — es tu `DIRECT_URL`

### Paso 3 — Obtener API key de football-data.org

1. Ir a [football-data.org/client/register](https://www.football-data.org/client/register)
2. Registrarse gratis (email + nombre)
3. Recibirás un email con tu API key

### Paso 4 — Configurar variables de entorno

Copiar `.env.local` y rellenar los valores:

```bash
cp .env.local .env.local.bak  # backup del template
```

Editar `.env.local`:

```env
# Supabase
DATABASE_URL=postgresql://postgres.xxxx:TU_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres:TU_PASSWORD@db.xxxx.supabase.co:5432/postgres

# JWT — genera uno aleatorio:
# node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
JWT_SECRET=tu-string-aleatorio-de-32-chars

# Credenciales del admin
ADMIN_EMAIL=tu@email.com
ADMIN_PASSWORD=tu-contraseña-segura

# URL de la app (localhost para desarrollo)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# football-data.org
FOOTBALL_DATA_API_KEY=tu-api-key-aqui

# Protección del endpoint de cron
# openssl rand -hex 20
CRON_SECRET=string-aleatorio-para-proteger-cron
```

### Paso 5 — Crear tablas en Supabase

```bash
pnpm db:push
```

Esto crea todas las tablas en tu base de datos Supabase.

### Paso 6 — Sembrar los 104 partidos del Mundial

```bash
pnpm seed
```

Descarga el calendario oficial de [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) e inserta todos los partidos.

### Paso 7 — Correr en desarrollo

```bash
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000)

- Admin: ir a `/login` → ingresar con las credenciales del `.env.local`
- Participantes: el admin genera los QR desde `/admin/participants`

---

## Deploy en Vercel

### 1. Push a GitHub

```bash
git add .
git commit -m "initial commit"
git push origin main
```

### 2. Crear proyecto en Vercel

1. Ir a [vercel.com](https://vercel.com) → **New Project** → importar el repo
2. Framework: Next.js (detectado automáticamente)

### 3. Agregar variables de entorno en Vercel

En Vercel → **Settings → Environment Variables**, agregar todas las del `.env.local`:
- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `NEXT_PUBLIC_APP_URL` ← poner la URL de Vercel (ej: `https://polla-mundial.vercel.app`)
- `FOOTBALL_DATA_API_KEY`
- `CRON_SECRET`

### 4. Deploy

Vercel hace deploy automático al hacer push. El primer deploy corre al conectar el repo.

### 5. Sembrar la base de datos en producción

Desde tu máquina local, con la `DATABASE_URL` de producción:

```bash
DATABASE_URL=<url-supabase-production> pnpm seed
```

O también puedes correrlo con las variables de `.env.local` apuntando a producción.

### 6. Cron job para sync de resultados

El `vercel.json` ya incluye un cron que corre cada hora. Para sync más frecuente (cada 5 min) durante los partidos — **totalmente gratis**:

1. Crear cuenta en [cron-job.org](https://cron-job.org)
2. **Create cronjob**:
   - URL: `https://tu-dominio.vercel.app/api/cron/sync-results`
   - Schedule: `*/5 * * * *` (cada 5 minutos)
   - HTTP Method: GET
   - Header: `x-cron-secret` = el valor de tu `CRON_SECRET`
3. Guardar y activar

---

## Uso del sistema

### Como Admin

1. Ir a `/login` → ingresar con email/contraseña
2. **`/admin/config`** → configurar reglas de puntaje antes de empezar
3. **`/admin/participants`** → agregar participantes:
   - Ingresar nombre (y email opcional)
   - Aparece botón **QR** → abre modal con código QR
   - Descargar PNG o copiar link → enviar por WhatsApp/email
4. **`/admin/results`** → los resultados llegan automáticos. Si hay delay, usar botón **Sync API** o ingresar manualmente

### Como Participante

1. Escanear el QR recibido → entrar directo a la app (sin contraseña)
2. **Pronósticos → Partidos** → ingresar marcadores antes de cada partido
3. **Pronósticos → Clasificados** → predecir 1° y 2° de cada grupo
4. **Pronósticos → Especiales** → predecir campeón, finalista, 3° lugar
5. **Tabla** → ver posiciones en tiempo real

---

## Sistema de puntaje (valores por defecto)

| Tipo | Puntos |
|---|---|
| Resultado exacto (ej: pronostica 2-1, resultado 2-1) | 5 pts |
| Diferencia de goles correcta (ej: pronostica 2-0, resultado 3-0) | 3 pts |
| Tendencia correcta (ej: pronostica victoria, gana) | 2 pts |
| 1° lugar del grupo | 6 pts |
| 2° lugar del grupo | 4 pts |
| Campeón del mundo | 20 pts |
| Finalista (perdedor) | 10 pts |
| 3° lugar | 8 pts |

Todos los valores son ajustables desde `/admin/config`.

---

## Comandos de desarrollo

```bash
pnpm dev          # servidor de desarrollo
pnpm build        # build de producción
pnpm lint         # linter

pnpm db:push      # sync schema → DB (sin generar archivos de migración)
pnpm db:generate  # generar archivos de migración SQL
pnpm db:studio    # Drizzle Studio (explorador visual de la BD)
pnpm seed         # sembrar partidos del Mundial 2026
```

---

## Estructura del proyecto

```
app/
├── (auth)/login/          # Login admin
├── (participant)/         # Layout con nav de participante
│   ├── predictions/       # Pronósticos de partidos
│   ├── predictions/groups/  # Clasificados por grupo
│   ├── predictions/specials/ # Predicciones especiales
│   └── leaderboard/       # Tabla de posiciones
├── admin/                 # Panel de administración
│   ├── participants/      # Gestión de participantes + QR
│   ├── results/           # Ingreso/sync de resultados
│   └── config/            # Configuración de reglas
├── api/                   # API routes
│   └── cron/sync-results/ # Endpoint para sync automático
└── join/[token]/          # Landing page QR → auto-login

lib/
├── auth/session.ts        # JWT utils
├── db/schema.ts           # Drizzle schema
├── football-data/sync.ts  # Auto-sync de resultados
├── scoring.ts             # Lógica de puntos
└── teams.ts               # Flags + nombres de equipos

scripts/
└── seed-matches.ts        # Seed inicial de partidos

proxy.ts                   # Protección de rutas (Next.js 16)
```
