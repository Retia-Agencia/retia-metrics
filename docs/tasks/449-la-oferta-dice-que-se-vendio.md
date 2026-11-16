---
id: 449
etapa: dinero
serves: "ADR 0133 punto 2 · D1, D3"
depends: [448]
status: todo
---

# 449 — La oferta de la compra dice programa, monto y moneda

## Qué
Traducir una compra de Hotmart a lo que el CRM necesita: programa, cohorte, monto y moneda del abono. Decidido (ADR
0133): el abono es lo que pagó el estudiante, en la moneda que reporta Hotmart (D3); el valor vendido es el ticket de la
cohorte con descuento 0 (D1): el CRM no deduce descuentos de la oferta. La oferta solo identifica el programa y la
plataforma; el descuento lo escribe gerencia después.

## Dónde mirar
`lib/catalogo/enlaces-pago.ts` (monto, moneda, url, plataforma; ya por molde) · `lib/catalogo/plataformas.ts`
(Hotmart ya existe en `plataformas_pago`) · `lib/deals/valor-vendido.ts` · ADR 0065.

## Cómo
1. El código de oferta (`purchase.offer.code`) se busca en el `off=` de la URL de los enlaces vigentes del programa.
   Hoy LiderArte no tiene ningún enlace cargado (medido el 16-nov): se cargan por la pantalla, no por script crudo.
2. Monto y moneda del abono: lo que pagó el comprador, sin convertir (AGENTS.md › moneda visible). Hotmart manda
   `price`, `full_price` y `original_offer_price`: cuál es "lo que pagó" se decide con el **primer evento real**
   (448), no con el ejemplo de la documentación. Mientras no llegue, el test usa el ejemplo y lo dice.
3. El precio del enlace no es el valor vendido (D1): no se escribe en el deal ni se calcula un descuento con él.
4. Oferta desconocida → la compra queda en revisión (448 la guardó), nunca se adivina el programa.

## Done cuando
- [ ] Tests con las tres ofertas de LiderArte (USD 99 desde P6, USD 99 desde P7, USD 49) y una oferta desconocida.
- [ ] Los enlaces de LiderArte están cargados en producción con su `off=`.
