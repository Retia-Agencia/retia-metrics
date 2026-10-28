# 0111: El cockpit se migra al CRM por estrangulamiento; el motor sigue en n8n

- **Estado:** aceptado · 28-oct-2026 (Mani, grill del plan de media).
- **Confirma:** ADR 0012, ADR 0029 (las filas de negocio entran por el molde), ADR 0043.

## Contexto

El cockpit (`../pipeline-creacion-contenido`) es otro sistema: su propia base Supabase (40+ migraciones, RLS
multi-tenant), un Next.js aparte y cinco workflows de n8n que corren solos (el motor de reels, con 43 corridas, y el
descubrimiento de referentes). Ya no sirve a 30X ni a EstadoX: solo lo usa Retia, y todo de media va al CRM.

## Decisión

1. **Se migran los datos y las pantallas; el motor se queda en n8n.** Los workflows siguen corriendo, pero leen y
   escriben **por una fachada del CRM** (rutas con secreto, molde de `/api/semaforo/*`): la configuración de cada
   corrida (hoy `run-plan`) y la escritura de candidatos. Un solo módulo del CRM habla con n8n.
2. **Por estrangulamiento, en este orden:** (a) el esquema en la base del CRM; (b) el traslado único de los datos
   vivos, una sola vez y con huella para deshacerlo, como la migración de las hojas; (c) la fachada y el repunte de
   n8n, con una corrida de prueba comparada contra la anterior; (d) las pantallas, una a una; (e) el apagado del
   cockpit, en solo lectura primero, cuando la última pantalla esté en el CRM.
3. **Qué se migra:** creadores (los clientes), referentes y su salud, candidatos, transcripciones, guiones limpios,
   colecciones, calificaciones y su aprendizaje. **Qué no:** lo multi-tenant (`usuarios_clientes`, RLS por cliente,
   30X y EstadoX), los workflows parqueados (LinkedIn, Substack) y los usuarios, que se crean en el CRM con su rol.
4. **El cliente del cockpit es el creador del CRM** (ADR 0110), con programa opcional.
5. **Las tablas del cockpit entran con los nombres del vocabulario del CRM** (`docs/overview.md` §11), no con los del
   cockpit; el traslado mapea.

## Por qué

El motor funciona y reescribirlo (36 + 22 nodos) es riesgo sin ganancia para media. Dejar las dos bases y solo mostrar
el cockpit en el CRM no permite la frontera de programa en el tipo ni cruzar referentes con piezas e insights.

## Consecuencias

- Hasta el apagado hay dos lugares con datos de contenido; la fachada hace que n8n escriba solo en el CRM desde el
  repunte, y el cockpit queda de solo lectura desde ese día.
- Los secretos de n8n (Apify, Supadata, Anthropic) siguen en n8n; el CRM solo guarda el de la fachada.
