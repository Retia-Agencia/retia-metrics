import { rutaDePrograma, type SeccionDelHub, type TabDePrograma } from "@/lib/nav";

function absoluta(ruta: string): string {
  return new URL(ruta, process.env.AUTH_URL ?? "http://localhost:3000").toString();
}

export function comandoParaClaudeMcp(token: string): string {
  const origen = new URL(absoluta("/api/mcp")).origin;
  return `claude mcp add --transport http retia-crm ${origen}/api/mcp --header "Authorization: Bearer ${token}"`;
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

export function enlaceDeSeccionHub(slug: string, seccion: SeccionDelHub): string {
  const enlace = new URL(enlaceDeTab(slug, "hub"));
  enlace.searchParams.set("seccion", seccion);
  return enlace.toString();
}
