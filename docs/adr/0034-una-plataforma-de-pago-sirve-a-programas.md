# 0034 — Una plataforma de pago sirve a programas, por tabla puente

**Fecha:** 2026-09-20 · **Estado:** aceptado (Mani, 20-sep) · **Implementacion:** enmienda del
ticket 013 · **Aplica:** ADR 0012, ADR 0016 · **Toca:** ADR 0005

## El problema

Mani, 20-sep, textual:

> *"Quiero que las plataformas de pago si tengan programa mejor, cada link se asocia a un programa
> para que al registrar una venta en un programa solo se muestren los de ese."*

Hoy `plataformas_pago` es un catalogo GLOBAL: los selectores de `mi-dia-registro` (venta y abono)
y de `recursos-pantalla` (crear enlace de pago) muestran las siete plataformas sin importar en que
programa este parado el closer.

**La mitad de la frase ya se cumplia:** `enlaces_pago.program_id` existe y es `NOT NULL` desde el
ticket 022. Lo que faltaba era acotar el selector de PLATAFORMA.

## La trampa que habia que esquivar

`plataformas_pago` tiene un indice unico sobre `lower(nombre)`, y el comentario del esquema dice
para que existe: *"'Paypal' y 'PayPal' no pueden partir las metricas en dos plataformas
distintas"*. Es la misma familia del ADR 0030.

**Meterle `program_id` a la tabla obliga a aflojar ese indice a unico POR programa.** Con eso
PayPal pasa a ser dos filas con dos ids, y el dia que alguien agrupe caja por plataforma vera
"PayPal 1.200" y "PayPal 900" como si fueran dos medios de pago distintos. **Es exactamente el
dano que el indice existe para impedir, reintroducido por la puerta de al lado**, y no lanzaria
ningun error: la cifra se ve creible.

## Decidimos

**1. Tabla puente `plataformas_programa`, no una columna** (Mani eligio B el 20-sep).

Una plataforma sigue siendo UNA fila con UN nombre, y el indice unico sobre `lower(nombre)` queda
intacto. La relacion con los programas vive aparte. PayPal sirviendo a los dos programas son dos
vinculos, no dos PayPal.

Es la forma normal de "una cosa sirve a varios programas" y ya hay precedente en este repo:
`miembros_programa` hace lo mismo con los usuarios.

**2. Una plataforma SI puede existir sin programa. Queda invisible hasta que se asocie.**

⚠️ **Corregido por Mani el mismo 20-sep, unas horas despues.** La primera version de este ADR
decia lo contrario ("solo existe si esta asociada al menos a un programa") por una mala lectura:
lo que Mani dijo es que **un METODO de pago** no existe sin programa, y metodo de pago es el
*enlace* (el link concreto de PayPal por USD 1.350 de Comunicarte), no la plataforma.

Y ese requisito **ya estaba cumplido**: `enlaces_pago.program_id` es `NOT NULL` desde el ticket
022. No habia nada que construir ahi.

La plataforma es catalogo global, como hoy. Crear una no pide programa. Sin vinculos no le sale a
nadie en ningun selector, y eso esta bien: *"esta bien dejarlos invisible"* (Mani, textual).
**Y se pueden crear plataformas nuevas cuando haga falta**, desde el formulario del enlace de pago,
que es donde nace la necesidad.

**3. Entonces, para que la tabla puente, si el vinculo se puede derivar de `enlaces_pago`?**

Esta es la pregunta que decide si esta tabla merece existir, porque
`select distinct plataforma_id, program_id from enlaces_pago` da lo mismo **gratis** y sin
esquema nuevo. La respuesta la dio Mani:

> *"La tabla si puede ser necesaria para poder registrar abonos que no necesariamente se hayan
> hecho por un enlace."*

Hay cobros que no pasan por un link: una transferencia a Bancolombia, un Zelle. El closer tiene
que poder elegir esa plataforma al registrar el abono **aunque no exista ningun enlace de pago de
esa plataforma en ese programa**. Derivar de `enlaces_pago` haria invisible justo el caso que
existe para cubrirse. De las siete plataformas cargadas, cinco (Bancolombia, Zelle, DollarApp,
Global66, MercadoPago) huelen a transferencia directa y no a link.

Asi que el vinculo es **dato propio**, no derivado: se crea al crear un enlace de pago, y tambien
a mano para habilitar una plataforma en un programa donde se cobra sin link.

**4. La migracion asocia TODAS las plataformas a TODOS los programas activos.**

Esta es la parte donde era facil equivocarse siendo listo. Medido en `production` el 20-sep:

| plataforma | enlaces | abonos |
|---|---|---|
| PayPal | 5, todos de `comunicarte` | 0 |
| Bancolombia, DollarApp, Global66, Hotmart, MercadoPago, Zelle | **0** | **0** |

**Seis de las siete no tienen de donde derivar nada.** Y la septima invita a una inferencia que
seria un cambio de comportamiento silencioso: si PayPal se asocia solo a `comunicarte` porque es
donde tiene enlaces, **Tactical Investor pierde PayPal de su selector sin que nadie lo haya
decidido**. Hoy lo ve, porque hoy no hay filtro.

La regla de una migracion es **preservar el comportamiento de hoy**. Hoy todas las plataformas se
ven en todos los programas, asi que la migracion escribe justamente eso, y **el equipo desasocia
lo que no aplique desde la pantalla**. La decision de negocio ("PayPal no es de Tactical") la toma
un humano mirando, no una migracion adivinando a partir de cinco filas.

## Consecuencias

- **A favor:** el selector se acota al programa, que es lo que Mani pidio, sin tocar la garantia
  de que una plataforma es una fila.
- **A favor:** la migracion no cambia lo que nadie ve. El primer cambio de comportamiento lo hace
  una persona en la app, con su fila en `change_log`.
- **En contra:** una plataforma sin vinculos no le sale a nadie y nada avisa. Es el estado que
  Mani acepto a proposito, pero la pantalla de catalogos deberia mostrar a cuantos programas
  sirve cada una, o "recien creada, sin programa" se ve igual que "funcionando".
- **En contra:** el vinculo es dato propio y no derivado, asi que se puede desincronizar de
  `enlaces_pago`. Crear un enlace tiene que crear el vinculo si falta, en la misma operacion.
- **Abierto:** si un closer puede crear una plataforma, puede asociarla a un programa donde no
  vende? No. Se aplica `exigirAccesoAlPrograma` igual que en productos y recursos (ADR 0016): un
  closer solo asocia programas donde tiene membresia activa.
