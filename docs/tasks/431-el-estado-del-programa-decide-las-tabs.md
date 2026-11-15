---
id: 431
etapa: configuracion
serves: "Mani, 14-nov: con un programa inactivo hay rutas que fallan · ADR 0132 punto 3 · docs/onboarding-de-programa.md F1"
depends: []
status: en main
---

# 431 — El estado del programa decide las tabs

## Por qué
`app-sidebar.tsx:103-108` arma el menú con el último programa activo aunque el selector muestre un inactivo; las tabs
apuntan a otro programa o a rutas del inactivo que responden 404. El selector lo parcha en el cliente (`slugsInactivos`).

## Qué
- `navParaRol` recibe `{ slug, activo } | null`; con un inactivo solo ofrece la tab Programa (si `leePrograma`).
- `app-sidebar.tsx`: una sola variable para el programa elegido, con su estado.
- `rutaAlCambiarDePrograma` decide la ruta hacia un inactivo; el parche del selector se borra.
- Helper de página en `lib/auth/page-guards.ts`: visible → sigue; inactivo administrable → redirect a `/p/<slug>/programa`; si no → 404.
  Lo usan las 11 páginas de tab bajo `app/(app)/p/[programa]/`.

## Done cuando
- [ ] Tests de `navParaRol` y `rutaAlCambiarDePrograma` con un inactivo; páginas forjadas: administrador redirigido, closer 404.
- [ ] Typecheck, lint, tests del cambio y `npm run build` en verde; recorrido en `dev:local` con un inactivo.
- [ ] Tracker y `status:` iguales (N9).
