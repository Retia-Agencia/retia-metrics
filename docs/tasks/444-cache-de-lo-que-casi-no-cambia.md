---
id: 444
etapa: rendimiento
serves: "docs/estudio-rendimiento-y-conexion.md §6.3 y §8.6 · decisión 3 de la §10"
depends: [437, 438]
status: todo
---

# 444 — Lo que casi no cambia se lee de caché, con dueño e invalidación

## Qué
Caché de datos entre solicitudes solo para lecturas que no dependen de la persona ni del minuto, cada una con su
invalidación explícita. Va **después** de quitar las consultas repetidas y los N+1 (437, 438): primero se deja de
hacer trabajo de más; después se guarda lo que queda.

## Por qué
- Cero caché de datos hoy: 32 páginas con `force-dynamic`, ninguna lectura con `"use cache"` ni `unstable_cache`.
- Toda petición paga 4 consultas de sesión, alcance y layout, y los catálogos (programas activos, cohortes, tasas de
  cambio, árbol de pauta) se releen en cada render aunque cambian pocas veces al día.

## Qué sí y qué no (decisión 3; Mani la confirma al aprobar el ticket)
| Dato | Caché | Se invalida cuando |
|---|---|---|
| Programas activos, cohortes y su configuración | Sí | El molde de `lib/catalogo/` escribe esa tabla |
| Tasas de cambio (`tasas_cambio`) | Sí | El cron de pauta registra la TRM |
| Árbol de pauta (`pauta_objetos`) | Sí | El sync de Meta termina |
| Usuarios activos por rol, membresías | **No** | Quitar a alguien tiene que surtir efecto en la siguiente petición (S-02) |
| Cifras del Hub, embudo, caja, saldos, bandejas | **No** | Regla de métricas dinámicas: se recalculan con el CRM vivo |
| Cualquier dato filtrado por la sesión | **No** | Un caché compartido entre personas es una fuga de permisos |

## Archivos
`lib/cache/` (nuevo: etiquetas e invalidación en un solo módulo) · `lib/catalogo/molde.ts` (invalida al escribir) ·
`lib/queries/programas.ts`, `lib/trm/consultar.ts`, `lib/pauta/arbol.ts`, la lectura de cohortes ·
`next.config.ts` · `tests/cache-con-dueno.test.ts` (nuevo).

## Cómo
**Lee primero** (este Next no es el de tu memoria): `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md`,
`05-config/01-next-config-js/cacheComponents.md` y `cacheLife.md`, y las guías `caching-without-cache-components.md`,
`migrating-to-cache-components.md` y `authentication-with-cache-components.md`. Decide con ellas si se usa
`"use cache"` (exige activar `cacheComponents`, que cambia cómo se renderiza toda la app) o el mecanismo de la guía
"sin cache components". **Elige el de menor alcance** y deja escrito por qué. Si la única opción obliga a migrar toda
la app, detente y repórtalo: es otra decisión.

La forma, con cualquiera de los dos mecanismos:

```ts
// lib/cache/etiquetas.ts — los nombres viven en un solo lugar
export const ETIQUETA = {
  programas: "catalogo:programas",
  cohortes: (programId: string) => `catalogo:cohortes:${programId}`,
  tasasDeCambio: "trm",
  arbolDePauta: (programId: string) => `pauta:arbol:${programId}`,
} as const;

// lib/cache/invalidar.ts — lo llama quien escribe, en la misma operación
export function invalidar(etiqueta: string): void { /* revalidateTag o el equivalente de esta versión */ }
```

- La función cacheada **no recibe la sesión**: recibe ids. El alcance por rol se aplica después, sobre el resultado.
- El molde de catálogo invalida en el mismo lugar donde escribe `change_log`: no hay forma de escribir sin invalidar
  (mismo argumento que el rastro, ADR 0029).
- Un script que escribe catálogo pasa por el molde, así que invalida igual. Una escritura a mano en la base no: el
  caché lleva además un vencimiento corto (5 minutos) como red.
- `experimental.staleTimes.dynamic = 15` (caché del navegador) no se toca.

## Guardián
`tests/cache-con-dueno.test.ts`: (1) toda etiqueta de `ETIQUETA` tiene al menos un `invalidar(` en `lib/`; (2) ninguna
función cacheada recibe `session` ni importa de `lib/auth/`; (3) editar un programa por el molde y releer devuelve el
valor nuevo.

## Done cuando
- [ ] Mecanismo elegido y justificado con la documentación de `node_modules/next/dist/docs/`, escrito aquí.
- [ ] La base por petición baja de 4 a ≤ 2 consultas en una ruta sin datos propios (`/perfil`), medido con el 436.
- [ ] Recorrido en `dev:local` con dos sesiones: editar una cohorte en una y verla cambiada en la otra en la
      siguiente navegación; desactivar un usuario y que su siguiente petición lo saque.
- [ ] Guardián verde y mordido; build; tracker y `status:` iguales.
