# 0066 — Atendido sin Grain se acepta, cuenta como show y prende una alarma derivada

- **Estado:** aceptado · 1-oct-2026 (Mani, `/grill-with-docs` del lote 1). **Enmienda el ADR 0037** en el
  requisito de Grain para entrar a Atendido (T7, T10) y el ticket 058 (el Grain como única prueba).
- **Relacionadas:** ADR 0024 (lo que se puede calcular no se guarda), ADR 0015 (resultado de llamada),
  ADR 0056 (el motor decide quién mueve y con qué datos).
- **De dónde sale:** reunión con Gerencia del 30-sep (`docs/comercial.md` R-2, GC-20).

## Contexto

Hoy a Atendido solo se entra por un hecho del sistema: pegar el Grain (058), o marcar que la llamada
sucedió en el caso raro sin grabar. Gerencia: *"deja que sí lo muevan porque a veces necesitan mover de una
vez todo"*, pero con *"una alarma así re roja"* y un conteo de cuántos no tienen transcript.

## Decisión

1. **El closer puede mover un deal a Atendido sin Grain.** Mover a Atendido **es** decir que la llamada
   ocurrió: la llamada queda en `show`. Sigue pasando por `moverEtapa()` y pide una llamada vigente que
   marcar; sin llamada no hay nada que dé por atendido.
2. **Cuenta como show.** El % de show-up no esconde estas llamadas: el embudo y la etapa dicen lo mismo.
3. **La alarma es derivada, no guardada:** una llamada en un resultado que ocurrió (`show`, `compromiso_pago`,
   `cerrada`, `perdida`) sin `link_grain` es **"atendido sin Grain"**. Se apaga sola al pegar el Grain. No hay
   columna ni marca que pueda quedar vieja.
4. **Una sola regla, sin excepción por motivo.** El "sucedió sin grabar" que ya existe también prende la
   alarma: una excepción declarable sería un clic para apagar todas las alarmas y el conteo mentiría.
5. **Se ve en tres lugares:** roja en la tarjeta y la ficha del deal (alertas del 128), como cifra en el
   dashboard (*"N de M shows sin Grain, X%"*) y con su lista (ADR 0067). Al lado del show-up, nunca en vez de
   él.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Mantener el bloqueo | Gerencia lo pidió explícito: el closer necesita mover sin esperar el link |
| No contar el show hasta que llegue el Grain | Habría deals en Atendido que no cuentan como atendidos: dos cifras que no cuadran |
| Una marca guardada "sin Grain" | Envejece: alguien pega el Grain y la marca queda prendida |
| El "sucedió sin grabar" declarado apaga la alarma | Un clic apagaría el conteo que Gerencia quiere ver |
