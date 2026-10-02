---
id: 091
etapa: E6
serves: "plan v2 §12.9.3 · ADR 0043 punto 6"
depends: [073]
status: done
---

# 091 — `otrosProgramasDelCorreo`: la visibilidad cruzada, sin cruzar la frontera

## Objetivo

Que un closer vea *"a esta persona ya la conocemos del otro programa"* **sin que ninguna metrica pueda
sumar los dos programas**.

Sale del objetivo de fondo de Alejo: *"toda la info centralizada y sin perder NADA de visibilidad"*.

## Por que es una consulta y no una tabla

Se midio contra `production` el 21-sep: **5 correos de 4.818** aparecen en los dos programas (0,1%).
Normalizar con una tabla `personas` costaria una junta en cada consulta, reabriria la identidad a
escala de empresa, y **construiria el puente por el que un `join` cruza la frontera** — todo para
modelar cinco filas (ADR 0043 punto 5).

## Alcance

- **Dentro:** `otrosProgramasDelCorreo(email, programaActual)` en `lib/queries/`: un `select` sobre
  `leads`, que **ya tiene el correo normalizado**.
- **Dentro:** sale en la **ficha del Lead** como aviso, con el programa y la etapa del otro deal.
- **Fuera:** cualquier agregado. **Ninguna metrica la usa.**
- **Fuera:** unir, fusionar o compartir id entre los dos leads.

## La regla que no se rompe

Es la que `AGENTS.md` ya tiene escrita: **la proyeccion es del llamador, el predicado es del modulo**.
Que la pantalla muestre el hecho **no significa que el embudo lo sume**.

## Done cuando

- [ ] La ficha de uno de los 5 correos reales muestra el aviso (recorrido de la sesion principal).
- [x] Un test verifica que la funcion **no la llama** ningun modulo de `lib/queries/dashboard.ts` ni
      ninguna consulta de metrica.
- [x] Cero esquema nuevo, cero migracion.

## Kiro

Si.

## Hecho (2-oct, rama `ticket-073`)

- `otrosProgramasDelCorreo(db, emailNormalizado, programaActualId)` en
  `lib/queries/otros-programas-del-correo.ts`: un `select` sobre `leads` (el correo ya viene
  normalizado) mas los deals vigentes de esos leads; devuelve programa, slug, lead y la etapa del deal
  abierto (o del ultimo si todos estan cerrados; un deal anulado no cuenta, ADR 0038). No une ni fusiona.
- El aviso sale arriba de la ficha del Lead (`AvisoOtrosProgramas` en `components/leads/ficha-lead.tsx`),
  en tono `info`, con enlace a la ficha del otro lead y la etapa.
- **Decision (proyeccion del llamador):** la pagina cruza el resultado con `idsDeProgramasVisibles`. De
  un programa que la sesion ve se muestra nombre, etapa y enlace; de uno que NO ve (un closer sin
  membresia alla) solo "esta en un programa que tu cuenta no ve", sin nombre ni etapa: el alcance del
  ADR 0048 no se ensancha por un aviso. Si Mani prefiere que el closer vea el nombre del otro programa
  aunque no tenga membresia, es un cambio de una linea en la pagina.
- **Guardian:** `tests/otros-programas-del-correo.test.ts` recorre `lib/`, `app/`, `components/` y
  `scripts/` y falla si algun archivo fuera de la definicion, la ficha del Lead y su componente la nombra
  (incluye el import del modulo); mordido en los dos sentidos.

