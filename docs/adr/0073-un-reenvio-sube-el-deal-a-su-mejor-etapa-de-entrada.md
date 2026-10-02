# 0073 — Un reenvío sube el deal a la etapa de entrada de su mejor envío, y el CRM avisa los envíos repetidos

- **Estado:** aceptado · 2-oct-2026 (Mani, en la revisión del checkpoint `cp-20261002-2`). Se construye en el
  [151](../tasks/151-el-reenvio-sube-la-etapa-de-entrada.md).
- **Enmienda:** ADR 0069 (la tabla de entrada gana la fila del parcial Low, y deja de valer solo al nacer el deal) y
  ADR 0037 en un punto: un reenvío **sí** cambia la etapa de un deal abierto, solo en las tres flechas de abajo.
  **Confirma:** ADR 0035 (la identidad del lead: el correo manda, el teléfono une y marca, nada se fusiona solo) y
  ADR 0071 punto 1 (Potencial y Registrado quieren decir "nadie lo ha tomado").
- **Fuentes:** 117, notas de Alejo del 2-oct (parcial Low y parcial que después manda su completa High);
  [`manual-gestion-comercial.md`](../manual-gestion-comercial.md) §3.1.

## Contexto

El ADR 0069 decide la etapa en que **nace** un deal por agenda, calidad y si el envío es parcial. Pero una persona
manda varias veces el formulario: el parcial que se guarda pregunta a pregunta, su completa, o un formulario entero
otra vez días después. Con el deal ya abierto, la regla no lo tocaba (ADR 0037: un reenvío avisa y no mueve). El
resultado: un lead que empezó el formulario (Potencial) y lo terminó con calidad High se quedaba en Potencial, abajo
en la cola, aunque es el lead que hay que llamar primero. Y el closer no tenía forma de ver, desde el deal, que esa
persona había aplicado más de una vez.

## Decisión

1. **La tabla de entrada del ADR 0069 vale para cada envío, no solo para el primero.** Con la fila que faltaba:

   | Formulario | Calidad | Agendó | Etapa de entrada |
   |---|---|---|---|
   | cualquiera | cualquiera | sí | Agendado |
   | parcial o completo | High | no | Calificado |
   | completo | Low, Mid o sin calidad | no | Registrado |
   | parcial | Low, Mid o sin calidad | no | **Potencial** (el parcial Low es nuevo: Registrado es "terminó el formulario") |

2. **Un envío sobre un deal abierto que sigue en una puerta lo sube a la etapa de entrada de ese envío**, solo hacia
   arriba y solo por tres flechas del sistema:

   | Id | De → a | Cuándo |
   |---|---|---|
   | S1 | Potencial → Registrado | llega el completo, sin calidad alta y sin agenda |
   | S2 | Potencial → Calificado | llega un envío con calidad High, sin agenda |
   | S3 | Registrado → Calificado | llega un envío con calidad High, sin agenda |

   - **Nunca baja:** un Calificado que reenvía con calidad Low sigue en Calificado. No hay flecha de bajada.
   - **Solo puertas:** si el deal ya está En gestión o más adelante, alguien lo está trabajando y el reenvío no lo mueve
     (se guarda y se ve, punto 3). La agenda sigue su regla de siempre (`unaCitaMueveAAgendado`).
   - **Las toma solo el sistema**, con la nota "Sistema" en el log del deal que dice qué envío lo subió (la regla del
     2-oct: lo que el sistema decide solo, lo explica en el log).

3. **Todos los envíos de un lead quedan visibles y asociados, y el CRM avisa cuando hay más de uno.**
   - **El parcial y su completo son el mismo envío** (Mani, 2-oct). Mientras la persona avanza, el parcial se va
     actualizando en su fila; cuando termina, el completo llega con el mismo token. Se guardan como dos filas hermanas
     (ADR 0036 punto 4: el parcial es el dato de abandono que mide el embudo, 126), pero **se muestran y se cuentan como
     uno**: en la ficha del lead el completo absorbe a su parcial ("empezó como parcial el …") y el parcial solo se ve
     solo si nunca se completó. Un envío nuevo es otro token: la persona volvió a llenar el formulario.
   - Cada envío nuevo se guarda completo y se cuelga del lead que ya tenía ese contacto (ADR 0035); ninguno se reemplaza
     ni se fusiona. La ficha del lead (073) los muestra todos, con lo que cambió entre uno y otro.
   - Cuando el lead tiene **dos o más envíos** (`leads.num_aplicaciones`: un parcial y su completo cuentan como uno),
     la tarjeta del Kanban y la ficha del deal lo muestran ("3 envíos") con enlace a la ficha del lead.

## Lo que no cambia

- Un reenvío **no abre un segundo deal** sobre uno abierto (índice único del ADR 0037) ni **reabre** uno cerrado.
- La identidad (ADR 0035): mismo correo en el programa = mismo lead; mismo teléfono con otro correo = se une **marcado**
  y un gerente confirma o separa; el mismo correo en otro programa es otro lead (frontera, ADR 0043).
- El mismo envío que llega dos veces (reintento del webhook) se actualiza, no se duplica (`(fuente, token, parcial)`).

## Consecuencias

- El motor gana S1, S2 y S3 (`lib/deals/etapas.ts`); `structure.md` §3.1 y el manual §3.1 las listan.
- Una métrica que cuente "cuántos nacieron en Potencial" debe leer la PRIMERA fila del historial, no la etapa actual:
  un Potencial que subió a Calificado nació en Potencial.
