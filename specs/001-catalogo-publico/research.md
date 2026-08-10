# Research: Catálogo público

Todas las decisiones de stack, esquema y restricciones ya vinieron fijadas en
el input de `/speckit.plan` y en `petdex-schema.sql`; esta fase resuelve los
puntos de diseño técnico que quedaban abiertos para llegar sin ambigüedad a
la Fase 1.

## 1. Origen real del esquema aplicado

**Decision**: El esquema vigente es `petdex-schema.sql` (raíz del repo, ya
commiteado). `supabase/migrations/` existe pero está vacío — no hay ningún
`0001_init.sql`.

**Rationale**: Se verificó el sistema de archivos directamente. El plan y las
tareas posteriores deben referenciar `petdex-schema.sql` como la fuente de
verdad del esquema, no una ruta de migración que no existe.

**Alternatives considered**: Crear `supabase/migrations/0001_init.sql` con el
contenido de `petdex-schema.sql` para que coincida con la convención de
Supabase CLI. Rechazado para esta feature: el usuario pidió explícitamente no
crear migraciones nuevas ni modificar el esquema; renombrar/mover el archivo
existente a `migrations/` cuenta como tocar el esquema gestionado y queda
fuera de alcance sin confirmación explícita.

## 2. Fuente de las zonas para el filtro

**Decision**: El filtro de zona de la Pantalla A se arma en el cliente a
partir de los valores `zone` distintos presentes en la respuesta ya obtenida
de `pets_overview` (no se hace una consulta separada ni se crea un catálogo
en la base).

**Rationale**: `pets.zone` es `text` libre en el esquema aplicado, sin `CHECK`
ni tabla de catálogo. Confirmado con el usuario: no hay presupuesto para
tocar el esquema en esta feature, así que la única fuente de verdad
disponible son los datos ya cargados.

**Alternatives considered**: (a) Lista fija hardcodeada en el código de la
app — rechazada porque duplicaría una fuente de verdad que no existe en la
base y quedaría desactualizada apenas el admin cargue una zona nueva; (b)
`SELECT DISTINCT zone` como consulta aparte a Postgres — rechazada porque es
una consulta adicional innecesaria cuando los mismos datos ya viajaron en la
respuesta de `pets_overview` para la cuadrícula.

## 3. Preferencia de vista sin flash de contenido incorrecto

**Decision**: Un script inline, no bloqueado por defer/async, en `app/layout.tsx`
lee `localStorage.getItem('petdex:view')` antes de la hidratación y aplica un
atributo `data-view="grid|list"` sobre el `<html>` (o el contenedor raíz del
catálogo). El CSS usa ese atributo para decidir qué layout mostrar; el
componente cliente del toggle solo sincroniza el estado de React y
`localStorage` después de montar, sin volver a decidir el layout inicial.

**Rationale**: Es el mismo patrón que usan los selectores de tema claro/oscuro
para evitar el "flash of incorrect content": el HTML llega del servidor sin
saber la preferencia, y solo un script síncrono ejecutado antes del primer
paint puede aplicarla sin parpadeo. Usar solo `useEffect` en un componente
cliente causaría un frame con el layout por defecto seguido de un salto al
layout guardado.

**Alternatives considered**: Guardar la preferencia en una cookie y leerla en
el Server Component — descartado por alcance: agrega un mecanismo de
persistencia nuevo (cookies) cuando el spec ya pide `localStorage`
explícitamente, y esta feature no tiene sesión ni necesidad de que el server
conozca la preferencia para SEO.

## 4. `generateStaticParams` + datos frescos en la ficha

**Decision**: `app/mascotas/[slug]/page.tsx` exporta `generateStaticParams`
que lista los slugs existentes (`select slug from pets`) para pre-construir
las rutas conocidas, con `dynamicParams = true` para que un slug creado
después del último deploy también resuelva bajo demanda. La página en sí no
cachea la consulta de datos: se marca con `export const revalidate = 0` para
que cada visita traiga el estado actual de esa mascota (nombre, hitos, etc.),
en vez de servir una versión estática potencialmente vieja.

