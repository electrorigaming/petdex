# PetDex

PWA de registro y seguimiento de animales callejeros de un barrio.
Lectura pública sin cuenta; escritura solo para cuentas administradoras
autorizadas (login con Google).

**Stack:** Next.js App Router · TypeScript · Tailwind · shadcn/ui · Supabase · Vercel
**Metodología:** Spec-Driven Development (Spec-Kit). Los artefactos viven en `specs/`.

---

## Reglas que no se negocian

### La autorización vive en Postgres, no en el código

Toda regla de acceso es una política RLS. Las Server Actions validan la sesión
para dar buenos mensajes de error, pero **la garantía es la política**. Si una
Server Action se olvida de chequear, la base tiene que rechazar igual.

**La service role key no se usa en este proyecto.** No está en el `.env`, no se
importa, no existe. Si aparece la necesidad de usarla para que algo funcione,
eso significa que una política RLS está mal escrita: arreglá la política.
Nunca saltees RLS para destrabar una tarea.

Solo dos variables de entorno son válidas:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Login de administradoras

Google Sign-In únicamente — sin contraseña propia, sin registro, sin
recuperación de contraseña. **Puede haber más de una cuenta administradora**:
cada email de Google autorizado se carga a mano en la tabla `admins`, todas
con exactamente los mismos permisos, sin roles ni jerarquía entre ellas.

### Clientes de Supabase

Usar `@supabase/ssr`. Los helpers legacy (`@supabase/auth-helpers-nextjs`) están
deprecados — no usarlos aunque aparezcan en ejemplos.

Tres factories separadas, no intercambiables:
- `lib/supabase/client.ts` — browser
- `lib/supabase/server.ts` — Server Components y Server Actions, lee cookies
- `middleware.ts` — refresca la sesión

### Fotos

Bucket `pet-photos`, público. Guardar en `pets.photo_url` la URL pública
permanente de `getPublicUrl()`. **Nunca una signed URL** — expiran y dejan la
cuadrícula llena de imágenes rotas.

Comprimir en el cliente antes de subir: máximo 1600px de lado mayor, WebP.
El tier gratuito da 1 GB de storage y una foto de cámara sin comprimir son 4 MB.

### Avistamientos

- Marcar el día se hace con `rpc('mark_sighting', ...)`, que hace upsert sobre
  `(pet_id, seen_on)`. Es idempotente: tocar dos veces no duplica.
- **Tres estados, no dos:** visto / revisado y no estaba / sin registro.
  El tercero es la ausencia de fila. No los colapses a un booleano.
- Nunca pregenerar filas para días sin registro.

### Zona horaria

`current_date` en Postgres es UTC. El barrio está en UTC-3. Calcular la fecha
local en el cliente y pasarla explícita a `mark_sighting(p_date)`. No confiar en
el default de la función.

### Cuadrícula

Consultar la vista `pets_overview`, nunca las tablas base con una subconsulta
por tarjeta. El contador sale de un `count` con `head: true` sobre la misma vista.

---

## Diseño

Minimalism & Swiss Style. El design system está en `design-system/MASTER.md`
(generado por ui-ux-pro-max). Antes de escribir UI, leerlo; si existe
`design-system/pages/<pagina>.md`, sus reglas tienen prioridad.

- Paleta neutra, un solo color de acento
- Sin emojis como íconos → Lucide
- Contraste mínimo 4.5:1, foco visible en navegación por teclado
- Respetar `prefers-reduced-motion`
- Mobile-first: 375 / 768 / 1024 / 1440

El caso de uso principal es alguien parado en la calle, con una mano, marcando
un avistamiento. Si algo requiere dos manos o zoom, está mal diseñado.

---

## Comandos

```bash
npm run dev
npm run typecheck
npm run test
npm run gen:types      # regenerar tipos después de CADA migración
```

Después de tocar el esquema, regenerar los tipos y correr `typecheck` antes de
seguir. Los tipos de `src/types/database.ts` son generados: no editarlos a mano.

---

## Antes de dar una tarea por terminada

- [ ] `npm run typecheck` pasa
- [ ] Un insert con la anon key en la tabla tocada **falla**
- [ ] Ninguna imagen depende de una URL con expiración
- [ ] La pantalla funciona en 375px de ancho
- [ ] No se agregaron variables de entorno nuevas

---

## Alcance de la v1

**Dentro:** cuadrícula con contador, ficha con timeline de hitos, calendario de
avistamientos, panel de admin, PWA con degradación offline.

**Fuera:** comentarios de usuarios, notificaciones push, geolocalización
automática, flujo de adopciones. Si una tarea empuja hacia alguno de estos,
pará y preguntá antes de implementar.

---

## Deuda técnica conocida

Los proyectos gratuitos de Supabase se pausan tras 7 días sin actividad. Hay un
GitHub Action que pinguea cada 3 días para evitarlo. Es un workaround: la
solución real es el plan Pro. Documentado acá para que no se olvide.
