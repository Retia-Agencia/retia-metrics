# 0044 — El origen humano de un lead: el link del closer, `traido_por`, y el CPL que cuenta solo Pauta

**Fecha:** 2026-09-21 · **Reescrito:** 2026-09-27 (consolida las enmiendas de los ADR 0046 y 0051 y la
regla de alta manual del ADR retirado 0021) · **Estado:** aceptado; **prioridad baja** desde el 24-sep

## El problema

Un lead que trae un closer no deja rastro en ningún UTM, así que *"leads por área"* mostraría
**Comercial en cero** y un gerente concluiría que los closers no aportan pipeline. La pantalla no
fallaría: mentiría. Y el dato no existe en ninguna parte, así que no hay backfill: se escribe al
entrar el lead o no se escribe nunca.

**Prioridad:** en la reunión del 24-sep los closers dijeron que hoy **no traen leads propios**. El
diseño sigue siendo correcto y no estorba, pero el ticket 086 va al final. Que Comercial salga en cero
en "leads por área" es un dato real, no un bug.

## Decidimos

**1. El closer no teclea un UTM: tiene un link de captación**, por closer y programa, generado por el
CRM y **calculado, nunca guardado** (el mismo generador de los links de campaña, ADR 0051):

```
<formulario del programa>?utm_source=closer&utm_medium=referido
  &utm_campaign=<campaña de referidos del programa>&utm_content=<código opaco del closer>
```

El código es opaco, nunca el nombre (`Maru`, `maru` y `Maru Marquez` serían tres closers, ADR 0030).
El formulario ya captura `utm_content`: cero cambios en Typeform. El lead que entra así trae sus
respuestas del formulario, que es lo que el closer necesita para trabajarlo.

**2. `leads.traido_por_user_id`, FK a `users`, nunca texto.** La escribe **solo la ingesta** a partir
del código en `utm_content`, y **el primero que la escribe gana**: si el mismo correo reaplica después
por una campaña de Meta, sigue siendo de quien lo trajo.

**3. El alta manual sobrevive como respaldo, y no genera envío.** Para el lead que llegó por WhatsApp,
un evento o un amigo: el closer lo crea con correo obligatorio, queda marcado
(`leads.entrada = 'crm'`) y su deal nace en Pendiente Setteo, En Contacto o Compromiso Verbal, con él
como dueño. Si después aplica por el formulario, la ingesta lo encuentra por correo.

**4. Traerlo no lo hace dueño.** Mani: *"los closers definen eso; supongo que deben revisar bien el
UTM"*. Por eso el origen (área, canal, campaña y quién lo trajo) tiene que estar a la vista en el
Inbox, donde se reclama.

**5. El denominador del CPL cuenta los leads cuyo canal es del área Pauta**, no los que entraron por
el formulario. Con el link del closer, un lead de Comercial también entra por el formulario, y contarlo
abarataría el CPL de una campaña mala sin lanzar un error. Esta regla va en el mismo movimiento que la
clasificación (ticket 087), nunca después.

> **Cerrado el 30-sep (ticket 087, Mani).** El área la resuelve `emparejar` (`lib/atribucion/emparejar.ts`,
> 085), y el denominador cuenta **tokens**, no filas (DP-11: el parcial y su completa cuentan una vez). La
> consulta del costo no existía al cerrar (ni gasto: `ad_spend` estaba vacía); nace en el 123 con
> `gasto_pauta` (120), con la fórmula de `docs/analytics.md` §6. `leads.entrada` queda solo como "por dónde
> entró": no es la llave de ningún costo. Sigue contando para la meta de leads por día (`leadsDelRango`),
> que es cumplimiento y no costo.

## Abierto

🔴 Para Gerencia: ¿un lead que trae un closer cuenta distinto para su comisión?
