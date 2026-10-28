# 0107: Media es un rol, y "trabaja contenido" es su pregunta

- **Estado:** aceptado · 28-oct-2026 (Mani, grill del plan de media sobre `docs/media/propuesta.md`).
- **Enmienda:** ADR 0094 (el alcance configurable lo tiene también `media`).
- **Confirma:** ADR 0025 (el developer pasa toda guarda), ADR 0003 (los roles no heredan), ADR 0012.

## Contexto

La operación de media entra al CRM (`docs/media/propuesta.md` §2). Quien la coordina tiene que ver su pipeline y los
insights de las llamadas, **nunca** el transcript, la lista de leads, el dinero ni el trabajo de los closers. Media
nombra roles internos (coordinación, edición, creador) y la visión exige "roles, no personas".

## Decisión

1. **Un solo rol nuevo, `media`**, en `ROLES` (`lib/auth/roles.ts`) y en el `pgEnum` `rol`, con su etiqueta en
   `ETIQUETA_ROL` ("Media"). Coordinación, edición y creador **no son roles**: el creador es una fila de catálogo
   (ADR 0110) y el responsable de una tarea es un usuario cualquiera. El código no decide por persona.
2. **La pregunta nueva es `trabajaContenido`**, en `lib/auth/roles.ts`: la cumplen `media`, `gerente` y `developer`
   (el developer por `esAccesoTotal`, nunca escrito a mano). Abre la vista de media, el banco, las piezas y los
   insights. **Los insights no abren la llamada ni el lead**: lo que una pantalla de media proyecta sale sin
   identidad (ADR 0112).
3. **Alcance por programa con el molde del ADR 0094**: `tieneAlcanceConfigurable` incluye a `media`. Sin filas en
   `usuarios_programas_alcance` ve todos los programas activos y los creadores sin programa (ADR 0110); con filas,
   solo esos programas y ningún creador sin programa. No usa membresías: media no tiene `closer_id` ni trabaja leads.
4. **`media` no cumple `trabajaLeads`, `manejaPauta`, `veEquipoComercial`, `esAdministrador` ni `administraGlobal`.**
   No entra a Leads, Deals, Calls, Inbox, Students, Ajustes ni al Hub comercial.
5. **En v1 inicia sesión solo la coordinación de media** (y gerencia). Creadores y edición reciben su link fijo y
   los avisos por WhatsApp, sin cuenta. Se revisa cuando el pipeline (paso 4) pida que marquen entregas ellos mismos.

## Por qué

Un rol por persona de media convierte cada cambio de equipo en código y multiplica las guardas. Sin rol nuevo
(media como gerente con alcance) vería lo comercial, contra "solo insights". La pregunta separada del rol es la
misma lección de `esGerente` (AGENTS.md): se pregunta qué puede hacer alguien, no qué rol tiene.

## Consecuencias

- Migración del `pgEnum` `rol` (ticket 315). `tests/roles.test.ts` y `tests/paginas.test.ts` muerden la vista de media
  en los dos sentidos: media entra a lo suyo, y una ruta comercial le responde 403 o 404 aunque fuerce la URL.
- El humo de la UI (ADR 0083) gana un usuario `media` en la base local.
