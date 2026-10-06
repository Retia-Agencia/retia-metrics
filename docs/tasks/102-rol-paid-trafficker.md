---
id: 102
etapa: E1b
serves: "ADR 0052"
depends: [094]
status: todo
---

> **3-oct:** lo construye la sesión S6 de la ola O3 dentro del [173](./173-ajustes-solo-lo-que-no-es-de-nadie.md) (Canales los crea quien `manejaPauta`). La migración la aplica la sesión principal.


# 102 — El rol Paid Trafficker y la pregunta `manejaPauta`

## Objetivo

Que Pauta cree sus campañas y sus links dentro del CRM y mida la operación de sus programas, sin
administrar nada más.

## Alcance

- **Dentro:** el valor `paid_trafficker` en el enum de roles (migración de la sesión principal) y la
  pregunta `manejaPauta` en `lib/auth/roles.ts`. La cumplen el paid trafficker, el gerente y el
  developer.
- **Dentro:** acceso a Campañas de sus programas (membresía, ticket 094): crear, editar, generar links y
  cargar gasto.
- **Dentro:** alta de usuarios con este rol desde `/ajustes/usuarios`.
- **✅ Mani, 29-sep (tras la reunión con Pauta):** el paid trafficker es un rol del CRM que **crea las UTM
  y mide la operación de sus programas**: métricas, metas y lo demás del Dashboard. Falta precisar si ve
  la caja y el comparativo entre closers.
- **Fuera:** deals, llamadas, abonos, administración.

## Done cuando

- [ ] Nada en `app/` ni `lib/` pregunta `rol === "paid_trafficker"` (el guardián de roles lo caza).
- [ ] Un paid trafficker que forja la petición a una ruta de deals recibe 403, y la base no se mueve.
- [ ] La vista `todo` del developer sigue siendo superset de todas (ticket 032).

## Kiro

Parcial. El código y los tests sí, con revisión de permisos. La migración, la sesión principal.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- **Qué ve (Mani, 29-sep; ADR 0052 enmendado):** el Dashboard de sus programas menos el comparativo entre closers y la comisión; sí ventas contratadas y caja, que el ROAS necesita. Crea links de orgánico en el builder y conecta la cuenta de Meta de sus programas (119).
- Usuarios de Pauta: Anderson, César y Daniela Rodríguez (entra full time).

## Enmienda 2026-09-30 (Mani, ticket 101)

- **El paid trafficker maneja los Canales:** `/ajustes/canales` (crear, editar, desactivar y ver los pares sin canal)
  pasa de `esAdministrador` a `manejaPauta`, en la página y en sus server actions. Mapear lo que llega es trabajo de
  Pauta; el CRM solo muestra lo que no casa.

## Entrega 5-oct (Alejo + Claude): su Dashboard

- **Alcance (decidido con Alejo):** ve todos los programas activos, sin membresías (enmienda del ADR 0052, 5-oct).
- `veEquipoComercial` (quinta pregunta de `roles.ts`) y `sinListas` (`vista-metrica.ts`). La página
  `/p/[programa]/dashboard` admite al paid trafficker; sin equipo: ni comparativo, ni comisión, ni abiertos por owner,
  ni filtro de closer, ni enlaces a Metas, Programa o listas, y las cifras no abren. El selector no le ofrece "Todos los
  programas"; su nav suma Dashboard.
- Tests: `tests/roles.test.ts` (la pregunta y su nav), `tests/alcance-de-sesion.test.ts` (ve todos sin membresía),
  `tests/sin-listas.test.ts` y `tests/paginas.test.ts` (la página real: closer de la URL ignorado, `veEquipo` falso,
  cifras sin lista; la lista, "todos", deals, leads y calls lo redirigen; el gerente sin cambios). Mordido: con
  `veEquipo` forzado a verdadero caen dos.
- Recorrido en `dev:local` con un paid trafficker local: Pulso, Operación, Dinero y Pauta, 375 px sin scroll lateral,
  URLs forjadas a la lista, "todos" y Deals terminan en Mi espacio; el developer sigue viendo Closers, comisión y listas.
- Done cuando: nada pregunta `rol === "paid_trafficker"` (sí); una ruta de deals forjada lo saca sin tocar la base (sí,
  redirige por la guarda); la vista `todo` del developer sigue siendo superset (sí, cumple las cinco preguntas).

