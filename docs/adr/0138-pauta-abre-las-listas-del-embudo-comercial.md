# 0138 — Pauta abre las listas del embudo comercial, con proyección de persona

- **Estado:** aceptada · 20-nov-2026 (Mani, decisión B del ticket 458). Nace del audio de Dani Rodríguez (Paid Media)
  del 11-nov: ver el embudo de los leads de pauta y dónde se pierden.
- **Enmienda:** ADR 0052 (el cuarto rol, paid trafficker): el paid trafficker ya veía las cifras de «¿Dónde se pierden?»
  pero no sus listas; desde aquí las cuatro listas del embudo comercial abren con la capacidad del tablero.
- **Confirma:** ADR 0025 (las preguntas de rol viven en un solo lugar: nunca `rol === "..."`), ADR 0048 (alcance por
  membresía), ADR 0067 (la lista detrás de cada cifra).

## Contexto

Dani Rodríguez, de pauta, necesita ver quién se pierde en el embudo de los leads que trae: no basta la cifra de
«Agendaron» o «Compraron», hace falta abrir la lista de personas detrás de cada paso para cruzarla con la campaña. Hoy
no puede: la pantalla del Hub le quita todas las listas del Dashboard (`proyectarDashboardSegunRol` → `sinListas`, ADR
0052) y la página de la lista solo abre el embudo comercial para quien administra (`capacidadParaMetrica` →
`esAdministrador`). El paid trafficker ya ve el tablero y las cifras; lo que falta es la evidencia de esas cuatro cifras.

## Decisión

1. **Las cuatro listas `embudo_comercial_*` abren con la capacidad del tablero.** `capacidadParaMetrica` devuelve
   `veTableroDelPrograma` para `embudo_comercial_creados`, `_agendaron`, `_shows` y `_compraron`, igual que ya lo hace
   para Pauta y Origen. La capacidad se pregunta por función (ADR 0025), nunca comparando el rol.
2. **La lista se proyecta con la proyección de pauta existente.** `proyectarListaSegunRol` usa `proyectarParaPauta` para
   esas cuatro métricas: conserva persona y etapa y anula closer, clave de closer, deal, monto, recaudado, por cobrar y
   última actividad para quien no cumple `veEquipoComercial`. Quien ve el equipo comercial (gerente, developer) conserva
   la vista comercial completa. Es la misma proyección de la enmienda del 29-oct del ADR 0052.
3. **El Hub conserva solo los detalles del embudo comercial para quien ve el tablero.** `proyectarDashboardSegunRol`
   sigue quitando todas las listas a quien no ve el equipo comercial; la excepción, proyectada aparte en
   `lib/hub-programa/cargar-datos.ts`, son los `detalle` y `detallePerdidos` de los cuatro pasos del embudo: se
   conservan para quien cumple `veTableroDelPrograma`. La firma de `proyectarDashboardSegunRol` no cambia.
4. **Nada más de Comercial se abre a pauta.** La lista «+N sin llamada registrada» (ventas con monto) y el resto del
   bloque Comercial (comparativo entre closers, abiertos por owner, escalera sin filtro de origen) siguen cerrados a
   pauta: su reja no cambia.

## Consecuencias

- `tests/embudo-comercial-a-pauta.test.ts` muerde la capacidad y la proyección en los dos sentidos: pauta abre las
  cuatro listas y recibe persona sin closer, deal ni monto; gerente conserva la vista comercial; ventas sin llamada
  sigue cerrada.
- La página de la lista pinta el chip «Área: X» y, con el corte de pauta, el chip de campaña o anuncio (ticket 458).
- El embudo comercial gana un filtro más, el corte de pauta (campaña o anuncio), como ya tenía el área en la tanda 1.
  No es una métrica nueva.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| A: abrir solo las cifras del embudo, sin sus listas | Dani necesita las personas detrás de cada paso para cruzarlas con la campaña; la cifra sola no sirve |
| C: no dar enlace ni listas a pauta, dejarlo en Comercial | Pauta no entra a la pestaña Comercial con el foco en su embudo; el enlace y las listas lo acercan al trabajo diario |
