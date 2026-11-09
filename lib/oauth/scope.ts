import type { Rol } from "@/lib/auth/roles";
import { esAccesoTotal, marcaOnboarding, trabajaLeads } from "@/lib/auth/roles";
import type { McpScope } from "@/lib/mcp/token";

export function parsearScopePedido(valor: string | null | undefined): Set<string> {
  return new Set((valor ?? "").split(/\s+/).filter((scope) => scope && scope !== "offline_access"));
}

export function scopeConcedido(rol: Rol, pedido: string | Set<string>): McpScope {
  const scopes = typeof pedido === "string" ? parsearScopePedido(pedido) : pedido;
  const puedeEscribir = trabajaLeads({ rol, operaComoCloser: false }) || marcaOnboarding(rol) || esAccesoTotal(rol);
  return scopes.has("escritura") && puedeEscribir ? "escritura" : "lectura";
}
