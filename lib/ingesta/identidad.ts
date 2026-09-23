/**
 * ¿A que Lead pertenece cada Envio? (ADR 0035, ticket 050). Es la UNICA respuesta a esa
 * pregunta: es el punto del sync donde un bug no lanza ningun error y mezcla a dos
 * personas para siempre.
 *
 * Reglas, en orden:
 *  1. **El correo manda.** Mismo correo dentro del programa → el mismo Lead, sin preguntar
 *     (la llave unica del ADR 0005).
 *  2. **El telefono une y MARCA.** Correo distinto (o ausente) con un telefono conocido →
 *     el envio se suma a ese Lead, marcado, y el correo nuevo entra SIN confirmar. Un
 *     gerente separa o confirma (etapa 6).
 *  3. Sin correo y sin un telefono conocido → no hay Lead: la llave del Lead es el correo.
 *
 * 🩸 La marca y no la fusion: 37 telefonos de un programa tienen mas de un correo y parte son
 * personas distintas con numero compartido (una familia, un numero de trabajo). Fusionar
 * no se deshace mirando los datos; no fusionar se nota. Entre dos errores asimetricos se
 * elige el reversible.
 *
 * El programa no aparece aqui porque es una frontera (ADR 0043): quien llama pasa los
 * envios y los contactos de UN programa, y cruzarlos no se puede ni pedir.
 *
 * Funcion pura y determinista: el resultado depende de la posicion de cada envio, no del
 * orden en que llegan al arreglo.
 */

export interface EnvioParaIdentidad {
  token: string;
  /** Posicion en la hoja; nula para un webhook (van despues, por token). */
  posicion: number | null;
  /** Ya normalizados (`normalizarEmail`, `normalizarTelefono`). */
  correo: string | null;
  telefono: string | null;
}

/** Lo que el programa ya tiene en `lead_contactos` (y el correo principal de cada lead). */
export interface ContactoConocido {
  leadId: string;
  tipo: "correo" | "telefono";
  valor: string;
  /** Falso si entro por telefono y nadie lo confirmo todavia. */
  confirmado?: boolean;
}

export type LeadRef =
  | { tipo: "existente"; leadId: string }
  /** Un Lead que esta corrida va a crear. Su llave es su correo principal. */
  | { tipo: "nuevo"; correo: string };

export interface Asignacion {
  token: string;
  posicion: number | null;
  lead: LeadRef | null;
  motivo: "nuevo" | "correo" | "telefono" | "sin_contacto" | "sin_correo";
  /** Unido por telefono, o por un correo que entro asi y sigue sin confirmar. */
  marcado: boolean;
}

export interface ContactoNuevo {
  lead: LeadRef;
  tipo: "correo" | "telefono";
  valor: string;
  /** El envio del que llego (`lead_contactos.submission_id` cuando se escriba). */
  token: string;
  esPrincipal: boolean;
  confirmado: boolean;
}

export interface PosibleDuplicado {
  token: string;
  motivo: "unido_por_telefono" | "telefono_de_otro_lead";
  /** Los leads involucrados: un id, o `nuevo:<correo>` para los que crea esta corrida. */
  leads: string[];
}

export interface ResultadoIdentidad {
  asignaciones: Asignacion[];
  contactosNuevos: ContactoNuevo[];
  posiblesDuplicados: PosibleDuplicado[];
}

function llaveDe(lead: LeadRef): string {
  return lead.tipo === "existente" ? lead.leadId : `nuevo:${lead.correo}`;
}

/** Posicion ascendente; lo que no viene de una hoja va al final, por token. */
function enOrden(a: EnvioParaIdentidad, b: EnvioParaIdentidad): number {
  if (a.posicion !== b.posicion) {
    if (a.posicion === null) return 1;
    if (b.posicion === null) return -1;
    return a.posicion - b.posicion;
  }
  return a.token < b.token ? -1 : a.token > b.token ? 1 : 0;
}

