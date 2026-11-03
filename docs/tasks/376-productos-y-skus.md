---
id: 376
etapa: deals
serves: "Weekly con Daniel Tovar del 3-nov (docs/hub.md §0, G-13) · enmienda el ADR 0113 (abono adicional) · ADR 0012, 0037"
depends: [368, 369]
status: todo
---

# 376 — Productos y SKUs: qué compró cada persona

**Fase 2** de la entrega (`docs/hub.md` §0). **DH-4 decidida por Mani el 3-nov: líneas de venta sobre el deal.** Antes
de construir va un ADR nuevo con `/grill-with-docs`, porque toca el objeto central (el deal).

## Por qué

Daniel Tovar, weekly del 3-nov:

> "Yo necesito poder ver qué SKUs compró ese cliente. (...) Hay dos diferenciaciones que hay que hacer. Una, que es como
> el producto, y otra, que es el SKU. (...) El producto es programa virtual. Y otro producto es personalizados uno a
> uno. Un producto contiene varios SKUs: programa virtual mayo 2026, programa virtual agosto 2026 (...)."

> "Si Vieira tiene diez tipos de programas diferentes y una sola persona compró siete, yo quiero ver cuándo lo compró,
> qué producto compró, todos los datos referentes a esos siete productos."

> "Que una persona que me haya comprado Tactical Investor programa virtual C3, yo le pueda poner que también me compró
> Tactical Investor uno a uno C3, que son dos productos distintos."

> Sobre quién crea los SKUs: "O nosotros o tú. Pero nadie más (...) hay gente que le va a escribir 'tactical investor
> raya tres' y hay gente que va a escribir 'tactical investor dos puntos tres'. (...) La nomenclatura debe ser uniforme
> para todos los programas." Los closers **asignan**, no crean.

Hoy (3-nov): un programa tiene cohortes con precio (`cohorts.precio_usd`); la venta es el deal (ADR 0037) y su cohorte
es el SKU implícito. El 1:1 entra como **abono adicional** del deal del programa (ADR 0113, 339 en `main`): suma a la
caja, pero no es una venta, no tiene SKU y no se puede contar ni filtrar. La tabla `productos` vieja ya no existe.

## El modelo (DH-4, decidido el 3-nov)

**Líneas de venta sobre el deal, no varios deals por lead.**

- `productos` (catálogo, ADR 0012): programa, nombre ("Programa virtual", "Personalizado 1:1"), activo.
- **SKU = producto × cohorte**, con su precio y su nombre armado por el sistema (`Tactical Investor · 1:1 · C3`), nunca
  tecleado: así la nomenclatura es uniforme por construcción, que es lo que pide Dani. Lo crean solo quienes
  `esAdministrador` (gerente y developer), por el molde de `lib/catalogo/`.
- `deal_lineas`: deal, SKU, valor vendido de la línea, quién vendió, cuándo. El "Programa virtual" de la cohorte del deal
  es la primera línea, creada al entrar a Abonado (lo de hoy, sin cambio de comportamiento). Un closer agrega una línea
  "1:1 C3" a un deal suyo eligiendo de la lista: asigna, no crea.
- Los abonos se cuelgan de una línea; el abono adicional del ADR 0113 se migra a la línea de su SKU.

**Por qué líneas y no deals (argumento):** varios deals abiertos por lead romperían `deals_uno_abierto_por_lead_y_programa_idx`
y con él el emparejamiento de Calendly ("un solo deal abierto", ADR 0049), el Inbox y el motor de etapas: el deal es la
relación comercial y su embudo (agenda, show, cierre); lo que se compra es otra cosa. HubSpot lo modela igual (*line
items* del deal). Una compra nueva meses después, con el deal anterior Completo, ya abre su propio deal hoy, así que la
historia de "qué compró esta persona" es la unión de las líneas de todos sus deals: la ficha del lead la muestra
cronológica (SKU, fecha, valor vendido, recaudado, por cobrar, closer).

## Alcance (cuando se desbloquee)

1. ADR nuevo (enmienda el 0113) con `/grill-with-docs`; migración la aplica la sesión principal con el ok de Mani.
2. Catálogo de productos y SKUs en Programa › Ventas (solo administradores), con el nombre armado.
3. Agregar una línea desde la ficha del deal (closer dueño), con su abono.
4. Ficha del lead: "Compras" con todas las líneas de todos sus deals.
5. Hub: filtro **Producto** al lado de Cohorte (368); Vendido, Recaudado y Por cobrar por SKU (369); "Aparte del programa"
   desaparece porque el 1:1 ya es la venta de su SKU. Cupos de la meta = líneas del producto de la meta (decide Gerencia:
   ¿un 1:1 ocupa cupo? propuesta: no, la meta es del programa virtual).
6. Las preguntas abiertas del ADR 0113 (¿el 1:1 paga comisión?, ¿cuenta para la meta?) se cierran aquí.

## Done cuando

- [ ] El ADR escrito.
- [ ] Test: una persona con Programa virtual C3 y 1:1 C3 muestra dos compras en su ficha y cuenta en el Hub por SKU.
- [ ] Test: un closer no puede crear un SKU (403 forjado, la base no se mueve); sí puede asignarlo a un deal suyo.
- [ ] Test de paridad: los abonos adicionales migrados dan la misma caja antes y después.
