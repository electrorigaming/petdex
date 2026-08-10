# Quickstart: Panel de administración

Guía de validación manual y automatizada. No repite código de implementación
— ver `contracts/` y `data-model.md` para las formas exactas.

## Prerrequisitos (una sola vez, fuera del código)

1. **Proveedor Google en Supabase Auth**: Dashboard → Authentication →
   Providers → Google, con Client ID/Secret de un proyecto de Google Cloud
   Console. Callback URL registrada en Google Cloud Console:
   `https://<tu-proyecto>.supabase.co/auth/v1/callback`.
2. **Al menos un admin real**: iniciar sesión una vez con la cuenta de Google
   que va a administrar, copiar su `id` desde Authentication → Users, e
   insertarlo a mano:
   ```sql
   insert into public.admins (user_id) values ('<uuid>');
   ```
3. **Admin de prueba para tests** (research.md §6): crear un usuario en
   Authentication → Users con email/contraseña (proveedor email sigue
   habilitado a nivel de proyecto por defecto), agregarlo a `admins` con el
   mismo `insert` de arriba, y cargar sus credenciales en `.env.local`:
   ```
   TEST_ADMIN_EMAIL=admin-de-prueba@example.com
   TEST_ADMIN_PASSWORD=<contraseña de solo-test>
   ```
   Estas dos variables son del arnés de tests, no de la app — no van a Vercel.
4. Confirmar que `.env.local` sigue teniendo únicamente
   `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` como
   variables de la aplicación en sí.

## Instalar dependencias nuevas

```bash
npm install react-hook-form zod @hookform/resolvers
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

## Validación manual — User Story 1 (Login, P1)

1. `npm run dev`, ir a `/` sin sesión. Confirmar que no hay ningún control de
   edición visible y que existe un enlace "Iniciar sesión" (FR-006).
2. Click en el enlace → `/login`. Click en "Continuar con Google" → completar
   el consentimiento real con la cuenta admin del prerrequisito 2.
3. Confirmar redirección de vuelta a `/` (o a la ruta desde la que se llegó a
   `/login`, si se llegó a través del middleware) en menos de 10 segundos
   (SC-006), y que ahora aparecen controles de edición y el botón de cerrar
   sesión.
4. Cerrar sesión → confirmar que los controles vuelven a desaparecer sin
   recargar manualmente.
5. Repetir el login con una cuenta de Google que **no** esté en `admins`:
   confirmar que el login en sí funciona (hay `user`) pero cualquier intento
   de guardar en el paso siguiente falla con un mensaje de permisos genérico,
   sin revelar si esa cuenta específica está o no en la lista (FR-003).

## Validación manual — User Story 2 (Alta/edición de mascota, P2)

1. Con sesión admin, ir a `/mascotas/nueva`. Completar nombre; confirmar que
   el slug se autogenera y se muestra antes de guardar.
2. Elegir una foto desde archivo; confirmar preview inmediata y barra de
   progreso durante la subida.
3. Guardar. Confirmar redirección a `/mascotas/{slug}` y que la foto se ve
   (comprobar en las herramientas de red que la URL es la pública permanente,
   no una signed URL — checklist de `CLAUDE.md`).
4. Editar la misma mascota, reemplazar la foto. Confirmar en el dashboard de
   Supabase Storage que el archivo anterior ya no está (Principio IV).
5. Editar de nuevo y quitar la foto sin reemplazar (FR-013): confirmar que
   `photo_url` queda vacío y el archivo se borra de Storage.
6. Intentar guardar un nombre que genere un slug ya usado por otra mascota:
   confirmar el aviso y que no deja guardar hasta corregirlo (FR-015).
7. Renombrar una mascota existente: confirmar que el slug **no** cambia y que
   la URL vieja sigue funcionando (FR-016).
8. Abrir el formulario, cambiar un campo, intentar salir sin guardar:
   confirmar que pide confirmación (FR-017).
9. Repetir el flujo completo de alta con foto y cronometrar: debe ser posible
   en menos de 3 minutos (SC-001).
10. Probar en un viewport de 375px de ancho con una sola mano en mente: campos
    grandes, teclado numérico al enfocar peso, botón de guardar alcanzable
    con el pulgar (checklist de `CLAUDE.md`).

## Validación manual — User Story 3 (Hitos, P3)

1. Desde una ficha, agregar un hito con solo el título (fecha por defecto
   hoy). Confirmar que aparece en la timeline sin recargar la página, en
   menos de 2 segundos (SC-003).
2. Editarlo, cambiar la categoría. Confirmar que el cambio se refleja de
   inmediato.
3. Borrarlo: confirmar que el diálogo exige reconocer el título del hito
   antes de habilitar "Confirmar" (FR-021).

## Checklist de "tarea terminada" (extiende el de `CLAUDE.md`)

- [ ] `npm run typecheck` pasa
- [ ] Un insert/update/delete con la **anon key** en `pets`, `milestones`
      falla con `42501`
- [ ] Un insert/update/delete con la **sesión del admin de prueba**
      (`TEST_ADMIN_EMAIL`) tiene éxito en las mismas tablas
- [ ] Ninguna imagen depende de una URL con expiración
- [ ] Las pantallas nuevas funcionan en 375px de ancho
- [ ] No se agregaron variables de entorno de **aplicación** nuevas
      (`TEST_ADMIN_*` son del arnés de tests, no cuentan)
- [ ] `middleware.ts` devuelve siempre el `response` con las cookies del
      cliente de Supabase copiadas — nunca un `NextResponse` construido desde
      cero sin copiarlas

## Automatizado

```bash
npm run test              # Vitest: slug, compresión, mapeo de errores, RLS (anon + admin de prueba)
npx playwright test       # E2E: global-setup bootstrapea sesión admin real; ver research.md §6
```
