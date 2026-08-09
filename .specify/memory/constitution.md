<!--
Sync Impact Report
- Version change: [TEMPLATE] → 1.0.0 (initial ratification)
- Modified principles: n/a (first concrete fill of the template)
- Added principles:
  - I. Los permisos viven en la base de datos
  - II. Minimalismo visual (Swiss Style)
  - III. Mobile-first, una sola mano
  - IV. Ninguna imagen depende de una URL que expira
  - V. El esquema es la fuente de verdad
  - VI. Degradación offline
- Added sections: Stack y Alcance, Flujo de Desarrollo y Cumplimiento
- Removed sections: none
- Templates requiring follow-up: none — .specify/templates/*.md reference the
  constitution generically and need no principle-specific edits.
- Deferred TODOs: none
-->

# PetDex Constitution

## Core Principles

### I. Los permisos viven en la base de datos
Toda regla de acceso se expresa como política RLS en Postgres, nunca solo como
lógica de aplicación. El código de la aplicación NO es la única línea de
defensa: las Server Actions pueden validar la sesión para dar buenos mensajes
de error, pero la garantía de seguridad es la política RLS — si una Server
Action se olvida de chequear, la base DEBE rechazar la operación igual.
La service role key de Supabase NO se usa en este proyecto: no vive en el
`.env`, no se importa, no existe. Si en algún momento parece necesaria para
destrabar una tarea, eso es una señal de que una política está mal escrita;
la solución es arreglar la política, nunca saltear RLS.
**Rationale**: Es una app de lectura pública con una sola cuenta de escritura.
Sin este principio, cualquier descuido en una Server Action expondría
escritura no autorizada; centralizar la garantía en Postgres hace que la
seguridad no dependa de que cada nuevo endpoint recuerde revalidar.

### II. Minimalismo visual (Swiss Style)
La interfaz sigue una estética Swiss Style minimalista: paleta neutra con un
solo color de acento, sin gradientes. No se usan emojis como íconos — se usa
Lucide. El contraste mínimo es 4.5:1 en todo texto e ícono funcional. Todo
elemento navegable por teclado tiene foco visible. Se respeta
`prefers-reduced-motion` deshabilitando o reduciendo animaciones no esenciales.
**Rationale**: Un diseño limpio y de alto contraste es más legible al aire
libre y con luz solar directa, la condición real de uso de esta app, y evita
que decisiones estéticas ad hoc degraden la accesibilidad.

### III. Mobile-first, una sola mano
El caso de uso principal es una persona parada en la calle, con el celular en
una mano, marcando un avistamiento. Si una interacción requiere dos manos o
hacer zoom, está mal diseñada. Los breakpoints de referencia son 375 / 768 /
1024 / 1440, y el diseño se construye primero para 375px, expandiéndose hacia
arriba.
**Rationale**: El contexto de uso predominante es callejero y apurado; diseñar
mobile-first y para una mano evita que la app termine optimizada para un
escritorio que casi nadie usa en el momento real de registro.

### IV. Ninguna imagen depende de una URL que expira
Las fotos de mascotas se sirven desde el bucket público `pet-photos` usando la
URL pública permanente de `getPublicUrl()`. Nunca se guarda ni se usa una
signed URL para `pets.photo_url`. Antes de subir, las imágenes se comprimen en
el cliente (máximo 1600px de lado mayor, formato WebP).
**Rationale**: Las signed URLs expiran y romperían la cuadrícula con imágenes
caídas sin que nadie lo note hasta que un usuario reporta el problema; una URL
pública permanente elimina esa clase de falla por completo. Comprimir en el
cliente además protege el límite de 1 GB del tier gratuito de Supabase.

### V. El esquema es la fuente de verdad
Los tipos de TypeScript de la base de datos se generan desde el esquema de
Postgres, nunca se escriben a mano. Después de cada migración se regeneran los
tipos (`npm run gen:types`) y se corre `npm run typecheck` antes de continuar
con cualquier otro trabajo.
**Rationale**: Escribir tipos a mano permite que diverjan silenciosamente del
esquema real, lo que produce errores en runtime que el compilador debería
haber atrapado. Generarlos desde la base garantiza que el tipo y la columna
nunca puedan desincronizarse.

### VI. Degradación offline
La aplicación es una PWA: sin conexión, debe seguir mostrando el último
contenido cacheado (cuadrícula, fichas, calendario) en lugar de una pantalla
en blanco o un error de red.
**Rationale**: La app se usa en la calle, donde la conectividad es intermitente;
que el registro previo siga siendo consultable sin señal es parte del caso de
uso principal, no una mejora opcional.

## Stack y Alcance

Stack: Next.js App Router, TypeScript, Tailwind, shadcn/ui, Supabase, Vercel.
Metodología: Spec-Driven Development (Spec-Kit); los artefactos viven en
`specs/`. Solo dos variables de entorno son válidas en cualquier entorno:
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Los clientes de
Supabase usan `@supabase/ssr` (nunca los helpers legacy
`@supabase/auth-helpers-nextjs`) a través de tres factories no
intercambiables: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts`
(Server Components y Server Actions) y `middleware.ts` (refresco de sesión).

Alcance v1 — dentro: cuadrícula con contador, ficha con timeline de hitos,
calendario de avistamientos, panel de admin, PWA con degradación offline.
Alcance v1 — fuera: múltiples administradores, comentarios de usuarios,
notificaciones push, geolocalización automática, flujo de adopciones.
Cualquier tarea que empuje hacia algo fuera de alcance se detiene y se
pregunta antes de implementar.

## Flujo de Desarrollo y Cumplimiento

Antes de dar una tarea por terminada, se verifica: `npm run typecheck` pasa;
un insert con la anon key en la tabla tocada falla (evidencia de que la
política RLS del Principio I sostiene); ninguna imagen depende de una URL con
expiración (Principio IV); la pantalla funciona en 375px de ancho (Principio
III); y no se agregaron variables de entorno nuevas más allá de las dos
permitidas (Principio I).

Los avistamientos se marcan vía `rpc('mark_sighting', ...)`, que hace upsert
idempotente sobre `(pet_id, seen_on)` — tocar dos veces no duplica. Existen
tres estados, no dos: visto / revisado y no estaba / sin registro; el tercero
es la ausencia de fila y nunca se pregeneran filas para días sin registro.
`current_date` en Postgres es UTC; la fecha local (UTC-3) se calcula en el
cliente y se pasa explícita a `mark_sighting`, sin confiar en el default de la
función. La cuadrícula consulta siempre la vista `pets_overview` — nunca las
tablas base con una subconsulta por tarjeta — y su contador sale de un `count`
con `head: true` sobre esa misma vista.

## Governance

Esta constitución prevalece sobre cualquier otra práctica o convención
implícita del proyecto. Toda enmienda requiere: (1) documentar el cambio y su
motivación, (2) determinar el incremento de versión según semver — MAJOR para
eliminar o redefinir un principio de forma incompatible, MINOR para agregar un
principio o expandir materialmente una guía existente, PATCH para aclaraciones
o correcciones de redacción — y (3) actualizar este archivo junto con el Sync
Impact Report en el comentario inicial. Los templates y comandos de Spec-Kit
(`.specify/templates/*.md`) leen esta constitución en tiempo de ejecución y no
se editan como parte de una enmienda salvo que dejen de reflejarla.

Toda revisión de código o de PR debe verificar cumplimiento de los seis
principios; cualquier complejidad que se aparte de ellos debe justificarse
explícitamente en la descripción del cambio. `CLAUDE.md`, en la raíz del
repositorio, sirve como guía operativa del día a día derivada de esta
constitución.

**Version**: 1.0.0 | **Ratified**: 2026-08-09 | **Last Amended**: 2026-08-09
