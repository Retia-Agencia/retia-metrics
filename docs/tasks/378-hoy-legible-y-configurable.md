---
id: 378
etapa: hub
serves: "Recorrido de Mani por Hub › Hoy en Comunícate con Confianza (4-nov) · ADR 0115 (N1, N3, N4, N5) · ADR 0077 · docs/structure.md §9 (Tinta)"
depends: [373]
status: todo
---

# 378 — Hub › Hoy legible y configurable

## Por qué

Mani, 4-nov, en Hub › Hoy de Comunícate con Confianza:

1. La pantalla satura: todo pesa igual, todo es tabla y texto, no hay jerarquía ni nada visual.
2. "¿De dónde sale esa Meta de 548 leads?". Medido el 4-nov contra producción (`leerProyeccion`, solo lectura):
   C1 tiene meta de 50 cupos, 6 vendidos, cierre de ventas el 6-nov. Faltan 44 en 3 hábiles (hoy incluido) = 14,7
   ventas/día; ÷ 19,4 % de cierre ÷ 45,6 % de show (C1 en curso, madurando, 39 citas pendientes) = 166 agendas/día;
   ÷ 30,3 % de agenda por lead (ventana de 10 hábiles) = **548,5 leads/día**. No es una meta: es lo que haría
   falta para llegar, y la pantalla lo llama "Meta" sin decir de dónde sale.
   Y hay **dos definiciones** de la meta de leads (viola N1): la fila Leads de "1. El día" usa
   `proyeccion.leadsRequeridosDia` (`components/dashboard/reporte-diario.tsx`, `ElDia`), y la de "3. La semana"
   usa `cohorts.meta_leads_dia` (`LaSemana`), que en C1 está vacía.
3. Cada cita de "La agenda de hoy" debe abrir su llamada.
4. En el selector de día, el botón "Ver" no aporta y el campo de fecha estorba siempre visible.

## Decisiones (Mani, 4-nov)

- **D1. Meta y requerido son dos cosas.** "Meta de leads" = `cohorts.meta_leads_dia` (la pone alguien, editable),
  en el día **y** en la semana. Aparte, **"Necesarios para llegar"** = `leadsRequeridosDia`, siempre con su cadena
  visible: ventas por día ÷ % cierre ÷ % show ÷ % agenda por lead, cada tasa con de dónde sale (cohorte, muestra,
  "madurando"). Sin meta configurada, la columna Meta dice "—" y ofrece configurarla (N5: — no se puede calcular).
- **D2. Un botón "Configuración" en Hoy abre un panel que edita los supuestos ahí mismo.** El dato sigue viviendo en
  su objeto (ADR 0077: cohorte o programa); el panel es otra puerta que guarda por las mismas funciones de
  `lib/catalogo/` (molde, zod, `change_log`). Solo quien `esAdministrador` lo ve y lo usa; el permiso se valida en
  la server action, no solo escondiendo el botón.

## Alcance

1. **Panel de configuración** (`Dialog` de `components/ui/dialog.tsx` o un panel lateral sobre él; nada nuevo
   instalado). Cada supuesto con su valor actual, de dónde sale en una línea, y su campo:
   - Meta de cupos de la cohorte activa (`cohorts.meta_cupos`) → `editarCohorte`.
   - Fecha de cierre de ventas de la cohorte activa → `editarCohorte`.
   - Meta de leads por día de la cohorte (`cohorts.meta_leads_dia`) → `editarCohorte`.
   - Objetivo de conversión agenda → venta (`objetivos`, métrica `conversion_agenda_venta`, sin área) →
     `crearObjetivo` / `editarObjetivo` / `borrarObjetivo`. Vacío = se usan las tasas medidas.
   - Muestra mínima para medir conversión (`programs.muestra_minima_conversion`) → `editarPrograma`.
   - Ventana del ritmo (5, 10, 20 hábiles): es de URL (`?ritmo=`), no se guarda; el panel la cambia por URL y lo dice.
   Server actions nuevas validan con zod, exigen `esAdministrador` y el programa visible (`lib/auth/alcance.ts`), y
   llaman `router.refresh()` en el cliente al guardar (convención de `revalidatePath`).
2. **D1 en el código.** Una sola función decide "la meta de leads del día" (la usa El día y La semana); "Necesarios
   para llegar" con su cadena desplegable (por ejemplo `<details>` o popover) que muestra los cuatro factores con su
   origen. Si una tasa está madurando o tiene pendientes, se dice. Actualizar la fila de `docs/metricas.md` y el
   vocabulario de `docs/overview.md` §11 en el mismo commit (N8).
3. **Jerarquía visual de Hoy** (Tinta, `docs/structure.md` §9, sin colores, sombras ni radios a mano):
   - Arriba, una fila de 3 o 4 cifras grandes con barra de avance contra su meta: Cupos del día, Leads del día,
     Caja del día, % show. Lo demás baja de peso.
   - El embudo del día como diagrama horizontal (leads → agendas → realizadas → ventas) con el % entre pasos,
     dibujado con los tokens de Tinta (sin echarts si son barras simples; si es gráfica, por `components/graficas/`).
   - Las "Fuente:" de cada sección dejan de ser párrafos: van a un "¿De dónde sale?" plegado.
   - Secciones de detalle (Qué pasó con cada agenda, detalle de caja, reparto semanal) plegadas por defecto en
     pantalla y **abiertas en el PDF** (`print:`), para no romper el 373.
   - Nada de cifras nuevas: toda cifra sale de lo que ya calcula `armarReporteDiario` / `leerProyeccion`.
4. **La agenda de hoy abre la llamada.** Cada fila es un enlace a la ficha del deal (`/p/[programa]/deals/[id]`,
   `fila.dealId`); sin `dealId`, la fila no es enlace. Mostrar también el nombre de la persona si `veEquipo`.
5. **Selector de día:** dos botones, **Hoy** y **Seleccionar fecha**. El segundo abre un popover con el
   calendario (`input type=date`) y navega al elegir, sin botón "Ver". "Ayer" queda como atajo dentro del popover.
   Sigue siendo un GET con `?fecha=` (se puede compartir el enlace).

## Fuera de alcance

Cambiar fórmulas de la proyección, el PDF más allá de que siga imprimiendo todo, otras pestañas del Hub.

## Done cuando

- [ ] El panel edita los seis supuestos, cada guardado deja `change_log`, y una petición forjada sin
      `esAdministrador` responde 403 sin mover la base (tests de las server actions).
- [ ] Meta de leads en día y semana sale de una sola función; "Necesarios para llegar" muestra su cadena; tests de
      la función con meta vacía y con meta puesta.
- [ ] La agenda abre el deal; el selector es Hoy · Seleccionar fecha sin "Ver".
- [ ] `npm run typecheck`, `npm run lint`, los tests del cambio y `npm run build` limpios.
- [ ] Recorrido en `dev:local`: Hoy en escritorio y celular, clic en todo lo que abre, consola limpia, PDF completo.
- [ ] `docs/metricas.md` y `docs/overview.md` §11 al día.
