---
id: 068
etapa: E5
serves: "plan v2 §6 etapa 5 · tarea E5-5 · ticket 025, ADR 0025"
depends: [064]
status: done
---

# 068 — `nerd-stats` reescrito sobre el modelo nuevo

## Objetivo

Que la vista de salud siga contestando lo mismo con las tablas nuevas: corridas de sync y sus
errores, cambios recientes de configuracion, version desplegada y estado del cron.

## Alcance

- **Dentro:** reescribir `lib/queries/nerd-stats.ts` sobre leads, submissions y deals.
- **Dentro:** lo que el modelo nuevo hace visible y antes no: cuantos envios por corrida, cuantas
  fuentes **rotas** (ticket 055), y cuantos leads marcados "unido por telefono" sin resolver
  (ticket 050).
- **Dentro:** `sync_runs.fuentes_leidas` se conserva tal cual (ADR 0031). Las corridas viejas que
  no lo tienen muestran `—`, **nunca un nombre inventado**.
- **Fuera:** la bitacora de escrituras del CRM. Esa es la pantalla de D6 y es el ticket 076.

## Done cuando

- [ ] `/nerd-stats` funciona y sigue siendo exclusiva por guarda de rol (sin escribir `"developer"`
      a mano en ningun `requireRole`: eso lo resuelve `esAccesoTotal`, ADR 0025).
- [ ] Las corridas sin `fuentes_leidas` muestran `—`.
- [ ] Las fuentes rotas y los leads marcados se ven desde aqui.

## Kiro

Si.

---

## Cierre 2026-10-02 (sesión O1-g, rama `o1g-lecturas`)

**Hecho.** Falta el recorrido visual, que hace la sesión principal.

- **El sync ya no existe (108):** la pantalla no pinta un estado de cron. La tarjeta de despliegue dice
  "Entrada de leads: webhook · sin cron: el sync de Sheets se retiró el 28-sep", y las corridas quedan como
  **"Historial del sync de Sheets"**, de solo lectura. `fuentes_leidas` se conserva; una corrida sin el dato
  muestra `—` (`textoDeFuentesLeidas`, probado).
- **"Envíos por corrida" ya no aplica** (no hay corridas): se reemplazó por **envíos completos y parciales
  por programa** en "Conteos por programa", contados por el programa de la fuente.
- **Leads unidos por teléfono sin resolver:** columna nueva, contada sobre `posiblesDuplicadosDelPrograma`
  (la lista de Leads, 072), por lead distinto. No se reescribe el predicado.
- **Fuentes:** tarjeta "Fuentes de leads" con la salud de cada fuente activa (`saludDeFuentes`, 107, que
  reemplazó al 055): estado, último envío, sobres sin procesar y envíos sin Estado en 24 h, más la marca
  `rota` de la columna si alguna la tiene (nadie la escribe hoy). Enlaza a Ajustes → Salud para el detalle.
- **Guarda:** `paginaDeAccesoTotal()` (nueva en `lib/auth/page-guards.ts`) = `paginaConRol()` sin roles: solo
  pasa quien `esAccesoTotal` dice. La página ya no escribe `"developer"` a mano (antes:
  `paginaConRol("developer")`). Un test lee la página y lo exige; la guarda sigue probada en
  `tests/paginas.test.ts`.
- **Tests:** `tests/nerd-stats.test.ts` (12) y el mock de `tests/paginas.test.ts`.

**Para Mani:** `sources.estado = 'rota'` (039/055) no lo escribe nadie desde que el 055 quedó reemplazado.
¿Se retira la columna en una migración futura? No la toqué.
