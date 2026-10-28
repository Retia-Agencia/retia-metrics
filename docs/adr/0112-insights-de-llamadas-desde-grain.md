# 0112: Los insights de cada llamada salen del link público de Grain y media los ve sin identidad

- **Estado:** aceptado · 28-oct-2026 (Mani, grill del plan de media; `docs/media/propuesta.md` §3.2 a §3.4).
- **Confirma:** ADR 0066 (atendido sin Grain es una alarma), ADR 0004 (lo que llega se guarda como llegó), ADR 0067
  (toda cifra abre su lista), ADR 0109 (la escalera), ADR 0089 (el endpoint del semáforo).

## Contexto

Las closers ya pegan el link de Grain en la llamada (`calls.link_grain`). El 26-oct se verificó que la página pública
del link trae el transcript completo, con hablantes y tiempos, sin sesión. No es una API documentada: si Grain cambia
su página, se rompe sin aviso. Media debe recibir lo que se aprende de las llamadas, nunca el transcript.

## Decisión

1. **Un solo módulo conoce Grain** (`lib/grain/`): dado un link, devuelve el transcript o un error. Pagar Grain (plan
   B) cambia solo ese módulo.
2. **Se lee apenas se pega el link**, después de responder (sin bloquear la ficha), **y un cron diario reintenta**
   las llamadas con link y sin transcript. El transcript crudo se guarda en su propia tabla (`transcripciones`), como
   llegó. Una lectura fallida guarda el error y prende una alarma en la salud de fuentes. Media nunca lee esa tabla.
3. **Una extracción con IA por llamada, guardada** (`insights_llamada`): dolores, deseos y objeciones con su cita
   textual, nivel de conciencia, lo que el lead dice que vio y las objeciones que el contenido pudo resolver antes. Por
   AI Gateway, con un tope de gasto mensual configurable (el presupuesto lo fija gerencia, pregunta 8). **Esta es la
   base de extracción**: nadie vuelve a leer transcripts para pensar contenido.
4. **La ponderación por escalón se hace al leer**, con `escaleraDeDeals` (ADR 0109), no al extraer.
5. **Media ve la cita sin identidad:** nunca nombre, correo, teléfono, deal ni closer. La extracción tiene orden de
   quitar datos personales de la cita. La lista detrás de un insight existe (ADR 0067); para media muestra solo citas
   y escalón, para gerencia y developer también la llamada.
6. **Reporte semanal por programa** en la vista de media; Juanito avisa al grupo de media con el enlace, **sin citas**,
   por el endpoint con secreto del semáforo. Nada personal pasa por WhatsApp.
7. **El agente del cruce** (insights × formatos del banco × CTA) **lee solo `insights_llamada`**, nunca transcripts.
   Corre **solo** después del reporte semanal y **a demanda** de media (programa, creador, rango). Deja **propuestas
   sin fecha en el banco**, cada una con los insights de los que sale; media las califica con la escala que ya existe
   (fuego / dispendiosa / no sirve). Nunca crea piezas ni fechas. Es la frontera: lo comercial termina en el insight,
   lo de media empieza en el banco. Un creador sin programa no recibe propuestas.
8. **La frontera de programa rige todo:** los insights de un programa solo alimentan propuestas de creadores de ese
   programa.

## Por qué

Leer solo al pegar perdía los fallos sin reintento; solo por cron atrasaba un día lo que puede estar en minutos. Un
resumen semanal sin extracción por llamada no permitía abrir la lista detrás de cada insight ni ponderar por escalón,
y obligaba a releer todos los transcripts cada vez que media quiere guiones.

## Consecuencias

- Hoy un tercio de las llamadas atendidas no tiene Grain (54 de 82 con link en 60 días): la alarma del ADR 0066 tiene
  que estar a la vista de quien gestiona a las closers, o los insights salen sesgados.
- Guardar transcripts y citas de leads es dato sensible: los tests muerden que ninguna proyección de media devuelva
  un campo de identidad (molde del contrato del semáforo).
