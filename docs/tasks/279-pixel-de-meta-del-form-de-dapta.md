---
id: 279
etapa: pauta
serves: "El pixel de Meta de cada formulario de Dapta se ve y se cambia desde su fuente en el CRM, sin editarlo a mano por la API (Mani, 19-oct)"
depends: [278]
status: todo
---

# 279 — El pixel de Meta del form de Dapta, desde la fuente

## Por qué

El 19-oct se replicaron en Dapta los Typeform de ComunicArte, Tactical y Confianza, y se les puso a mano el pixel de
Meta en `config.tracking.metaPixelId` (TI `1526923172471788`, CA `974573078957944`, Confianza `1068355778485503`). Dapta
dispara `PageView` al cargar y `Lead` una vez por sesión. Un pixel equivocado deja a Meta optimizando la pauta a ciegas
sin un solo error.

## Decidido con Mani (19-oct, `/grill-with-docs`)

- **El CRM escribe en Dapta, no guarda copia.** Dapta es la fuente de verdad del pixel: el CRM lo lee en vivo
  (`GET /v1/forms/{id}`) y lo cambia (`PUT` con `expectedUpdatedAt` y el config completo, luego `publish`). Guardarlo
  en el CRM sería una copia que se desfasa en silencio (ADR 0077). Es el primer borde donde la app escribe en un
  proveedor: va acotado a `config.tracking.metaPixelId` de un form con id explícito.
- **La llave de Dapta vive en Programa › Integraciones (278)**, no en la fuente. La fuente guarda solo su form id
  (dato, ADR 0012).
- **Solo el pixel de Meta.** Los demás campos de `config.tracking` (GTM, PostHog, HubSpot) no los usa nadie.

## Abierto

- **El borrador ajeno:** `PUT` guarda un borrador y `publish` lo pone en vivo. Si alguien dejó cambios sin publicar en
  el editor de Dapta, publicar desde el CRM los subiría también. Recomendación: si `draftConfig` difiere de `config`,
  no publicar y decirlo.
- Confirmar el workspace con `GET /v1/me` antes de escribir (la skill `dforms-api`).
- Que el rastro en `change_log` lleve el pixel viejo y el nuevo (no es secreto).

## Done cuando

ADR del borde (el CRM escribe en Dapta, qué puede y qué no); desde la fuente se ve el pixel vivo y se cambia; la llave
nunca sale hacia el cliente (test guardián); un cambio deja rastro en `change_log`; y un guardián impide que el código
escriba en Dapta algo distinto de `tracking.metaPixelId`.

## Relacionado

CAPI-1 en `docs/plan.md` §backlog: la API de Conversiones. Para leer si un pixel recibe eventos, Pauta tiene que
compartir los pixels con el usuario del sistema `retia-insights` (el 19-oct Meta le negó los tres).
