"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Plus, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { McpScope } from "@/lib/mcp/token";
import { desconectarMiConexionAccion, emitirMiTokenAccion, revocarMiTokenAccion } from "@/app/(app)/mi-espacio/acciones";

export type ConexionOauthVista = { id: string; clienteNombre: string; scopeEtiqueta: string; creado: string; ultimoUso: string; vence: string };
export type TokenPersonalVista = ConexionOauthVista & { nombre: string; scope: McpScope };
type TokenNuevo = { valor: string; comando: string };

export function ConexionesDeIa({ conexiones, tokens, scopes }: {
  conexiones: ConexionOauthVista[];
  tokens?: TokenPersonalVista[];
  scopes?: ReadonlyArray<{ valor: McpScope; etiqueta: string }>;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [scope, setScope] = useState<McpScope>(scopes?.[0]?.valor ?? "lectura");
  const [guardando, setGuardando] = useState(false);
  const [revocando, setRevocando] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<TokenNuevo | null>(null);

  async function crear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    const resultado = await emitirMiTokenAccion({ nombre, scope });
    setGuardando(false);
    if (!resultado.ok) return toast.error(resultado.error);
    setNuevo(resultado.token);
    setNombre("");
    toast.success("Conexion creada");
    router.refresh();
  }

  async function revocar(id: string, etiqueta: string, oauth: boolean) {
    if (!window.confirm(`¿Desconectar “${etiqueta}”? Dejará de funcionar de inmediato.`)) return;
    setRevocando(id);
    const resultado = oauth ? await desconectarMiConexionAccion(id) : await revocarMiTokenAccion(id);
    setRevocando(null);
    if (!resultado.ok) return toast.error(resultado.error);
    toast.success("Conexion desconectada");
    router.refresh();
  }

  function copiar(texto: string, mensaje: string) {
    navigator.clipboard.writeText(texto).then(() => toast.success(mensaje), () => toast.error("No se pudo copiar"));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><KeyRound aria-hidden />Conexiones de IA</CardTitle>
        <CardDescription>Conecta Claude o ChatGPT al CRM. En la IA, agrega la dirección del CRM y entra con tu cuenta de Google.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3" aria-labelledby="conexiones-activas">
          <h3 id="conexiones-activas" className="text-sm font-medium">Conexiones</h3>
          {conexiones.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no has conectado una IA.</p> : (
            <Lista conexiones={conexiones} revocando={revocando} onRevocar={(id, etiqueta) => revocar(id, etiqueta, true)} />
          )}
        </section>

        {tokens && scopes ? (
          <section className="space-y-4 border-t border-border pt-5" aria-labelledby="claves-personales">
            <div><h3 id="claves-personales" className="text-sm font-medium">Claves personales</h3><p className="text-xs text-muted-foreground">Para conexiones manuales. La clave completa se muestra una sola vez.</p></div>
            <form onSubmit={crear} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
              <label className="grid gap-1 text-sm font-medium">Nombre<Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Claude de mi computador" maxLength={80} required /></label>
              <label className="grid gap-1 text-sm font-medium">Permiso
                <Select value={scope} onValueChange={(valor) => { if (valor) setScope(valor as McpScope); }}>
                  <SelectTrigger className="w-full sm:w-48" aria-label="Permiso de la conexion"><SelectValue /></SelectTrigger>
                  <SelectContent>{scopes.map((opcion) => <SelectItem key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <Button type="submit" disabled={guardando || nombre.trim().length === 0}><Plus aria-hidden />{guardando ? "Creando..." : "Crear clave"}</Button>
            </form>
            {nuevo ? <div className="space-y-3 rounded-lg bg-tono-alerta-suave p-3 text-sm">
              <div><p className="font-medium text-tono-alerta">Guárdala ahora</p><p className="text-muted-foreground">Al salir de esta página no podremos volver a mostrarla.</p></div>
              <DatoCopiable etiqueta="Clave" valor={nuevo.valor} onCopiar={() => copiar(nuevo.valor, "Clave copiada")} />
              <DatoCopiable etiqueta="Comando para Claude" valor={nuevo.comando} onCopiar={() => copiar(nuevo.comando, "Comando copiado")} />
            </div> : null}
            {tokens.length === 0 ? <p className="text-sm text-muted-foreground">No hay claves personales.</p> : (
              <Lista conexiones={tokens.map((token) => ({ ...token, clienteNombre: token.nombre }))} revocando={revocando} onRevocar={(id, etiqueta) => revocar(id, etiqueta, false)} />
            )}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Lista({ conexiones, revocando, onRevocar }: { conexiones: ConexionOauthVista[]; revocando: string | null; onRevocar: (id: string, nombre: string) => void }) {
  return <ul className="divide-y">{conexiones.map((conexion) => <li key={conexion.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{conexion.clienteNombre}</p><Badge variant="exito">Activa</Badge></div><p className="mt-1 text-xs text-muted-foreground">{conexion.scopeEtiqueta} · Conectada <span className="cifra">{conexion.creado}</span> · Último uso: <span className="cifra">{conexion.ultimoUso}</span> · {conexion.vence}</p></div>
    <Button type="button" size="sm" variant="destructive" disabled={revocando === conexion.id} onClick={() => onRevocar(conexion.id, conexion.clienteNombre)}><Unplug aria-hidden />{revocando === conexion.id ? "Desconectando..." : "Desconectar"}</Button>
  </li>)}</ul>;
}

function DatoCopiable({ etiqueta, valor, onCopiar }: { etiqueta: string; valor: string; onCopiar: () => void }) {
  return <div className="space-y-1"><p className="text-xs font-medium">{etiqueta}</p><div className="flex items-start gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-background p-2 text-xs">{valor}</code><Button type="button" size="icon-sm" variant="outline" onClick={onCopiar} aria-label={`Copiar ${etiqueta.toLowerCase()}`}><Copy aria-hidden /></Button></div></div>;
}
