import { createHash } from "node:crypto";

type DealDeVenta = { id: string; valorVendidoUsd: string | null };
type LeadDeVenta = {
  id: string;
  emailNormalizado: string;
  telefono: string | null;
  nombre: string | null;
};

const hash = (valor: string) => createHash("sha256").update(valor).digest("hex");

function telefonoNormalizado(valor: string | null): string | null {
  const digitos = valor?.replace(/\D/g, "") ?? "";
  if (!digitos) return null;
  return digitos.length === 10 && digitos.startsWith("3") ? `57${digitos}` : digitos;
}

export function payloadDeVenta(input: {
  deal: DealDeVenta;
  lead: LeadDeVenta;
  fbc: { fbclid: string; capturadoEn: Date } | null;
  eventTime: Date;
}) {
  const nombre = input.lead.nombre?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  const telefono = telefonoNormalizado(input.lead.telefono);
  const userData: Record<string, string[] | string> = {
    em: [hash(input.lead.emailNormalizado.trim().toLowerCase())],
    external_id: [hash(input.lead.id)],
  };
  if (telefono) userData.ph = [hash(telefono)];
  if (nombre[0]) userData.fn = [hash(nombre[0])];
  if (nombre.length > 1) userData.ln = [hash(nombre.slice(1).join(" "))];
  if (input.fbc) userData.fbc = `fb.1.${input.fbc.capturadoEn.getTime()}.${input.fbc.fbclid}`;

  return {
    event_name: "Purchase" as const,
    event_id: input.deal.id,
    event_time: Math.floor(input.eventTime.getTime() / 1000),
    action_source: "system_generated" as const,
    custom_data: { value: Number(input.deal.valorVendidoUsd), currency: "USD" as const },
    user_data: userData,
  };
}
