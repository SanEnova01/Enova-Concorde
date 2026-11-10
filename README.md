# Enova Concorde

CRM técnico de Enova: monitoreo de tiendas, tickets, auditorías y bot de rendimiento.

## Servicios (Railway)

| Carpeta | Servicio en Railway | Qué hace |
|---|---|---|
| `ecrm-backend/` | **Enova-Concorde** | API (Express + Postgres/knex), login, tickets, métricas, IA, Gmail, WebSockets |
| `ecrm-frontend/ecrm-frontend/` | **Enova Concord** | Panel web (React + Vite) |
| `bot/` | **Concorde Analizer** | Escaneo de tiendas con Chrome (Puppeteer): 9:00 con radiografía HTML y 18:00 solo métricas (hora de Lima) |

Las variables de cada servicio están documentadas en su `.env.example`.
`API_KEY` debe ser **la misma** en el backend y en el bot.

## Desarrollo local

```bash
# Backend
cd ecrm-backend && npm install && cp .env.example .env   # completar .env
npm start          # API en http://localhost:8080
npm test           # pruebas (las de Postgres corren solo en el CI)

# Frontend
cd ecrm-frontend/ecrm-frontend && npm install
npm run dev        # http://localhost:5173
npm run lint && npm run build

# Bot
cd bot && npm install && node server-bot.js
```

## Estructura del backend

```
src/
  index.js              arranque: middlewares, montaje de rutas, servidor
  config/               db (knex) y security (secretos, CORS, roles)
  middleware/auth.js    API key del bot, JWT y permisos por rol (cliente = solo sus tiendas)
  routes/               una ruta por recurso (auth, users, tickets, metrics, stores, settings, ...)
  repositories/         acceso a datos (tickets, métricas, tiendas)
  services/             ticket diario, configuración, auditoría, Gmail, Hub
  ai/                   análisis con IA de la radiografía HTML
  realtime/             consola en vivo por WebSocket (solo super admin)
  db/ensureIndexes.js   índices que se verifican al arrancar
test/                   pruebas (node:test); test/helpers/fakeDb.js simula knex en memoria
```

## Roles

- **super admin**: todo, incluido el menú **Configuración** (`/admin/configuracion`) y la gestión de usuarios.
- **admin**: operación diaria (tiendas, tickets, métricas, herramientas).
- **client**: solo los datos de las tiendas cuyo campo `emails` contiene su correo (coincidencia exacta).

## Flujos clave

- **Escaneo masivo** → `POST /api/metrics/ingest` por tienda. Si llega dos veces la misma tienda en la
  misma corrida (±10 min) se ignora. Crea como máximo **un ticket "Revisión técnica Status diario"
  por tienda y día** (hora de Lima).
- **Métricas de respaldo en auditorías**: se activan o desactivan en Configuración (solo super admin).
- **Número de ticket** (`SOP-AAAA-NNNN` / `HUB-AAAA-NNNN`): se genera con candado en Postgres; no se repite.

## CI

`.github/workflows/ci.yml` corre en cada push a `main`: pruebas del backend (Node 18 y 20, con Postgres real),
lint y build del frontend, y sintaxis del bot.
