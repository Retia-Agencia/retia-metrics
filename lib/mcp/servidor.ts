import type { McpServer } from "@modelcontextprotocol/server";
import { ZodError, z } from "zod";
import { ErrorDeApp } from "@/lib/errors";
import { registrarLlamada, segundosDeEspera } from "./bitacora";
import { herramientasPara } from "./herramientas";
import type { ContextoMcp, Herramienta } from "./herramientas/tipos";
import { sesionDeToken } from "./sesion";

function clienteDe(server: McpServer): string | null {
  const cliente = server.server.getClientVersion();
  return cliente ? `${cliente.name} ${cliente.version}` : null;
}

function respuestaDeFalla(error: unknown): {
  mensaje: string;
  resultado: "error" | "denegado";
  codigo: string;
} {
  if (error instanceof ErrorDeApp) {
    return {
      mensaje: error.message,
      resultado: error.status === 401 || error.status === 403 || error.status === 404
        ? "denegado"
        : "error",
      codigo: `APP_${error.status}`,
    };
  }
  if (error instanceof ZodError) {
    return {
      mensaje: error.issues[0]?.message ?? "Petición inválida.",
      resultado: "error",
      codigo: "ENTRADA_INVALIDA",
    };
  }
  console.error("[mcp: error no controlado]", error);
  return { mensaje: "Error interno.", resultado: "error", codigo: "INTERNO" };
}

function registrarUna<E extends z.ZodObject>(
  server: McpServer,
  herramienta: Herramienta<E>,
  contextoBase: ContextoMcp,
): void {
  const entradaComun = herramienta.entrada.extend({ vista: z.string().optional() }).strict();
  server.registerTool(
    herramienta.nombre,
    {
      description: herramienta.descripcion,
      inputSchema: entradaComun,
      annotations: { readOnlyHint: herramienta.soloLectura },
    },
    async (argumentos) => {
      const inicio = Date.now();
      const ahora = new Date();
      const cliente = clienteDe(server);
      const espera = await segundosDeEspera(contextoBase.db, contextoBase.tokenId, ahora);
      if (espera !== null) {
        const mensaje = `Muchas consultas seguidas: espera ${espera} segundos.`;
        await registrarLlamada(contextoBase.db, {
          tokenId: contextoBase.tokenId,
          userId: contextoBase.session.user.id,
          userIdVista: null,
          herramienta: herramienta.nombre,
          programId: null,
          resultado: "tope",
          codigoError: "TOPE",
          duracionMs: Date.now() - inicio,
          cliente,
        });
        return { isError: true, content: [{ type: "text", text: mensaje }] };
      }

      let userIdVista: string | null = null;
      let resultado: "ok" | "error" | "denegado" = "ok";
      let codigoError: string | null = null;
      let respuesta;
      try {
        const { vista: vistaCruda, ...propios } = argumentos;
        const vista = typeof vistaCruda === "string" ? vistaCruda : undefined;
        const sesion = await sesionDeToken(contextoBase.db, {
          userId: contextoBase.session.user.id,
          scope: contextoBase.escritura ? "escritura" : "lectura",
          vista,
        });
        userIdVista = sesion.session.user.suplantadoPor ? sesion.session.user.id : null;
        const contexto: ContextoMcp = {
          ...contextoBase,
          session: sesion.session,
          rol: sesion.rol,
          escritura: sesion.escritura,
        };
        const entrada = herramienta.entrada.parse(propios);
        const salida = await herramienta.ejecutar(contexto, entrada);
        respuesta = {
          content: [{ type: "text" as const, text: salida.texto }],
          structuredContent: salida.estructurado,
        };
      } catch (error) {
        const falla = respuestaDeFalla(error);
        resultado = falla.resultado;
        codigoError = falla.codigo;
        respuesta = {
          isError: true,
          content: [{ type: "text" as const, text: falla.mensaje }],
        };
      }

      // ponytail: Next `after()` requiere un contexto de request de Next y rompe la
      // invocación directa del adaptador en tests. Por ahora se espera este INSERT;
      // moverlo a una cola durable cuando el volumen haga visible este techo.
      await registrarLlamada(contextoBase.db, {
        tokenId: contextoBase.tokenId,
        userId: contextoBase.session.user.id,
        userIdVista,
        herramienta: herramienta.nombre,
        programId: null,
        resultado,
        codigoError,
        duracionMs: Date.now() - inicio,
        cliente,
      });
      return respuesta;
    },
  );
}

export function registrarHerramientas(server: McpServer, contexto: ContextoMcp): void {
  for (const herramienta of herramientasPara(contexto)) {
    registrarUna(server, herramienta, contexto);
  }
}
