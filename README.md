# PetDex

PWA de registro y seguimiento de animales callejeros de un barrio. Lectura
pública sin cuenta; escritura solo para cuentas administradoras autorizadas
(login con Google).

Stack: Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase ·
Vercel. Metodología: Spec-Driven Development (Spec-Kit) — los artefactos de
cada feature viven en `specs/`.

## Instalación

```bash
npm install
```

Crear `.env.local` con las dos únicas variables de entorno válidas del
proyecto (ver `CLAUDE.md`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Comandos

```bash
npm run dev         # servidor de desarrollo (el service worker está deshabilitado acá, ver next.config.ts)
npm run build        # build de producción
npm run start         # sirve el build de producción — necesario para probar caché/PWA de forma realista
npm run typecheck    # tsc --noEmit + tsconfig.worker.json (app/sw.ts se typechequea aparte)
npm run test          # Vitest (unitarios + integración RLS)
npm run test:e2e      # Playwright
npm run gen:types     # regenerar src/types/database.ts — correr después de CADA migración
npm run lint
```

## Deuda técnica conocida

Los proyectos gratuitos de Supabase se pausan tras 7 días sin actividad. El
workflow `.github/workflows/keep-supabase-awake.yml` pinguea `pets_overview`
cada 3 días para evitarlo — requiere los secrets `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY` configurados en el repositorio de GitHub. Es
un workaround: la solución real es el plan Pro de Supabase.

## Reglas del proyecto

Ver `CLAUDE.md` para las reglas que no se negocian (autorización vía RLS,
service role key prohibida, clientes de Supabase, fotos, avistamientos, zona
horaria, diseño) y `specs/*/` para el detalle de cada feature.
