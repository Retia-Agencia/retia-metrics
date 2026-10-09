---
id: 208
etapa: corte
serves: "reunión del 8-oct (Mani, Michael, Jero): migrar C3 de ComunicArte y Tactical; enmienda el 203"
depends: [203]
status: done
---

# 208 — Migrar el corte 3: agendados con Calendly y Estudiantes Noviembre

## Por qué existe

El corte en cero (203, 7-oct) borró todo lo de ComunicArte y Tactical, también lo que había entrado por el
webhook desde el 28-sep. La mañana del 8-oct se recuperaron las 42 personas con cita viva. En la reunión del
8-oct (Mani, Michael, Jero) se decidió migrar **todo el corte 3** de los dos programas, que empieza el
**28-sep**, y solo dos cosas:

- los leads que **agendaron** (el envío del formulario trae link de Calendly; es lo mismo que "tener agenda");
- los **estudiantes de noviembre** (`Estudiantes Noviembre` en ComunicArte, `Noviembre Estudiantes Cohort`
  en Tactical).

**No se migra** el seteo no calificado ni nada antes del 28-sep. Lo anterior al 7-oct sin agenda lo lleva
Jero en la hoja; de ahí en adelante, el CRM.

## Barrido (8-oct, solo lectura: hojas, base, Calendly y el respaldo del 7-oct)

| | ComunicArte | Tactical |
|---|---|---|
| Agendados C3 en la hoja (desde el 28-sep) | 120 | 131 |
| Ya en el CRM (recuperados o entrados después del corte) | 22 | 36 |
| **Faltan** | **98** | **95** |
| … con cita pasada activa | 88 | 88 |
| … que cancelaron y no tienen otra cita | 10 | 7 |
| … con cita futura activa | 0 | 0 |
| … sin sobre en el respaldo (28-sep, antes del webhook) | 5 | 9 |
| **Estudiantes Noviembre** | **17** | **9** |
| … que además agendaron en C3 | 6 | 0 |
| … sin ningún envío de formulario | 4 | 8 |

- El `Registro de llamadas` de las hojas llega solo hasta el 3-oct: no sirve como fuente de resultados.
- En `Estudiantes Noviembre` de ComunicArte hay 14 filas arriba y 3 más en el bloque "LANZAMIENTO" (filas
  58 a 60). Mani confirmó que son de C3.
- Los cuerpos de Typeform rearmados desde la API salen **idénticos** a los sobres originales (10 de 10,
  comparando la `EntradaEnvio` que produce el adaptador).

## Decisiones (Mani, 8-oct)

1. Las llamadas pasadas quedan en **Agendado**; las closers registran el resultado.
2. **Un solo deal por persona.** El estudiante que también agendó no recibe un deal de Agendado aparte: su
   lead entra por su envío sin regla de deals y el importador le abre el deal histórico de estudiante.
3. El estudiante que nunca llenó el formulario entra por **alta manual** (`crearPersonaManual`).
4. Las ventas de **Juanjo y Alejo** (no son usuarios del CRM) quedan **sin dueño**; el nombre queda en el
   abono, como lo escribió la hoja.
5. **Tactical C3 inicia ventas el 28-sep** (antes decía 5-oct).
6. El bloque LANZAMIENTO de ComunicArte es de C3 y se migra.

## Cómo entra cada cosa (todo por las puertas de la app, ADR 0029)

1. **Cohorte:** `editarCohorte` (Tactical C3, inicio de ventas al 28-sep).
2. **Agendados:** por persona, sus sobres del respaldo (`sobres_crudos`, formulario y Calendly) en orden de
   llegada: `procesarSobre` para el formulario (resuelve la cita en Calendly hoy) y `aplicarEventoDeCalendly`
   para los eventos. Los 14 sin sobre se rearman desde la API de Typeform (`included_response_ids`). El deal
   queda en Agendado con la host de dueña; quien canceló sin volver a agendar queda sin dueño en el Inbox.
3. **Estudiantes:** el lead por su envío (respaldo, o API de Typeform buscando el correo) con
   `aplicarReglaDeDeals: false`, o por alta manual; el deal en Abonado o Completo con su abono por
   `extraerEstudiantes` + `importarGestion` (cohorte C3, `onboardedDesdeMail`). Las filas sin correo no se
   leen.

El script es desechable (`scripts/_migrar-c3.ts`): ensayo por defecto (cada bloque en una transacción que se
deshace) y `--aplicar` con el ok de Mani. Se borra al terminar.

## Done cuando

- [x] Ensayo revisado por Mani.
- [x] Aplicado con su ok; los conteos del CRM cuadran con la tabla de arriba.
- [x] Recorrido en producción: Deals de cada programa, Students con su cohorte, Inbox (Mani, 9-oct).

## Resultado (aplicado el 8-oct en la noche, con el ok de Mani)

**Corrección al barrido:** en `Noviembre Estudiantes Cohort` (Tactical), 8 de 9 filas traen el correo bajo
"Whatssapp" (con doble s) y el teléfono bajo "Correo". `correoDeLaFila` ya lee columnas cruzadas, pero
busca el encabezado "WhatsApp": la corrida lo renombró. Sin eso, 8 estudiantes se habrían perdido como "sin
correo". Con el correo bien leído, 6 estudiantes de Tactical también estaban entre los agendados C3 y solo 1
nunca llenó el formulario.

| | ComunicArte | Tactical |
|---|---|---|
| Agendados migrados (personas) | 91 | 89 |
| … Agendado con su llamada y la host de dueña | 82 | 82 |
| … Agendado con Pendiente reagenda (cancelaron) | 7 | 5 |
| … Calificado sin dueño, al Inbox | 2 | 2 |
| Envío de prueba de Typeform, no entra | 1 | 0 |
| Estudiantes (deal en Abonado/Completo + abono) | 17 | 9 |
| … lead por sobre del respaldo / API / alta manual | 7 / 6 / 4 | 6 / 2 / 1 |
| … sin dueño (Juanjo, Alejo) | 3 | 0 |
| … onboarded (Mail onboarding = Sí) | 0 | 8 |
| Caja migrada | USD 9.459,00 | USD 8.975,00 |

- Tactical C3 inicia ventas el 28-sep (`editarCohorte`, con rastro).
- La venta sin fecha (fila 5 de Tactical) quedó con fecha 8-oct (decisión de Mani), no con el cierre de
  ventas: un abono con fecha futura no cuadra en los periodos del Dashboard.
- Rareza: un abono de ComunicArte con plataforma "hotmart / mercadopago" quedó sin plataforma.
- Cinco abonos de ComunicArte tienen fecha anterior al 28-sep (16 a 24-sep): ventas de C3 hechas antes de
  abrir la ventana (bloque LANZAMIENTO y dos filas del bloque principal). Cuentan en la caja de septiembre.
- Un evento de Calendly del respaldo era de una cita que el CRM no conoce: no cambia nada.
- El script (`scripts/_migrar-c3.ts`) se borró después de correr, como pide la convención.
