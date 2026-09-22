---
type: note
owner: "[[retia]]"
updated: 2026-09-21
tags: [crm, retia, explicacion, reunion, alejo, deals, etapas]
---

> Copia cruda del second brain de Mani (`mani_vault/02 Projects/retia/notebook/crm-explicado-simple.md`),
> sin editar. Los `[[wikilinks]]` no resuelven aquí. Es la versión no técnica del diseño, escrita
> para explicarlo en una reunión sin abrir código; la versión técnica es `crm-retia-modelo-hubspot-scaffold.md`
> en esta misma carpeta.

# El CRM de Retia, explicado simple

**Para qué es esta nota.** Para poder explicar el CRM en una reunión sin abrir código ni
documentación técnica. Escrita el 2026-09-21, antes de la reunión con [[Alejo Carvajal]].

La versión técnica completa vive en el repo `retia-metrics-mani`: `docs/plan-crm-v2.md` (el orden
de construcción), `docs/adr/` (42 decisiones argumentadas) y `docs/spec.md` (el alcance). El diseño
del que salió todo está en [[crm-retia-modelo-hubspot-scaffold]].

---

## 1. Qué es, en una frase

**Es el lugar donde vive la operación comercial de Retia: los leads, las llamadas, las ventas y la
plata cobrada, con las métricas calculándose solas encima.**

Reemplaza tres cosas que hoy conviven mal: las Google Sheets, el grupo de WhatsApp donde se mandan
los comprobantes, y el PDF que Michael arma a mano todos los días.

## 2. Por qué existe

Hoy nadie puede responder sin trabajo manual la pregunta más cara de la empresa, la de
[[Daniel Tovar]]: *"no sé si estoy perdiendo plata o no con la pauta"*.

El motivo es que la cadena está cortada en tres puntos ([[mapa-retia]]):

1. **El UTM entra con el lead y no llega a la venta.** Sin eso no hay atribución por canal ni por
   creativo.
2. **El comprobante de pago nace en un chat de WhatsApp** y alguien lo transcribe a mano.
3. **El ROAS se calculaba y se dejó de calcular.**

El CRM cierra los tres, porque el dato deja de saltar entre herramientas: entra una vez y se queda.

## 3. Las tres piezas del modelo

Es el mismo modelo que usa HubSpot, adaptado. Tres palabras y ya está todo:

| Pieza | Qué es | Ejemplo |
|---|---|---|
| **Lead** | La persona. Una sola, aunque aplique cinco veces | María, `maria@x.com` |
| **Envío** | Cada vez que esa persona llena un formulario | María aplicó el 3-sep y otra vez el 12-sep |
| **Deal** | La oportunidad de venderle **un programa** | "Venderle ComunicArte a María" |

**Por qué importa la diferencia.** Hoy en las hojas una persona que aplica tres veces son tres
filas, y las tasas salen infladas. En el CRM son **un Lead con tres Envíos**. Y si María compró
ComunicArte y el año que viene se interesa en Tactical, son **dos Deals**, no una fila sobrescrita.

Colgando del Deal va todo lo demás: las llamadas, los abonos, las cuotas pactadas y el historial.

## 4. Las diez etapas

Un Deal siempre está en una de diez etapas. Esto es el tablero que el equipo va a ver:

| # | Etapa | Entra cuando | Quién lo mueve |
|---|---|---|---|
| 1 | **Pendiente Setteo** | el lead califica y nadie lo ha llamado | el sistema |
| 2 | **En Contacto** | el closer registra el primer contacto | el closer |
| 3 | **Pendiente Re-agenda** | la llamada quedó en no-show o cancelada | el sistema |
| 4 | **Agendado** | agendó por Calendly, o el closer le pone fecha | el sistema / el closer |
| 5 | **Atendido** | la llamada tiene link de Grain | el sistema |
| 6 | **Compromiso Verbal** | dijo que sí, con producto y fecha prometida | el closer |
| 7 | **Abonado** | entró el primer pago y queda saldo | el sistema |
| 8 | **Completo** | el saldo quedó en cero | el sistema |
| 9 | **Próxima Cohorte** | no es para esta cohorte, sí para la siguiente | el closer |
| 10 | **Cierre Perdido** | dijo que no. Motivo obligatorio | el closer |

