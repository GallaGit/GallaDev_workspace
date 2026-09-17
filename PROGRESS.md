# GallaDev — Roadmap / Progreso

**Actualizado:** 17 Sep 2026 · **Objetivo:** form galladev.com → leads en workspace.galladev.com

## 🗺️ Mapa del sistema

| Pieza | Dónde vive | Estado |
|---|---|---|
| Landing galladev.com | Cloudflare Pages (repo `GallaDev`) | ✅ Prod, estable |
| Workspace (backoffice) | Vercel → workspace.galladev.com (este repo) | 🟡 Código listo, falta deploy + DNS |
| n8n (automatizaciones) | PC local (puerto 5678) | 🟡 Conectar vía túnel Cloudflare |
| Reenvío landing → workspace | Pages Function → `POST /api/ingest/lead` | ✅ Código listo, pendiente activar envs |

## ✅ Hecho

- [x] Form con validación completa ES + Turnstile + honeypot (GallaDev #1)
- [x] Reenvío fail-open al workspace (GallaDev #2, mergeado)
- [x] Interruptor de captación con reapertura auto (GallaDev #3, mergeado)
- [x] `POST /api/ingest/lead` bearer + duplicados fusionados, sin n8n (WS #14)
- [x] Login mínimo con sesión firmada (WS #14)
- [x] Supabase fuente de verdad, Notion legado (WS #14)
- [x] `noindex` + marca GallaDev Workspace (WS #15, mergeado)
- [x] Secrets generados (AUTH/INGEST) + `.env.local` completo

## ▶️ Lo siguiente (en orden)

1. [ ] **Vercel**: crear proyecto desde `GallaDev_workspace`, pegar envs, redeploy
   - Ver envs abajo. Sin `AUTH_DISABLED`. Sin `NOTION_*`. Sin `NEXT_PUBLIC_*`.
2. [ ] **Checkpoint**: `*.vercel.app` pide login → entrar con `AUTH_PASSWORD`
3. [ ] **DNS**: CNAME `workspace` → Vercel (nube gris) → candado verde
4. [ ] **Pages**: `WORKSPACE_INGEST_URL` + `WORKSPACE_INGEST_SECRET` (= `INGEST_SECRET`)
5. [ ] **E2E prod**: envío real → fila `web-galladev` + duplicado fusiona
6. [ ] **n8n**: túnel Cloudflare → `n8n.galladev.com` → URLs prod en Vercel → aviso lead nuevo
7. [ ] Marcar checklist en `MIGRACION-galladev-workspace.md` + archivar nota
8. [ ] (Opcional) Fase 2 email auto / lista de espera; limpiar `client.ts` muerto

## 🔑 Envs (nombres; valores solo en gestor + hosts)

- Vercel Prod+Preview: `AUTH_SECRET`, `AUTH_PASSWORD`, `INGEST_SECRET`,
  `LEADS_DB_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
  `GROQ_API_KEY`, `N8N_WEBHOOK_*` (cuando haya túnel)
- Pages Prod: `TURNSTILE_SECRET` ✅, `WORKSPACE_INGEST_URL`/`SECRET` ⏳, `LEADS_*` (al pausar)

## 📝 Decisiones registradas

- Fail-open en landing (el visitante nunca ve errores del backoffice)
- Form web NO dispara n8n; duplicados por email se fusionan
- Supabase verdad / Notion legado · Vercel (no VPS) · Túnel (no hosting n8n)
- Reapertura de captación automática por fecha · Sin `NEXT_PUBLIC_*` en browser
- Repo `GallaDev_workspace` es público ⚠️ (valorar privado: herramienta interna)

## ⚠️ Riesgos abiertos

- Settings en fichero local son efímeros en Vercel → webhooks y toggles, por env
- Rate-limit en memoria es por instancia (best-effort)
- Túnel: PC apagado = evento perdido (log). Sin reintentos (v1)
