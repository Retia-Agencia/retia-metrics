# 0089: El CRM calcula el semáforo de pauta y Juanito lo manda

- **Estado:** aceptado, 14-oct-2026 (Mani, audit del Hub, `docs/hub.md` H-6). Se construye en los tickets 245,
  258, 259 y 260.
- **Enmienda:** la restricción de `AGENTS.md` "nada de la app es público; única excepción `/api/health`": se
  agrega **una segunda excepción nombrada**, el endpoint de máquina del semáforo. El handoff de Meta del 13-oct
  (el semáforo como job aparte en Vercel con el token en variables).
- **Confirma:** ADR 0024 (una cifra, una definición), ADR 0088 (el costo por agenda usa las agendas del CRM), ADR
  0062 punto 4 (el token de Meta vive en la base), la regla de secretos (el secreto compartido vive en Vercel y en
  el `.env` de Juanito, nunca en el repo).

## Contexto

30X tiene un semáforo de costo por agenda en Slack: conteo de colores en el título, el umbral al lado del número,
la trayectoria del día, la comparación contra ayer a la misma hora, el detalle por campaña con un accionable y un
resumen a las 18 h (`semaforo-30x-analisis` en el vault). Retia lo quiere por WhatsApp.

Mani, 14-oct: usar **Juanito**, el bot de los pushes antes de la llamada. Vive en un VPS, habla por WhatsApp con
Baileys, ya tiene crons y una cola anti-ban, y ya sirve a los programas de Retia. Vercel está en plan Hobby: su
cron corre una vez al día, y el semáforo necesita varias lecturas en horario hábil.

## Decisión

1. **El semáforo se calcula en el CRM, con el diccionario de métricas** (`docs/hub.md` §5): por programa y por
   campaña, el costo por agenda oficial contra el objetivo de la cohorte (meta y aceptable, 122). Juanito no lee
   Meta ni la base.
2. **Un endpoint de máquina** (lo define el 259) es la segunda excepción a "nada es público":
   - se autentica con un secreto compartido en una cabecera, comparado en tiempo constante; sin secreto, 401 y no
     dice nada más;
   - **devuelve solo agregados**: programa, campaña, color, gasto, agendas, costo, umbral, comparación contra ayer a
     la misma hora, días seguidos en rojo y la nota de calidad del dato. **Ningún nombre, correo ni teléfono**;
   - antes de responder, sincroniza el día en curso de Meta si la última sincronización tiene más de unos minutos, y
     guarda una foto del gasto (245).
3. **Juanito es el reloj y el mensajero.** Su cron llama al endpoint en horario hábil y al cierre, arma el mensaje
   con el formato de 30X y lo manda por su cola anti-ban al destino que se configure. El código de esa parte vive en
   el repo de Juanito (260).
4. **El cron diario de Vercel cierra el día** (re-lee los últimos siete días, porque Meta ajusta hacia atrás). Si
   Juanito cae, el Hub sigue mostrando el semáforo con la última foto y dice cuánto tiene.
5. **Durante el día no se usa el umbral de cierre:** se compara contra ayer a la misma hora, porque las agendas
   entran tarde (el mismo día de 30X se leyó 5,5 veces peor a media jornada que al cierre). El color de cierre sale
   a las 18 h.
6. **El mensaje dice cuándo sus números mienten:** una sincronización que falló, una cuenta sin datos o un gasto
   parcial se escriben en el mensaje, y una corrida sin errores también lo dice.

## Consecuencias

- Riesgo aceptado: Baileys no es la API oficial y el número de Juanito puede ser bloqueado. El Hub es la fuente; el
  WhatsApp es un aviso.
- Juanito es un repo de 30X que ya maneja programas de Retia; el semáforo agrega datos de pauta agregados, no datos
  de personas.
- El destino, los horarios, los umbrales y el dueño de cada rojo son datos (`plan.md` §7 E, HQ-1 a HQ-3).

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Juanito lee el Graph API directo | el costo saldría con las agendas de Meta (contradice el ADR 0088), habría dos definiciones del mismo número y una segunda copia del token en el VPS |
| Intradía desde Meta en Juanito y cierre desde el CRM | dos números durante el día para la misma pregunta |
| WhatsApp 1:1 por Kapso con plantilla | pide una plantilla aprobada por Meta y no deja escribir en un grupo que ya existe; Juanito ya está en los grupos |
| Pasar Vercel a Pro para tener crons cada hora | es la decisión R3, abierta; Juanito ya corre crons y no cuesta más |

---

## Enmienda 15-oct-2026 (Mani): el reporte se configura en el CRM, por programa

Cambian los puntos 3 y el cierre de "Consecuencias" ("el destino, los horarios... son datos" seguía siendo cierto,
pero dejaba el destino y los horarios en el `.env` de Juanito). Ahora:

1. **El reporte por WhatsApp es configuración del programa, en el CRM** (ticket 265): encendido o apagado, el grupo
   de destino, los horarios y **qué métricas incluye**, cada una con su interruptor. Una métrica solo se puede
   encender si tiene semáforo implementado y umbral cargado en la cohorte activa (122, 264). El programa sigue siendo
   frontera: un reporte es de un programa y nunca mezcla dos.
2. **Juanito queda sin estado de negocio.** Su cron llama al endpoint en cada hora hábil y pregunta *"¿qué mando
   ahora?"*; el CRM responde la lista de envíos que tocan en ese momento, cada uno con su destino y su contenido ya
   calculado. Juanito arma el texto con el formato de 30X y lo pone en su cola anti-ban. En su `.env` quedan solo la
   URL del endpoint y el secreto.
3. **Por qué:** un programa nuevo, un horario distinto o una métrica más se cambian desde el CRM sin tocar ni
   desplegar Juanito (contrato C-1, `docs/hub.md` §8: lo de hoy son datos). Una métrica nueva es una fila de
   configuración y un interruptor, no una variable en un VPS.
4. **Costo aceptado:** el endpoint (259) decide además qué toca a qué hora; la regla de horario vive en un módulo
   puro con tests. Y como Juanito ya no sabe solo a quién escribir, **guarda la última configuración buena** (destinos
   y horarios) que le devolvió el endpoint: si el CRM no responde en un horario que tocaba, avisa a esos destinos que
   no hay datos, en vez de callarse.
5. **Lo que sigue igual:** el CRM calcula, Juanito no lee Meta ni la base, el endpoint devuelve solo agregados y se
   autentica con un secreto en tiempo constante, y durante el día se compara contra ayer a la misma hora.

Las decisiones abiertas HQ-2 y HQ-3 (`docs/plan.md` §7) dejan de ser configuración de Juanito: se responden llenando
esa pantalla.
