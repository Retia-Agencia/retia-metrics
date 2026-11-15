# Onboarding de un programa: análisis y propuesta (14-nov)

Estado: **aprobado el 14-nov (ADR 0132, tickets 430 a 434).** D-1: solo los dos de hoy; D-2: tres pestañas; D-3: WhatsApp en Integraciones; D-4: ADR nuevo. Pedido de Mani (14-nov): crear y configurar un programa desde la UI tiene
demasiada fricción; la ficha tiene cinco pestañas, las integraciones están partidas, y con un programa inactivo
elegido el menú ofrece rutas que fallan. Este documento mide el código de hoy, nombra la causa de cada fricción y
propone los cambios y su reparto en tickets. Rango N8: documento de análisis; manda ADR > ticket > este archivo.

## 1. Lo que hay hoy (medido en el código)

| Pieza | Dónde | Qué hace |
|---|---|---|
| Botón "Nuevo programa" | `components/program-switcher.tsx:124-166` | Diálogo con Nombre, **Slug** y Ticket. Crea el programa inactivo y lleva a `/p/<slug>/programa` |
| La ficha | `app/(app)/p/[programa]/programa/page.tsx` (673 líneas) | Cinco pestañas: General, Equipo, Captación, Integraciones, Ventas (`page.tsx:144-175`) |
| Qué falta para activar (pantalla) | `faltaParaActivar`, `lib/queries/ficha-programa.ts:233` | Token de Calendly y fuente principal |
| Qué falta para activar (servidor) | `exigirPrincipalYToken`, `lib/catalogo/programas.ts:205` | **La misma regla, escrita otra vez** |
| El menú | `navParaRol`, `lib/nav.ts:132` | Recibe un slug y no sabe si el programa está activo |
| El programa del menú | `components/app-sidebar.tsx:103-108` | `programa` sale solo de los activos; `actual` (el selector) sí incluye inactivos |
| Las tabs operativas | todas las `page.tsx` bajo `app/(app)/p/[programa]/` salvo los redirects viejos (raíz, dashboard, metas) | Pasan por `programaVisiblePorSlug` (`lib/auth/alcance.ts:165`), que solo ve activos: un inactivo responde 404 |
| La ficha de un inactivo | `programaDeLaFichaPorSlug`, `lib/auth/alcance.ts:179` | La única puerta que admite un inactivo, y solo a quien administra (ADR 0094 punto 4) |
| El procedimiento real | `docs/operations.md` §2.1 | Nueve piezas en un orden que "funcionó", escrito a mano para un humano que lee el repo |

## 2. Las causas, una por fricción

**F1. Los paths que fallan con un programa inactivo.** Con un inactivo elegido, el selector muestra el inactivo
(`actual`) pero el menú se arma con `programa`, que cae al último programa *activo* recordado
(`app-sidebar.tsx:103-104`). Resultado: Hub, Deals, Leads apuntan a **otro programa** o, si se llega por URL o por el
selector (`rutaAlCambiarDePrograma` conserva la tab), a una ruta del inactivo que responde 404. No hay ningún lugar que
responda "¿qué tabs tiene un programa en este estado?": el menú no recibe el estado y el selector lo parcha en el
cliente (`program-switcher.tsx:83-90`, `slugsInactivos`). Es la regla N1 rota: una pregunta, tres respuestas parciales.

**F2. La regla de activación está duplicada.** `faltaParaActivar` (lo que la pantalla dice que falta) y
`exigirPrincipalYToken` (lo que el servidor rechaza) son dos copias. Hoy coinciden; el día que alguien agregue un
requisito en una sola, la pantalla dirá "listo" y el servidor dirá 422, o al revés. Es el mismo olor que
`saldoDeVenta` contra `ventasDePersona` antes del ADR 0024.

**F3. No hay recorrido, hay un checklist de dos ítems.** Lo que de verdad hace falta para operar está en
`docs/operations.md` §2.1 (fuente, secreto, activar fuente, URL pública, principal, token, webhook de Calendly, equipo,
cohorte, cobro). La pantalla solo conoce dos y no dice el orden ni dónde se hace cada cosa. Quien no tiene el repo no
puede saber que existe el resto.

**F4. Las integraciones están partidas en dos pestañas.** Las fuentes de formulario y sus secretos de webhook viven en
Captación; Calendly, Meta, Meta CAPI, Typeform y Dapta en Integraciones. La prueba del corte es la tarjeta
**"Fuera de esta pestaña"** (`integraciones-del-programa.tsx:189-202`), que existe solo para mandar a la otra. El
reporte por WhatsApp (una salida configurada) vive en General.

**F5. Cinco pestañas para información que cabe en tres.** Equipo es una tarjeta sola; Captación es una tarjeta sola
cuando se le quitan las integraciones; General mezcla datos del programa con el reporte de WhatsApp.

**F6. El alta pide un dato técnico.** El diálogo pide **Slug** a mano: un término de código (N5) que además es
inmutable (`editarPrograma` lo rechaza, `programas.ts:238`), así que un error de tecleo queda para siempre en las URLs.

