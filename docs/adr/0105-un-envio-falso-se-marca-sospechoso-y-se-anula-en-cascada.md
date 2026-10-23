# 0105: Un envío falso se marca Sospechoso y se anula en cascada; nada se borra ni se anula solo

- **Estado:** aceptado, 23-oct-2026 (Mani, grill del filtro de envíos falsos).
- **Confirma:** ADR 0026 (anular, nunca borrar lo que ya se usó), ADR 0038 (anulado es una marca ortogonal, no una
  etapa), ADR 0058 (un envío con firma buena nunca se pierde), ADR 0096 (cancelar en el CRM cancela en Calendly).
- **Amplía:** ADR 0026 y 0038: la vigencia pasa a cubrir también envíos y leads.

## Contexto

El 22-oct entró a Tactical un troll con una amenaza contra un niño: nombre "No te da pena estafar con tu hijo
presente", correo `tevoyamatar@`, teléfono `+57 312 345 6789`, y un segundo envío con otro correo y el mismo
teléfono. El dedup lo dejó en un lead con un deal **Agendado con su llamada**: ocupaba la agenda de un closer.

Medido en producción el 23-oct (envíos de los últimos 90 días, solo lectura): **unas 5 personas falsas externas en
2.564 envíos**. Hay que filtrar, pero el volumen no justifica decidir sin un humano.

- Teléfono con un tramo de 6 dígitos en secuencia o iguales: cazó 4 falsos y 2 personas reales. Con 7, cero
  falsos positivos en la muestra (sobreajuste posible: son 6 casos).
- Palabras ofensivas por regex: inservible ("trata" contiene "rata"; un lead real escribió "no más estafas").
- Varios correos en un mismo lead: no es señal, son personas reales.

## Decisión

1. **Sospechoso es una marca del deal, no una etapa ni un escondite.** La señal se calcula por envío y queda
   guardada en él; la marca la lleva el deal que ese envío abre o toca. El deal sigue en su etapa, en la lista del
   closer y en las métricas, con el aviso y sus razones. Esconderlo habría escondido 1 de cada 3 leads reales de la
   muestra hasta que alguien revisara.
2. **Juzgan las reglas y Haiku, y cualquiera de los dos marca (unión).** Las reglas corren siempre: teléfono con 7+
   dígitos en secuencia o iguales, teléfono colombiano imposible (57 + 10 dígitos que no empiezan por 3 ni por 6),
   correo de relleno (1 o 2 letras antes de la @, o un relleno conocido) y dominio desechable, y el lead que **ya se
   anuló por envío falso** en el programa (por correo o teléfono). Haiku recibe el envío completo (nombre, correo,
   teléfono, respuestas y lo que dijeron las reglas, sin ids, sin UTM y sin otros leads) y marca "lo que se ve raro"
   con sus razones, en salida estructurada. Si la API falla, las reglas siguen marcando y el envío queda **sin revisar
   por IA**, a la vista. Validar MX y si el número existe queda para después.
3. **Nada se anula solo en esta versión.** Un humano dice "Es real" o "Anular por envío falso", y cada decisión queda
   guardada al lado de lo que dijeron las reglas y Haiku. El anulado automático se decide con esa precisión medida,
   en otro ADR. La certeza que da un LLM no está calibrada y no se usa como umbral.
4. **Lo resuelve quien hoy puede anular el deal** (`puedeTrabajarDeal`: su dueño o quien administra). Los sospechosos
   caen además en una pestaña del Inbox.
5. **Anular por envío falso es una cascada, nunca un borrado.** En una transacción: anula el deal y sus llamadas (lo
   que ya hace `anularDeal`) y marca el envío como falso. Si todos los envíos del lead son falsos, el lead sale de
   Personas y de toda métrica de leads y envíos. Después de la transacción, la cita se cancela en Calendly, en el
   orden del ADR 0096. Todo queda con quién, cuándo y por qué, y se puede deshacer.
6. **El juicio corre después de guardar, fuera de `lib/ingesta/`.** La ingesta no cambia (ADR 0058, y el guardián que
   le prohíbe calificar). Al terminar, `after()` juzga ese envío **y cualquier otro que haya quedado sin veredicto
   o sin revisar por IA** (API caída, timeout). Sin cron (Mani, 23-oct): con ~28 envíos al día, el siguiente envío
   recoge lo pendiente. Un pendiente puede esperar un fin de semana sin envíos, y eso se acepta.

7. **Una cita suelta también se juzga** (Mani, 23-oct). La cita viva del troll no colgaba de ningún deal: era una
   llamada suelta de Calendly con su segundo correo (`voy_por_tuhijo.estafadorhp@`), y la del deal estaba cancelada.
   Juzgar solo envíos no la habría cazado. El juicio corre sobre dos entradas: el envío del formulario y la cita que
   llega suelta por el webhook de Calendly (nombre, correo, teléfono y respuestas del invitado, de `calls.raw`). Una
   suelta sospechosa cae en la misma pestaña del Inbox, y **anular por cita falsa** anula la llamada (que ya se anula,
   ADR 0026) y cancela la cita en Calendly. Una cita que cuelga de un deal no se juzga aparte: su envío ya se juzgó.

## Opciones descartadas

- **Borrar el envío, el lead y el deal.** Rompe el ADR 0026 y las FK `restrict`, no se puede deshacer si fue un lead
  real, y destruye la evidencia de una amenaza que puede terminar en una denuncia.
- **Anular solo el deal.** El lead y sus envíos seguirían inflando los leads por día y los envíos del Hub.
- **Esconder el deal sospechoso.** Con la precisión medida, un falso positivo con cita hoy se queda sin llamada.
- **Jev de TypeSafe en vez de Haiku (por ahora).** El costo no decide: con ~860 envíos al mes, Haiku cuesta unos
  USD 0,27 al mes y Jev unos USD 0,03 (estimado el 23-oct con el tamaño real de las respuestas). Jev promete certeza
  calibrada, que es lo que algún día habilitaría el anulado automático, pero su fuerte es el inglés y la propia doc
  marca el contenido adversarial como punto débil. Se arranca con Haiku y se compara después con los veredictos
  guardados.
- **LangGraph u otro servicio aparte.** Es una sola llamada al modelo; un segundo runtime no se gana su lugar aquí.

## Consecuencias

- **Envíos y leads entran a la vigencia** (`vigente`/`incluyendoAnulados` y su guardián). Es el costo grande: toda
  lectura de leads y envíos que alimente una métrica o una lista tiene que decidir. Omitir una no lanza ningún error,
  así que el guardián se extiende antes de escribir la cascada.
- Las pruebas internas en producción (ManuelTEST, PRUEBA CRM) también caen como Sospechoso. Es correcto: también
  ensucian las cifras.
- Un lead anulado que recibe un envío nuevo vuelve a contar (con rastro), y la regla del reincidente marca su deal
  nuevo como Sospechoso. El troll no desaparece para siempre: queda a un clic.
- Tickets: 301 a 307 (`docs/tasks/README.md` §16).