🔑 **La mitad de los movimientos los hace el sistema, no una persona.** Pegar el link de Grain
mueve el deal a Atendido. Registrar un abono lo mueve a Abonado. Que el saldo llegue a cero lo
mueve a Completo. Eso es lo que hace que las columnas amarillas del reporte dejen de llenarse a
mano: no es que alguien las llene más rápido, es que **nadie las llena**.

🔑 **Un solo lugar decide si un deal puede moverse.** No es un detalle técnico: es la garantía de
que el embudo del dashboard, la pantalla del closer y el reporte del gerente digan siempre el mismo
número. En este proyecto ya pasó dos veces que la misma cifra se escribiera en dos sitios y
divergiera en silencio, y por eso ahora la respuesta vive en un módulo y todos lo importan.

## 5. Qué hace cada rol

Hay tres roles y **no hay herencia**: un closer no es "un gerente con menos permisos".

### Closer (Andrea, Maru, Jero, Sebastián, Sebastián)

Su momento de tensión es **al colgar una llamada**. Hoy sale de ahí a mandar un screenshot al grupo
o a pedir un link de PayPal. En el CRM:

- Ve **su tablero** con sus deals por etapa y sus llamadas del día.
- Registra la llamada, el resultado y la nota, sin salir de la pantalla.
- Si cerró: registra la venta y el primer abono ahí mismo, con el comprobante.
- Reclama leads sin dueño (*Unclaimed*) en vez de esperar a que se los repartan.
- Encuentra el brochure y el link de pago correcto en **Recursos**, en un clic.
- Crea productos y plataformas de pago si le falta uno, sin pedirle permiso a nadie.
- **Ve el dashboard completo del programa**, incluida la caja y el comparativo entre closers. Es
  una decisión tomada a propósito: *todos ven todo*.

### Gerente (Alejo, Daniel Tovar, Michael)

Su momento de tensión es **preguntar en el grupo "¿cuántas calls, cuántos no-show, cuántas ventas
hoy?"** y depender de que alguien arme el PDF. En el CRM:

- Dashboard por programa en vivo: agendas, llamadas, % de show, ventas, % de cierre, caja
  recaudada, meta y meta dinámica. Por día, semana, cohorte y mes.
- Desglose **por closer** y **por origen del lead**.
- Embudo por etapa: cuántos deals hay hoy en cada paso y cuánto tardan en pasar al siguiente.
  Eso es lo que hoy no existe en ninguna parte.
- Cartera vencida: a quién le falta cuál cuota y desde cuándo.
- Crea programas, cohortes, metas y usuarios sin que un desarrollador toque código.
- Reasigna el dueño de un deal.

### Developer (Mani)

- Ve todo, sin excepción, y además una pantalla de salud: si el sync corrió, qué falló, qué cambió
  en la configuración y qué versión está desplegada.
- Es el único rol con acceso total, y está escrito así a propósito en un solo lugar del código.

⚠️ **Una cosa que conviene decir en voz alta:** la meta es **de la cohorte**, no se reparte entre
closers. Un closer tiene contribución, no meta propia. Repartirla sería inventar un número con el
que se mide a personas.

## 6. Qué información se va a guardar

Esta es la parte que más vale explicar, porque es la que decide qué preguntas se van a poder
responder después.

| Qué se guarda | Para qué sirve |
|---|---|
| **El lead y todos sus correos y teléfonos** | Que la misma persona no sea tres personas |
| **Cada envío del formulario, con TODAS las columnas** | Poder volver atrás y ver qué contestó, aunque hoy no se use ese campo |
| **Los UTMs de cada envío** | Atribución: de qué campaña, canal y creativo vino |
| **El deal, su etapa y su dueño** | Saber en qué va cada oportunidad y de quién es |
| **El historial de cada cambio de etapa, con fecha y persona** | Conversión etapa a etapa y tiempo en etapa. **Esto no se puede reconstruir después**: el dato es el instante en que pasó |
| **Las llamadas, con su link de Grain y su resultado** | Análisis de llamadas sin copiar transcripciones a mano |
| **Cada abono por separado, no solo "la venta"** | La caja cobrada es distinta de las ventas cerradas |
| **Las cuotas pactadas, una fila por cuota** | *"le falta la cuota 2, vencía el 5 de octubre"*, no solo "debe plata" |
| **Todo movimiento, con quién y cuándo** | Auditoría. Si dentro de tres meses alguien pregunta quién cambió esto, hay respuesta |

