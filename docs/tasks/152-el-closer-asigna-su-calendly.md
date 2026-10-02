---
id: 152
etapa: NC2
serves: "ADR 0074; operación comercial: closers nuevos sin pasar por el gerente"
depends: [096, 031]
status: en curso
---

# 152 — El closer asigna y cambia su propia cuenta de Calendly por programa

**Origen:** Mani, 2-oct, antes de meter dos closers nuevos. Decisión en el
[ADR 0074](../adr/0074-lo-propio-del-closer-lo-edita-el-closer.md).

## Objetivo

En `/perfil`, un closer ve sus membresías activas y, en cada una, escoge su cuenta de Calendly de la lista de la
organización de ese programa (preseleccionada si su correo de login está en la lista), la cambia o la quita.

## Alcance

- **Dentro:** reutilizar `asignarCalendlyDeMembresia` (`lib/catalogo/usuarios.ts`) y el componente
  `components/calendly-membresias.tsx`; una acción nueva en `app/(app)/perfil/acciones.ts` que resuelve las
  membresías **desde la sesión** (`trabajaLeads`) y nunca desde el input. La mutación acepta como actor al dueño
  de la membresía o a quien administra; a un tercero, 403.
- **Fuera:** `closer_id`, rol y membresías (siguen siendo de quien administra, ADR 0074 punto 1).

## Done cuando

- [ ] Tests: el dueño asigna y cambia la suya; otro closer recibe 403 con un `membresiaId` ajeno y la base no se
  mueve; una cuenta ya tomada por otro se rechaza (índice); el gerente sigue pudiendo; cada cambio deja
  `change_log`.
- [ ] Typecheck, lint, `npm run build` (toca un componente cliente) y los tests del cambio en verde.
- [ ] Recorrido en local como closer, y la acción mordida forjando la petición con el `membresiaId` de otro.
