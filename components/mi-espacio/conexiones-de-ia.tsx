"use client";

import { useEffect, useState, type FormEvent } from "react";
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

type HerramientaDeIa = "claude" | "chatgpt";
const PASOS: Record<HerramientaDeIa, { nombre: string; pasos: string[] }> = {
  claude: { nombre: "Claude", pasos: [
    "En Claude, abre Ajustes (o Personalizar) y entra a Conectores.",
    "Elige «Agregar conector personalizado».",
    "Pega la dirección de arriba y confirma.",
    "Pulsa «Conectar»: se abrirá el inicio de sesión de Google. Entra con tu cuenta de Retia.",
  ] },
  chatgpt: { nombre: "ChatGPT", pasos: [
    "En ChatGPT, abre Ajustes y entra a Aplicaciones (o Conectores).",
    "Activa el modo desarrollador en la configuración avanzada, si aún no está activo.",
    "Elige «Crear», pon un nombre (por ejemplo, Retia) y pega la dirección de arriba.",
    "Confirma: se abrirá el inicio de sesión de Google. Entra con tu cuenta de Retia.",
  ] },
};

export function ConexionesDeIa({ conexiones, tokens, scopes, direccion }: {
  direccion: string;
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
  const [herramienta, setHerramienta] = useState<HerramientaDeIa>("claude");
  const [guiaAbierta, setGuiaAbierta] = useState(false);
  const guiaVisible = conexiones.length === 0 || guiaAbierta;

  // Al volver a esta pestaña tras conectar en la IA, la lista se actualiza sola.
  useEffect(() => {
    if (!guiaVisible) return;
    const alVolver = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [guiaVisible, router]);

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
        <CardDescription>Conecta Claude o ChatGPT al CRM con tu cuenta de Google. No necesitas ninguna clave.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3" aria-labelledby="conexiones-activas">
          <h3 id="conexiones-activas" className="text-sm font-medium">Conexiones</h3>
          {conexiones.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no has conectado una IA.</p> : (
            <Lista conexiones={conexiones} revocando={revocando} onRevocar={(id, etiqueta) => revocar(id, etiqueta, true)} />
          )}
        </section>

        {conexiones.length === 0
          ? <GuiaDeConexion direccion={direccion} herramienta={herramienta} onHerramienta={setHerramienta} onCopiar={() => copiar(direccion, "Dirección copiada")} />
          : <details className="rounded-lg border border-border p-3" onToggle={(e) => setGuiaAbierta(e.currentTarget.open)}>
            <summary className="cursor-pointer text-sm font-medium">Conectar otra IA</summary>
            <div className="mt-3"><GuiaDeConexion direccion={direccion} herramienta={herramienta} onHerramienta={setHerramienta} onCopiar={() => copiar(direccion, "Dirección copiada")} /></div>
          </details>}

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

function GuiaDeConexion({ direccion, herramienta, onHerramienta, onCopiar }: { direccion: string; herramienta: HerramientaDeIa; onHerramienta: (h: HerramientaDeIa) => void; onCopiar: () => void }) {
  return <div className="space-y-3">
    <DatoCopiable etiqueta="Dirección del CRM" valor={direccion} onCopiar={onCopiar} />
    <div role="group" aria-label="Herramienta de IA" className="flex gap-2">
      {(Object.keys(PASOS) as HerramientaDeIa[]).map((clave) => <Button key={clave} type="button" size="sm" variant={herramienta === clave ? "default" : "outline"} aria-pressed={herramienta === clave} onClick={() => onHerramienta(clave)}>{PASOS[clave].nombre}</Button>)}
    </div>
    <ol className="list-decimal space-y-1 pl-5 text-sm">{PASOS[herramienta].pasos.map((paso) => <li key={paso}>{paso}</li>)}</ol>
    <p className="text-xs text-muted-foreground">Los nombres de los menús pueden cambiar un poco según tu plan. Al terminar, vuelve aquí: tu conexión aparecerá en «Conexiones».</p>
  </div>;
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