**Rationale**: El spec pide "datos frescos" pero el usuario también pidió
`generateStaticParams`. Ambos son compatibles: `generateStaticParams` optimiza
qué rutas existen y permite que Next las trate como conocidas (mejor
comportamiento de build y de fallback), mientras que `revalidate = 0`
desactiva el cacheo de contenido para que el paso "estático" no implique
"desactualizado".

**Alternatives considered**: ISR con `revalidate` en segundos (ej. 60) —
rechazado porque introduce una ventana de datos desactualizados que el spec
no pide y que complicaría innecesariamente el testeo de esta primera feature.

## 5. 404 propio para slugs inexistentes

**Decision**: `app/mascotas/[slug]/page.tsx` llama a `notFound()` de
`next/navigation` cuando la consulta por slug no devuelve fila, y el mismo
segmento de ruta define `not-found.tsx` con el diseño de PetDex. Se agrega
además un `app/not-found.tsx` de nivel raíz para cualquier otra URL
inexistente, así ninguna ruta de la feature cae en la página 404 genérica de
Next.

**Rationale**: Es el mecanismo soportado nativamente por Next.js App Router
para 404 por segmento sin necesitar un catch-all manual ni redirecciones.

**Alternatives considered**: Redirigir a `/` con un mensaje — rechazado
porque el spec pide explícitamente una página 404 propia, no un redirect.

## 6. Test de RLS (insert con anon key debe fallar)

**Decision**: El test de integración usa el cliente Supabase con la anon key
(las mismas `NEXT_PUBLIC_*` del proyecto real ya linkeado) para intentar un
`insert` en `pets` y afirma que la operación falla (error de política RLS).
Corre contra el proyecto Supabase hosteado real — no hay stack local de
Supabase levantado para esta feature — así que requiere que las variables de
entorno estén presentes al correr `npm run test`.

**Rationale**: El principio I de la constitución exige que la garantía viva
en la base, no en el código; el único modo de verificarlo de verdad es
ejercitar la política contra Postgres real, no mockear el cliente.

**Alternatives considered**: Levantar Supabase local (`supabase start`) para
correr el test de forma aislada — mejor a largo plazo, pero implica
infraestructura de testing nueva (Docker, `supabase db reset` con el mismo
esquema) fuera del alcance que pidió el usuario para esta feature.

## 7. Componentes shadcn/ui necesarios

**Decision**: Se inicializan solo los componentes que esta feature usa:
`card`, `badge` (categoría de hito), `input` (búsqueda), `select` (filtro de
zona), `button` (toggle de vista), `skeleton` (placeholder de imagen). Íconos
de `lucide-react`: `LayoutGrid`, `List`, `Search`, `MapPin`, `ImageOff`.

**Rationale**: Instalar solo lo que se usa evita componentes sin propósito en
el repo, consistente con el principio de no agregar abstracciones no
utilizadas.

**Alternatives considered**: Inicializar el set completo de shadcn/ui de una
vez — rechazado, agrega superficie sin uso inmediato.

## 8. Design system (`design-system/MASTER.md`)

**Decision**: Estilo "Minimalism & Swiss Style" con paleta monocromática
(zinc) + un único acento azul (`#2563EB`), tipografía Inter única, e íconos
Lucide. Documentado completo en `design-system/MASTER.md`.

**Rationale**: La primera corrida automática de `ui-ux-pro-max --design-system`
con la palabra "veterinary" sesgó el resultado hacia un patrón de
"Trust/healthcare" con paleta teal + naranja (dos acentos), lo que viola
directamente el Principio II ("paleta neutra, un solo color de acento, sin
gradientes"). Se resolvió a mano combinando `--domain style "minimalism swiss
neutral"` (Result 1: Minimalism & Swiss Style) con `--domain color "neutral
minimal single accent monochrome"` (Result 1: monocromo + acento azul), que sí
cumplen la constitución sin ajuste adicional.

**Alternatives considered**: Aceptar el resultado automático del comando
`--design-system` tal cual — rechazado porque contradecía un principio no
negociable de la constitución (un solo acento, sin paleta de marca tipo
salud/veterinaria).
