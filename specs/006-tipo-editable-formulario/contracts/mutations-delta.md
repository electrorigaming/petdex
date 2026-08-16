# Contracts delta: `createPet` / `updatePet`

Extiende el contrato de `002-panel-administracion/contracts/mutations.md` y
el delta ya aplicado en `004-esterilizado-y-filtros/contracts/mutations-delta.md`.
Este documento cubre únicamente lo que cambia respecto de
`005-tipo-privado-publico` (que dejó `visibility`/`created_by` fuera de
ambos payloads).

## `createPet(input)` — `src/lib/actions/pets.ts`

**Input**, campo nuevo:
```ts
{ ...input existente, visibility: "publico" | "privado" }
```

**Insert**, campos nuevos:
```ts
{
  ...insert existente,
  visibility: values.visibility,
  created_by: values.visibility === "privado" ? user.id : null,
}
```

`pets_admin_insert` (con el endurecimiento de research.md §3) rechaza el
insert si `visibility='privado'` y `created_by` no es el propio `auth.uid()`
— la Action nunca manda otra cosa, así que en la práctica esto no falla
salvo un intento directo (sin pasar por la Action) de asignar una dueña
ajena.

## `updatePet(id, input)` — `src/lib/actions/pets.ts`

Mismo campo nuevo en el input. **Update**, campos nuevos:
```ts
{
  ...update existente,
  visibility: values.visibility,
  created_by: values.visibility === "privado" ? user.id : null,
}
```

Sin rama especial para "ya era privada antes" — `created_by` se recalcula
en cada guardado exclusivamente a partir del valor de `visibility` que
llega en `values`, nunca leyendo el valor previo de la fila (research.md
§4). `pets_admin_update` (sin cambios respecto de 005) es la garantía real
de FR-004/FR-006: `USING` decide si esta sesión puede tocar la fila para
empezar, `WITH CHECK` decide si el resultado (con la nueva dueña) es
válido.

## Sin contratos nuevos

`deletePet`/`restorePet` no cambian de firma ni de payload — `restorePet`
reinserta la snapshot completa tal cual, y sigue funcionando bajo el
`pets_admin_insert` endurecido por las razones de research.md §3.
