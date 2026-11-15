---
id: 430
etapa: configuracion
serves: "Mani, 14-nov: onboarding de un programa sin fricción · ADR 0132 puntos 1 y 2 · docs/onboarding-de-programa.md F2 y F3"
depends: []
status: en curso
---

# 430 — Un registro de pasos de configuración del programa

## Por qué
Lo que falta para activar estaba escrito dos veces: `faltaParaActivar` (`lib/queries/ficha-programa.ts:233`) y
`exigirPrincipalYToken` (`lib/catalogo/programas.ts:205`). Y el procedimiento real (operations.md §2.1) no existe en la app.

## Qué
- `lib/programas/configuracion.ts` (puro, sin base): `CLAVES_DE_PASO` en este orden: `datos`, `calendly`, `fuente_principal`,
  `avisos_calendly`, `equipo`, `cohorte_activa`, `plataforma_pago`, `cuenta_meta`. Cada paso: `titulo`, `explicacion`, `exigidoParaActivar`,
  `seccion` (`"programa" | "ventas" | "integraciones"`), `hecho(hechos)`. Exigidos: solo `calendly` y `fuente_principal` (ADR 0132).
- `pasosPendientes(hechos, { soloExigidos })`.
- `lib/programas/hechos.ts`: `hechosDeConfiguracion(db, programId)`, la única lectura de los hechos.
- `reactivarPrograma` lanza el 422 con los títulos pendientes exigidos; la pantalla pinta lo mismo. Las dos copias se borran.

## Done cuando
- [ ] Registro y hechos con tests; test de paridad (pantalla y 422 dicen lo mismo con un requisito a medias).
- [ ] `faltaParaActivar` y `exigirPrincipalYToken` borrados; sus tests migrados.
- [ ] Typecheck, lint y tests del cambio en verde; checkpoint verde.
- [ ] Tracker y `status:` iguales (N9).
