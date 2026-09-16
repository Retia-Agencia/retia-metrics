---
id: 022
fase: F3
serves: "ADR 0017; spec §5 criterio 6"
depends: [011, 017]
status: todo
---

# 022 — Tablas de recursos y enlaces de pago

## Objetivo
La base guarda los links del equipo con su programa, categoría, versión vigente e historial.

## Alcance
- Dentro: tabla `recursos` (`programId` nullable = global, `categoria`, `titulo`, `url`,
  `vigente`, `reemplazaA` nullable, `activo`, `createdAt`). `categoria` es un catálogo más
  (`categorias_recurso`, semilla: Brochure, Página web, Guion, Formulario, Calendly, Drive) sobre
  el molde.
- Dentro: tabla `enlaces_pago` (`programId`, `productoId` nullable, `plataformaId`, `monto`,
  `moneda`, `url`, `vigente`, `activo`, `createdAt`).
- Dentro: `lib/catalogo/recursos.ts` y `lib/catalogo/enlaces-pago.ts`. Operación extra
  `reemplazar(id, nuevaUrl)`: crea la fila nueva vigente y marca la anterior no vigente.
- Dentro: zod exige `https://`.
- Dentro: semilla con los 5 links de PayPal de Comunicarte publicados en el grupo el 8-sep
  (797, 697, 400, 300, 200 USD), cargada desde un script que lee de variables o de un archivo
  fuera del repo, no escrita en código.
- Fuera: la pantalla (023).

## Done cuando
- [ ] Reemplazar un brochure deja una sola versión vigente por (programa, categoría, título).
- [ ] Tests de reemplazo e historial.