## 3. La propuesta

El principio: **el estado del programa decide la pantalla, y esa decisión vive en UN módulo de `lib/` que leen el
menú, el selector, las rutas, la pantalla y la reja del servidor.** Nada de eso se escribe por programa: un programa
nuevo hereda el recorrido sin código (C-1, ADR 0012).

### 3.1 Un registro de pasos de configuración (resuelve F2 y F3)

Un módulo nuevo, `lib/programas/configuracion.ts`, con un registro tipado y exhaustivo (el molde de `PROVEEDORES` y de
`INTEGRACIONES`):

```ts
// Boceto: la forma, no el código final.
type PasoDeConfiguracion = {
  clave: ClaveDePaso;              // unión cerrada, exhaustiva en compilación
  titulo: string;                  // texto de pantalla, sin términos técnicos (N5)
  explicacion: string;             // para qué sirve, en una frase
  exigidoParaActivar: boolean;     // la reja del servidor lee ESTO
  seccion: SeccionDeLaFicha;       // dónde se hace
  estado: (hechos: HechosDelPrograma) => "hecho" | "pendiente";
};
```

- `faltaParaActivar` y `exigirPrincipalYToken` se reemplazan por **una** función,
  `pasosPendientes(hechos, { soloExigidos })`; la reja de `reactivarPrograma` lanza el 422 con los títulos que devuelve.
  N7: reemplazar es borrar, así que las dos copias viejas se van en el mismo cambio.
- Un test de paridad (N2) arma el caso que las haría divergir: un programa con un solo requisito cumplido debe dar el
  mismo "falta" en la pantalla y en el 422.
- Los pasos vienen de `docs/operations.md` §2.1, que deja de ser el único lugar donde existe el procedimiento y pasa a
  citar el registro.

**Qué pasos bloquean la activación es una decisión de Mani, no mía.** Hoy bloquean dos (ADR 0057, ADR 0068). Los
candidatos a sumarse, cada uno con su costo:

| Paso | ¿Bloquea hoy? | A favor de exigirlo | En contra |
|---|---|---|---|
| Token de Calendly | sí (ADR 0057) | ya decidido | |
| Fuente principal con URL | sí (ADR 0068) | ya decidido | |
| Webhook de Calendly firmado | no | sin él las citas no se cuelgan del lead | exige enmendar ADR 0057 |
| Al menos un closer en el equipo | no | sin él nadie recibe los deals | un programa puede activarse antes de contratar |
| Cohorte activa | no | sin ella no hay meta ni ventas por cohorte | se puede captar antes de abrir la cohorte |
| Plataforma de pago | no | sin ella no se registra un abono con plataforma | el abono no se bloquea por esto (ADR 0034) |
| Cuenta de Meta | no | sin ella no hay gasto ni ROAS | hay programas sin pauta |

Los que no bloqueen siguen en el registro como **recomendados**: la pantalla los muestra como pendientes después de
activar, sin impedir nada. Así el registro es la lista completa y la exigencia es una propiedad, no una lista aparte.

### 3.2 El estado del programa decide las tabs (resuelve F1)

- `navParaRol` recibe `{ slug, activo }` en vez de un slug. Con un programa inactivo devuelve **solo** la tab
  Programa (que en ese estado es la configuración) más lo que no es de programa (Mi espacio, Ajustes). Sin cambio para
  los roles que nunca ven un inactivo: `programasInactivosParaAdministrar` ya los filtra.
- `app-sidebar.tsx` deja de tener dos variables (`programa` y `actual`): una sola, el programa elegido con su estado.
  Eso quita la causa de que el menú apunte a otro programa.
- `rutaAlCambiarDePrograma` (`lib/nav.ts`) recibe el estado del destino y decide ella la ruta; el parche
  `slugsInactivos` del selector se borra.
- Las tabs operativas, abiertas sobre un inactivo por URL: para quien administra, **redirect a la configuración** en vez
  de 404 (la URL vieja o compartida no termina en un error); para cualquier otro, sigue el 404 (ADR 0048: un programa
  que no ves no existe). Se hace en un helper de `lib/auth/page-guards.ts` que esas páginas llaman en lugar de `programaVisiblePorSlug`,
  no en cada página.
- La pregunta "¿qué tabs tiene este programa en este estado?" vive en `lib/nav.ts` y la leen menú, selector y guarda.

### 3.3 Dos modos de la ficha (resuelve F5)

**Inactivo: un recorrido paso a paso.** La tab Programa pinta el registro como una lista vertical numerada: cada paso
con su título, para qué sirve, su estado y el formulario ya existente adentro (no se reescribe ninguno:
`EditarPrograma`, `FuentesAdmin`, la tarjeta de Calendly de `IntegracionesDelPrograma`, `EquipoDelPrograma`,
`CohortesAdmin`, `PlataformasDelPrograma`). El primer pendiente abre desplegado; el botón **Activar** vive al final y
se habilita solo con los exigidos en verde. Al activar, `revalidarNav()` (ya existe) y la ficha cambia de modo sola.

