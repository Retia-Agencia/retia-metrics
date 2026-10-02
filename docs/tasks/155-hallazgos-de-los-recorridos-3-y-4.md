---
id: 155
etapa: O2
serves: "docs/anotaciones.md A-20, A-21, A-22, A-24, A-25, A-26, A-27, A-28, A-29, A-31, A-32, A-33 · descarta A-23"
depends: [128, 153]
status: en curso
---

# 155 — Los hallazgos de UI de los recorridos 3 y 4 (153)

## Objetivo

Cerrar lo que salió de recorrer la lista de pruebas del 153 como closer y gerente (`docs/anotaciones.md`,
secciones "Recorrido 3" y "Recorrido 4", 2-oct). Son arreglos chicos de pantalla y de lectura; **ninguno
toca el esquema** (sin migración). No incluye A-19 (resuelta en el 153) ni A-30 (decisión de Mani para el 078).

## Decisiones (Mani, 2-oct)

- **A-22 y A-26:** se conserva la red de seguridad (llamadas viejas sin resultado siguen apareciendo), pero
  una llamada entra solo cuando su **hora** ya pasó, no su día. El título del Inbox pasa a "Llamadas que ya
  pasaron sin resultado" y la alerta de la ficha a "La llamada ya pasó y no tiene resultado."
- **A-23: descartada.** El link de Grain no dice cuándo fue la llamada; el CRM solo lo sabría por la cita, y
  Mani prefiere confiar en el closer antes que poner una reja.
- **A-25:** "Para avanzar" muestra solo flechas que un closer puede tomar (`quien` distinto de `sistema`).
- **A-33:** el motivo del cierre se muestra en la cabecera solo cuando el deal está en Cierre perdido. El dato
  no se borra; su historia queda en el Log de eventos.

Sin decisión pendiente (se argumenta aquí):

- **A-20:** el requisito `contacto` solo exige que exista un contacto registrado (`tieneContactoRegistrado`);
  la fecha la pone el sistema y el canal es opcional. Se corrige el **mensaje** para que diga lo que se exige,
  y el formulario dice por qué "Registrar" está deshabilitado. No se agrega un campo de fecha: nadie lo pidió.
- **A-21:** "¿este deal acepta un abono?" se responde en UN lugar de `lib/deals/` (la misma regla que hoy
  rechaza en `registrarAbono`: hay flecha de la etapa a Ganado Pago Parcial o Completo, o ya está en Parcial),
  y la ficha y el Inbox lo reciben por props. Se esconde el botón donde no aplica.
- **A-28:** un grupo de `change_log` es "creado" solo si es el **primero** de ese registro; llenar un campo
  vacío después (dueño, valor vendido, área) es "editado".

## Done cuando

- [ ] **A-20** El mensaje del requisito `contacto` ya no habla de fecha ni canal, y el formulario de
      actividades dice por qué "Registrar" está deshabilitado (la nota es obligatoria).
- [ ] **A-21** "Registrar abono" no aparece en la ficha ni en el Inbox para un deal cuya etapa no acepta abono;
      la regla vive en un solo módulo de `lib/deals/` y la usan la reja del servidor y las dos pantallas.
- [ ] **A-22 / A-26** La sección 1 del Inbox y la alerta roja de la ficha solo incluyen llamadas cuya cita ya
      pasó (instante, no día), con los textos nuevos. Test con una cita de hoy más tarde (no entra) y una de
      ayer (entra).
- [ ] **A-24** El mensaje de sobrepago usa `usd` de `lib/format.ts` (coma decimal).
- [ ] **A-25** "Otra ruta" no lista flechas del sistema. Test sobre Ganado Pago Parcial.
- [ ] **A-27** Un deal con una llamada atendida sin Grain (`esAtendidaSinGrain`) muestra la alerta roja en el
      bloque de Alertas. Test.
- [ ] **A-28** El Log de eventos titula "Deal editado" las ediciones que llenan un campo vacío; solo el primer
      grupo de un registro es "creado". Test.
- [ ] **A-29** Los toasts de anular abono dicen el nombre de pantalla de la etapa (`nombreDeEtapa`, por props).
- [ ] **A-31** "Fecha del envío" en el bloque Origen muestra `submissions.fecha_envio` (con respaldo a
      `created_at` si viene nula), igual que la ficha del lead.
- [ ] **A-32** Ubicado el componente que emite "Encountered a script tag while rendering React component"
      y corregido, o documentado por qué es del entorno.
- [ ] **A-33** La cabecera no muestra "Motivo del cierre" fuera de Cierre perdido.
- [ ] Typecheck, lint, los tests del cambio y `npm run build` (toca componentes cliente) en verde.
- [ ] Recorrido en `dev:local` de cada hallazgo, con la consola abierta.
- [ ] Cada A-NN marcada en `docs/anotaciones.md` (resuelta con fecha, A-23 descartada con su razón).

## Notas de cierre

(pendiente)
