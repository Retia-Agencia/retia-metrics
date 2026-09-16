---
id: 014
fase: F0
serves: "spec §5 criterio 4"
depends: [010, 011]
status: todo
---

# 014 — Administrar programas y cohortes desde /ajustes

## Objetivo
Un gerente crea un programa (nombre, slug, web, Calendly) y sus cohortes (código, fechas, meta
de cupos, meta de leads por día, precio de referencia, TRM, estado) sin tocar código.

## Alcance
- Dentro: columnas nuevas `programs.webUrl`, `programs.calendlyUrl`, `cohorts.metaLeadsDia`.
- Dentro: `lib/catalogo/programas.ts` y `lib/catalogo/cohortes.ts` sobre el molde.
- Dentro: regla de negocio en el esquema: máximo una cohorte `activa` por programa (índice único
  parcial en la base, no solo en código, igual que ADR 0005).
- Dentro: el slug se valida (`^[a-z0-9-]+$`) y no se puede editar una vez creado (las URLs
  guardadas dependen de él).
- Dentro: `/ajustes/programas` y `/ajustes/programas/[slug]` (cohortes del programa), solo
  gerente.
- Dentro: `scripts/seed-datos.ts` se mantiene como semilla inicial; se documenta en su cabecera.
- Fuera: fuentes (016), recursos (023).

## Done cuando
- [ ] Crear un programa desde la pantalla lo hace aparecer en el sidebar (010) sin despliegue.
- [ ] Activar una segunda cohorte en el mismo programa falla con un mensaje claro.
- [ ] Desactivar un programa lo saca de la navegación sin borrar sus datos.
