import { rutaDePrograma, type TabDePrograma } from "@/lib/nav";

function absoluta(ruta: string): string {
  return new URL(ruta, process.env.AUTH_URL ?? "http://localhost:3000").toString();
}

export function enlaceDeLead(slug: string, leadId: string): string {
  return absoluta(`${rutaDePrograma(slug, "leads")}/${leadId}`);
}

export function enlaceDeDeal(slug: string, dealId: string): string {
  return absoluta(`${rutaDePrograma(slug, "deals")}/${dealId}`);
}

export function enlaceDeTab(slug: string, tab: TabDePrograma): string {
  return absoluta(rutaDePrograma(slug, tab));
}
