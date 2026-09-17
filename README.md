# Leads_CRM

Aplicación personal para revisar, cualificar y gestionar leads de asesorías y gestorías. Notion es la fuente de verdad y n8n se ocupa de la prospección.

## Inicio rápido

```bash
npm install
cp .env.example .env.local
# Configura NOTION_TOKEN en .env.local
npm run dev
```

Abre [http://localhost:3000/leads](http://localhost:3000/leads). La aplicación intentará sincronizar al cargar; también puedes usar **Sincronizar**.

Configuración mínima:

```dotenv
NOTION_TOKEN=secret_xxxxxxxxx
NOTION_DATABASE_ID=ed07cdd4c5424f9a8b8ebd73e358c6cd
NOTION_DATA_SOURCE_ID=27fefc608dfd43569465582d3c49d99f
AUTH_DISABLED=true
# Producción: AUTH_SECRET + AUTH_PASSWORD. Sesión: SESSION_TTL_DAYS=1 (1–90).
```

## Docker

La imagen es de runtime: hay que **compilar en el host** y luego construir el contenedor. Docker Desktop (o Compose) publica la app en el puerto **3020**. El contenedor se llama `Leads-CRM`.

```bash
cp .env.example .env.local
# Configura NOTION_TOKEN en .env.local
mkdir -p certs
npm install
npm run build
docker compose up -d --build
```

Abre [http://localhost:3020/leads](http://localhost:3020/leads). Compose lee `.env.local` (no se copia a la imagen).

Si Avast intercepta HTTPS, exporta su CA al directorio `certs/` antes de arrancar:

```powershell
powershell -File scripts/export-avast-ca.ps1
```

`docker-compose.yml` monta `./certs` dentro del contenedor. Ese directorio debe existir; si falta el `.pem`, Node ignora `NODE_EXTRA_CA_CERTS`.

Para parar: `docker compose down`. Si Docker Desktop **Start** falla tras mover el proyecto de carpeta, no reutilices el contenedor antiguo: recréalo con `docker compose up -d --force-recreate`.

## Documentación

- [Índice de documentación](./docs/README.md)
- [Contexto de negocio](./docs/CONTEXTO_NEGOCIO.md)
- [Decisiones de producto](./docs/DECISIONES.md)
- [Guía de instalación y uso](./docs/GUIA_USO.md)
- [Arquitectura](./docs/ARQUITECTURA.md)
- [Integraciones](./docs/INTEGRACIONES.md)
- [Estado de implementación](./docs/ESTADO_IMPLEMENTACION.md)
- [Roadmap](./docs/ROADMAP.md)

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, Lucide, TanStack Query, Zustand y `@notionhq/client`. En local también hay un `Dockerfile` y `docker-compose.yml` para Docker Desktop.

## Verificación

```bash
npm run lint
npm run build
```

Consulta [Estado de implementación](./docs/ESTADO_IMPLEMENTACION.md) antes de asumir que las secciones previstas en el roadmap ya están completas.