**Dos definiciones que el sistema no va a mezclar nunca**, porque mezclarlas es el error más caro:

- 🔴 **Caja recaudada ≠ ventas cerradas.** Una venta contada entera y cobrada a medias infla el
  ROAS y la recuperación del CAC. Son dos números separados y así se muestran.
- 🔴 **Anular ≠ Cierre Perdido.** Cierre Perdido es *el lead dijo que no* y cuenta en el embudo.
  Anular es *ese registro nunca debió existir* y no cuenta en ninguna métrica. Si se fundieran, un
  error de tecleo se convertiría en una venta perdida y la conversión mentiría.

**Lo que NO se guarda:** ningún dato de tarjeta, cuenta bancaria ni instrumento de pago. Solo monto
y plataforma. Y la cédula tampoco entra, salvo que el equipo lo pida.

## 7. En qué va hoy (medido el 21-sep, no estimado)

| | |
|---|---|
| Leads ya sincronizados en producción | **4.791** |
| Llamadas, ventas y abonos registrados | **0** |
| Tests automáticos pasando | 677 |
| Decisiones documentadas (ADR) | 42 |
| Tickets del plan v2 | 47, de los cuales 2 cerrados |

🎯 **Ese cero es la mejor noticia del proyecto.** Significa que cambiar el modelo entero ahora
mismo no mueve un solo dato real: es cambiar cañerías de una casa vacía. Con 300 llamadas
registradas encima, el mismo cambio sería un trabajo de semanas. Por eso se está haciendo esta
semana y no en dos meses.

**Lo que ya funciona hoy:** el sync diario desde las hojas corre solo y verificado, la gestión de
programas / cohortes / productos / recursos está construida, y el control de acceso por rol está
probado. Lo que se está reescribiendo es la capa comercial encima.

**El orden de lo que falta:**

```
1. El esquema nuevo (en curso)  →  2. El motor de etapas  →  3. El sync v2
→  4. Llamadas, plata y estudiantes  →  5. Dashboard y reportes  →  6. La interfaz
→  7. Traer el histórico
```

⚠️ **La interfaz va de última a propósito**, y es una decisión, no un descuido: es literal lo que
el equipo va a ver, y se define con el motor funcionando enfrente en vez de adivinando. Lo que
queda definido desde ya es el criterio: lo más fácil de usar posible, utilidad sobre estética, y
usable desde el celular, porque un closer registra un abono desde el teléfono en mitad de una
llamada.

## 8. Lo que el CRM NO hace

Dicho de frente, para que nadie espere lo que no va a llegar:

- No reemplaza el formulario: los leads siguen entrando por ahí.
- No convierte monedas solo. Cada monto va con su moneda.
- No genera el PDF narrativo de Michael. El dashboard **es** el reporte; lo exportable es una foto
  de lo que ya se ve en pantalla.
- Todavía no se conecta con Calendly, Kapso ni Typeform. La forma ya está decidida, la conexión no
  está hecha.
- No manda recordatorios de seguimiento. Sí guarda la fecha, que es el dato que esa función
  necesitaría después.
- Nada de esto es público: sin sesión no se ve ni una cifra.

## 9. Lo que falta que el equipo decida

Estas no las puede contestar el código. Son las que valen la reunión:

**De los closers** (Andrea y Maru primero, que son las que ya producen data a mano):

- ¿Las diez etapas son las correctas, o falta o sobra alguna?
- ¿Qué campo les da más pereza llenar? Ahí está la causa real del dato incompleto.
- ¿Qué hacen con un no-show, con un compromiso vencido, con alguien que dice "la próxima cohorte"?
- ¿Qué es una venta sin llamada?

**De Michael, antes de que salga:**

- ¿Por qué se dejó de calcular el ROAS?
- ¿Qué pasa cuando un pago parcial nunca se completa?
- ¿Alguien edita el estado de la hoja a mano?

**De gerencia:**

- ¿Qué decisión se toma con cada número del reporte? El que no soporta una decisión, no va.

## Related
[[retia]] · [[retia-ops]] · [[crm-retia-modelo-hubspot-scaffold]] · [[retia-metrics]] ·
[[dashboard-crm-closers-retia]] · [[flujo-de-leads-retia]] · [[mapa-retia]] ·
[[consolidado-rol-devops-2026-09-21]]