**Activo: tres pestañas en vez de cinco.**

| Nueva | Qué junta | De dónde sale |
|---|---|---|
| **Programa** | datos (ticket, comisión, estancamiento, pago rápido), destinos, equipo, y los pasos recomendados que queden pendientes | General + Equipo |
| **Ventas** | cohortes, plataformas de pago, objetivos, alertas | Ventas, igual que hoy |
| **Integraciones** | formularios y sus secretos, Calendly, Meta, Meta CAPI, Typeform, Dapta, reporte por WhatsApp | Captación + Integraciones + el reporte de General |

La tarjeta "Fuera de esta pestaña" se borra: ya no hay afuera. `?seccion=ventas` conserva su nombre porque lo enlazan
el Hub, `components/dashboard/alertas.tsx:26` y `components/pauta/cumplimiento.tsx:58`. Las secciones viejas
(`general`, `equipo`, `captacion`) se traducen con un mapa, el mismo molde que `SECCION_VIEJA_EN_EL_HUB` en
`lib/nav.ts:33`, para que ningún enlace guardado se rompa.

Por qué tres y no dos: Ventas tiene cuatro tarjetas con tablas editables; fundida en Programa, la pestaña se vuelve un
scroll largo y "lo principal nunca plegado" (contrato de `docs/structure.md` §9) deja de cumplirse. Si Mani prefiere
dos, Ventas entra en Programa y se pierde eso.

### 3.4 El alta sin slug (resuelve F6)

El diálogo pide Nombre y Ticket. El slug se deriva del nombre con una función única en `lib/catalogo/programas.ts`
(minúsculas, sin tildes con `sinTildes` de `lib/busqueda-sin-tildes.ts`, guiones), se muestra como "Dirección:
/p/comunicarte" debajo del nombre, y es editable solo ahí antes de crear. El esquema zod sigue validándolo y el índice
único sigue rechazando el repetido (la reja no cambia). Al crear, lleva al paso 1 del recorrido.

## 4. Lo que no se rompe, y cómo se prueba

| Riesgo | Guardián |
|---|---|
| Que un rol nuevo vea un inactivo | `programasInactivosParaAdministrar` no cambia; `tests/paginas.test.ts` forja la tab de un inactivo con cada rol: administrador → redirect a la configuración, el resto → 404 |
| Que la pantalla y la reja diverjan | test de paridad del registro (3.1), con el caso de un requisito a medias |
| Que un paso nuevo quede sin pantalla | exhaustividad en compilación sobre `ClaveDePaso` y `SeccionDeLaFicha` |
| Que el menú apunte a otro programa | `navParaRol` es pura: test con `{ activo: false }` que solo devuelva Programa, y uno de `rutaAlCambiarDePrograma` hacia un inactivo |
| Enlaces viejos a `?seccion=` | test del mapa de secciones, mordido con las tres viejas |
| El contrato de la ficha por rol | `presentacionDeLaFicha` cambia sus `secciones`; `tests/paginas.test.ts` y `tests/ficha-programa.test.ts` se actualizan en el mismo cambio |
| Base UI al abrir pasos y diálogos | `npm run test:humo` con un programa inactivo en el seed local, más clic en cada paso con la consola abierta |

Sin migración: nada de esto cambia el esquema. Es todo `lib/` puro, una página y el menú.

## 5. Reparto en tickets (propuesto)

Orden por dependencias; los números se asignan al aprobar.

1. **Registro de pasos de configuración** (3.1). Base de todo. Borra `faltaParaActivar` y `exigirPrincipalYToken`.
2. **El estado del programa decide las tabs** (3.2). Depende de nada; se puede hacer en paralelo con 1. Arregla los
   paths rotos aunque lo demás no se haga.
3. **Ficha en tres pestañas** (3.3, modo activo). Archivo caliente: `programa/page.tsx`. Depende de 1 para los
   recomendados.
4. **Recorrido de configuración** (3.3, modo inactivo). Depende de 1 y 3 (comparte la página).
5. **Alta sin slug** (3.4). Independiente.

Antes de construir: comparar el recorrido contra `docs/bocetos/una-forma-de-metrica.html` en claro, oscuro y 375 px,
y agregar el recorrido a `docs/anotaciones.md` con su id.

## 6. Decisiones abiertas (de Mani)

- **D-1.** Qué pasos bloquean la activación (tabla de 3.1). Cada uno que se sume exige enmendar su ADR.
- **D-2.** Tres pestañas o dos en el modo activo (3.3).
- **D-3.** El reporte por WhatsApp: ¿Integraciones (es una salida) o Programa (es un aviso del programa)?
- **D-4.** Si un ADR nuevo fija la regla "el estado del programa decide la pantalla", o basta con enmendar el ADR 0094
  punto 4, que hoy solo dice que la ficha admite un inactivo.
