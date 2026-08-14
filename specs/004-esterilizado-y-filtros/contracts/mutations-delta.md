# Contracts delta: `createPet` / `updatePet`

Extiende el contrato ya documentado en
`specs/002-panel-administracion/contracts/mutations.md` — mismas garantías
(validación Zod, `getUser()` solo para el mensaje temprano, `pets_admin_write`
como garantía real, `revalidatePath` sin cambios). Este documento cubre
únicamente el delta de payload.

## `createPet(input)` — `src/lib/pets.ts`

**Input**, campo nuevo:
```ts
{ ...input existente, sterilized: boolean }
```

Sin default a nivel de Action — el default `false` lo aplica
`petFieldsSchema` (`z.boolean().default(false)`) si el formulario no lo
completa explícitamente, y a nivel de columna (`not null default false`)
para cualquier inserción que la sortee.

## `updatePet(id, input)` — `src/lib/pets.ts`

Mismo campo nuevo, mismo tratamiento — a diferencia de `photoUrl`,
`sterilized` no tiene semántica de "no tocar": siempre viaja con el valor
actual del formulario, igual que `status`.

## Sin contratos nuevos

No se agrega ninguna Action nueva. El filtrado de Estado/Esterilizado en el
catálogo es puramente de lectura sobre datos ya obtenidos por
`getPetSummaries()` (sin RPC ni Action — ver research.md §4), así que no
constituye un contrato de escritura ni de lectura parametrizada nuevo.
