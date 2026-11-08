import type { McpServer } from "@modelcontextprotocol/server";
import { ZodError, z } from "zod";
import { ErrorDeApp } from "@/lib/errors";
import { codigoDeEntradaInvalida, registrarLlamada, segundosDeEspera } from "./bitacora";
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
      codigo: codigoDeEntradaInvalida(error),
    };
  }
  console.error("[mcp: error no controlado]", error);
  return { mensaje: "Error interno.", resultado: "error", codigo: "INTERNO" };
}

/** El esquema que el servidor valida y publica: el de la herramienta más `vista`, sin claves extra. */
function esquemaDeEntrada<E extends z.ZodObject>(herramienta: Herramienta<E>) {
  return herramienta.entrada.extend({ vista: z.string().optional() }).strict();
}

function registrarUna<E extends z.ZodObject>(
  server: McpServer,
  herramienta: Herramienta<E>,
  contextoBase: ContextoMcp,
): void {
  const entradaComun = esquemaDeEntrada(herramienta);
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

/**
 * El SDK valida la entrada contra el esquema ANTES de llamar al handler, así que un rechazo (un
 * `periodo: "octubre"`) nunca llegaba a `mcp_llamadas` (ticket 400). Se envuelve ese paso: si falla,
 * se anota quién, qué herramienta y qué campos, y el error original sigue su camino sin cambios.
 * ponytail: `validateToolInput` es un método del SDK sin contrato público; si una versión nueva lo
 * mueve, `tests/mcp-rechazos.test.ts` falla (la fila no aparece) y se cambia por el gancho que traiga.
 */
function auditarRechazosDeEntrada(
  server: McpServer,
  contexto: ContextoMcp,
  porNombre: Map<string, Herramienta<z.ZodObject>>,
): void {
  const original = (server as unknown as {
    validateToolInput: (tool: unknown, args: unknown, nombre: string) => Promise<unknown>;
  }).validateToolInput;
  if (typeof original !== "function") {
    throw new Error("El SDK del MCP ya no expone validateToolInput: no se pueden auditar los rechazos.");
  }
  (server as unknown as { validateToolInput: typeof original }).validateToolInput = async function (
    this: unknown,
    tool,
    args,
    nombre,
  ) {
    const inicio = Date.now();
    try {
      return await original.call(server, tool, args, nombre);
    } catch (error) {
      const herramienta = porNombre.get(nombre);
      if (herramienta) {
        const analisis = esquemaDeEntrada(herramienta).safeParse(args ?? {});
        try {
          await registrarLlamada(contexto.db, {
            tokenId: contexto.tokenId,
            userId: contexto.session.user.id,
            userIdVista: null,
            herramienta: nombre,
            programId: null,
            resultado: "error",
            codigoError: analisis.success ? "ENTRADA_INVALIDA" : codigoDeEntradaInvalida(analisis.error),
            duracionMs: Date.now() - inicio,
            cliente: clienteDe(server),
          });
        } catch (falloDeBitacora) {
          console.error("[mcp: no se pudo anotar el rechazo]", falloDeBitacora);
        }
      }
      throw error;
    }
  };
}

export function registrarHerramientas(server: McpServer, contexto: ContextoMcp): void {
  const herramientas = herramientasPara(contexto);
  auditarRechazosDeEntrada(
    server,
    contexto,
    new Map(herramientas.map((herramienta) => [herramienta.nombre, herramienta as Herramienta<z.ZodObject>])),
  );
  for (const herramienta of herramientas) {
    registrarUna(server, herramienta, contexto);
  }
}