export function resolverIdentidad(
  envios: EnvioParaIdentidad[],
  conocidos: ContactoConocido[],
): ResultadoIdentidad {
  type Dueno = { lead: LeadRef; confirmado: boolean };
  const porCorreo = new Map<string, Dueno>();
  const porTelefono = new Map<string, Dueno>();
  const tieneTelefono = new Set<string>();

  for (const c of conocidos) {
    const dueno = { lead: { tipo: "existente", leadId: c.leadId } as LeadRef, confirmado: c.confirmado ?? true };
    if (c.tipo === "correo") porCorreo.set(c.valor, dueno);
    else {
      porTelefono.set(c.valor, dueno);
      tieneTelefono.add(c.leadId);
    }
  }

  const asignaciones: Asignacion[] = [];
  const contactosNuevos: ContactoNuevo[] = [];
  const posiblesDuplicados: PosibleDuplicado[] = [];

  const sumarTelefono = (lead: LeadRef, telefono: string, token: string) => {
    porTelefono.set(telefono, { lead, confirmado: true });
    const llave = llaveDe(lead);
    contactosNuevos.push({
      lead,
      tipo: "telefono",
      valor: telefono,
      token,
      esPrincipal: !tieneTelefono.has(llave),
      confirmado: true,
    });
    tieneTelefono.add(llave);
  };

  for (const e of [...envios].sort(enOrden)) {
    const base = { token: e.token, posicion: e.posicion };
    const delCorreo = e.correo ? porCorreo.get(e.correo) : undefined;
    const delTelefono = e.telefono ? porTelefono.get(e.telefono) : undefined;

    // 1. El correo manda.
    if (delCorreo) {
      asignaciones.push({ ...base, lead: delCorreo.lead, motivo: "correo", marcado: !delCorreo.confirmado });
      if (e.telefono && !delTelefono) sumarTelefono(delCorreo.lead, e.telefono, e.token);
      else if (delTelefono && llaveDe(delTelefono.lead) !== llaveDe(delCorreo.lead)) {
        // El telefono ya es de OTRO lead. No se le quita (es unico por programa) ni se
        // mueve el envio: el correo manda. Pero un gerente tiene que verlo.
        posiblesDuplicados.push({
          token: e.token,
          motivo: "telefono_de_otro_lead",
          leads: [llaveDe(delCorreo.lead), llaveDe(delTelefono.lead)],
        });
      }
      continue;
    }

    // 2. El telefono une, y marca.
    if (delTelefono) {
      asignaciones.push({ ...base, lead: delTelefono.lead, motivo: "telefono", marcado: true });
      if (e.correo) {
        porCorreo.set(e.correo, { lead: delTelefono.lead, confirmado: false });
        contactosNuevos.push({
          lead: delTelefono.lead,
          tipo: "correo",
          valor: e.correo,
          token: e.token,
          esPrincipal: false,
          confirmado: false,
        });
      }
      posiblesDuplicados.push({
        token: e.token,
        motivo: "unido_por_telefono",
        leads: [llaveDe(delTelefono.lead)],
      });
      continue;
    }

    // 3. Sin correo no hay Lead que crear.
    if (!e.correo) {
      asignaciones.push({ ...base, lead: null, motivo: e.telefono ? "sin_correo" : "sin_contacto", marcado: false });
      continue;
    }

    // Un Lead nuevo, con su correo como principal.
    const lead: LeadRef = { tipo: "nuevo", correo: e.correo };
    porCorreo.set(e.correo, { lead, confirmado: true });
    asignaciones.push({ ...base, lead, motivo: "nuevo", marcado: false });
    contactosNuevos.push({ lead, tipo: "correo", valor: e.correo, token: e.token, esPrincipal: true, confirmado: true });
    if (e.telefono) sumarTelefono(lead, e.telefono, e.token);
  }

  return { asignaciones, contactosNuevos, posiblesDuplicados };
}
