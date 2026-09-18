"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fecha as formatoFecha, monto as formatoMonto } from "@/lib/format";
import { ProductoCrearEnLinea } from "@/components/producto-crear-en-linea";
import type { PersonaEncontrada, VentaDePersona } from "@/lib/queries/personas";
import {
  buscarPersonasAccion,
  crearPersonaAccion,
  registrarAbonoAccion,
  registrarLlamadaAccion,
  tomarPersonaAccion,
  ventasDePersonaAccion,
  type EntradaRegistroLlamadaUI,
  type ResultadoAccion,
} from "@/app/(app)/mi-dia/acciones";

/**
 * Pantalla de registro de `/mi-dia` (ticket 003, ADR 0003, 0015, 0016, 0021).
 *
 * No consulta ni calcula nada: recibe el contexto por props (programas con sus
 * productos activos, y los motivos, origenes y plataformas activos) y llama server
 * actions. La barrera de rol y de acceso por programa se enforza en el servidor.
 *
 * La busqueda de personas se hace con una server action y el texto en estado LOCAL,
 * nunca en la URL: es un dato personal (correo, nombre) y AGENTS.md prohibe datos
 * personales en URLs y query strings.
 *
 * Cada resultado de llamada muestra SOLO sus campos (tabla del ADR 0015): fecha de
 * seguimiento en `reagendada`/`compromiso_pago`, motivo en `perdida`, venta + primer
 * abono en `cerrada`. Todo monto se muestra con su moneda al lado (`monto` de
 * `lib/format`); las fechas con `fecha`.
 */

interface ProductoCtx {
  id: string;
  nombre: string;
  precioLista: string;
  moneda: string;
}
interface ProgramaCtx {
  id: string;
  nombre: string;
  productos: ProductoCtx[];
}
interface OpcionCtx {
  id: string;
  nombre: string;
}

export interface ContextoMiDia {
  programas: ProgramaCtx[];
  motivos: OpcionCtx[];
  origenes: OpcionCtx[];
  plataformas: OpcionCtx[];
}

/** Los 8 resultados del enum (ADR 0015), con su etiqueta legible. */
const RESULTADOS: { valor: EntradaRegistroLlamadaUI["resultado"]; etiqueta: string }[] = [
  { valor: "agendada", etiqueta: "Agendada" },
  { valor: "show", etiqueta: "Show" },
  { valor: "no_show", etiqueta: "No show" },
  { valor: "cancelada", etiqueta: "Cancelada" },
  { valor: "reagendada", etiqueta: "Reagendada" },
  { valor: "compromiso_pago", etiqueta: "Compromiso de pago" },
  { valor: "cerrada", etiqueta: "Cerrada (venta)" },
  { valor: "perdida", etiqueta: "Perdida" },
];

const claseInput =
  "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-muted-foreground">{etiqueta}</span>
      {children}
    </label>
  );
}

export function MiDiaRegistro({ contexto }: { contexto: ContextoMiDia }) {
  const [seleccionada, setSeleccionada] = useState<PersonaEncontrada | null>(null);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <Buscador onSeleccionar={setSeleccionada} />
        <CrearPersona contexto={contexto} />
      </div>

      {seleccionada ? (
        <RegistroDePersona
          key={seleccionada.id}
          contexto={contexto}
          persona={seleccionada}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Busca y selecciona una persona para registrar su llamada.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────── buscador

function Buscador({
  onSeleccionar,
}: {
  onSeleccionar: (p: PersonaEncontrada) => void;
}) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<PersonaEncontrada[]>([]);
  const [buscado, setBuscado] = useState(false);
  const [pendiente, startTransition] = useTransition();

  function buscar() {
    startTransition(async () => {
      const res = await buscarPersonasAccion(texto);
      if (res.ok) {
        setResultados(res.personas);
        setBuscado(true);
      } else {
        toast.error("No se pudo buscar", { description: res.error });
      }
    });
  }

  function tomar(p: PersonaEncontrada) {
    startTransition(async () => {
      const res = await tomarPersonaAccion(p.id);
      if (res.ok) {
        toast.success("Persona asignada a ti");
        buscar();
      } else {
        toast.error("No se pudo tomar la persona", { description: res.error });
      }
    });
  }

  return (
    <section className="space-y-3 rounded-md border p-4">
      <h2 className="text-sm font-semibold">Buscar persona</h2>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          buscar();
        }}
      >
        <div className="flex-1">
          <Campo etiqueta="Nombre o correo">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className={claseInput}
              aria-label="Buscar por nombre o correo"
              placeholder="Al menos 2 caracteres"
            />
          </Campo>
        </div>
        <Button type="submit" size="sm" disabled={pendiente || texto.trim().length < 2}>
          Buscar
        </Button>
      </form>

      <ul className="space-y-2">
        {resultados.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
          >
            <div>
              <div className="font-medium">{p.nombre ?? "Sin nombre"}</div>
              <div className="text-muted-foreground">{p.emailNormalizado}</div>
              <div className="text-xs text-muted-foreground">
                {p.programaNombre} ·{" "}
                {p.responsableCloserId
                  ? `Responsable: ${p.responsableCloserId}`
                  : "sin responsable"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {p.responsableCloserId ? null : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pendiente}
                  onClick={() => tomar(p)}
                >
                  Tomar persona
                </Button>
              )}
              <Button size="sm" onClick={() => onSeleccionar(p)}>
                Registrar
              </Button>
            </div>
          </li>
        ))}
        {buscado && resultados.length === 0 ? (
          <li className="text-sm text-muted-foreground">Sin resultados.</li>
        ) : null}
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────────────────── crear persona

function CrearPersona({ contexto }: { contexto: ContextoMiDia }) {
  const [programId, setProgramId] = useState(contexto.programas[0]?.id ?? "");
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pendiente, startTransition] = useTransition();

  function limpiar() {
    setCorreo("");
    setNombre("");
    setTelefono("");
  }

  function guardar() {
    startTransition(async () => {
      const res = await crearPersonaAccion({
        programId,
        correo,
        nombre: nombre.trim() || undefined,
        telefono: telefono.trim() || undefined,
      });
      if (res.ok) {
        toast.success("Persona creada");
        limpiar();
      } else {
        toast.error("No se pudo crear", { description: res.error });
      }
    });
  }

  if (contexto.programas.length === 0) {
    return (
      <section className="rounded-md border p-4 text-sm text-muted-foreground">
        No tienes programas asignados donde crear personas.
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-md border p-4">
      <h2 className="text-sm font-semibold">Crear persona</h2>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <Campo etiqueta="Programa">
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className={claseInput}
            aria-label="Programa"
          >
            {contexto.programas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Correo (obligatorio)">
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
            className={claseInput}
            aria-label="Correo"
          />
        </Campo>
        <Campo etiqueta="Nombre (opcional)">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={claseInput}
            aria-label="Nombre"
          />
        </Campo>
        <Campo etiqueta="Teléfono (opcional)">
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className={claseInput}
            aria-label="Teléfono"
          />
        </Campo>
        <Button type="submit" size="sm" disabled={pendiente || !correo.trim()}>
          Crear persona
        </Button>
      </form>
    </section>
  );
}

// ─────────────────────────────────────────────────────── registro de llamada

function RegistroDePersona({
  contexto,
  persona,
}: {
  contexto: ContextoMiDia;
  persona: PersonaEncontrada;
}) {
  const programa = contexto.programas.find((p) => p.id === persona.programId);

  return (
    <section className="space-y-6 rounded-md border p-4">
      <header>
        <h2 className="text-sm font-semibold">
          Registro sobre {persona.nombre ?? persona.emailNormalizado}
        </h2>
        <p className="text-xs text-muted-foreground">
          {persona.emailNormalizado} · {persona.programaNombre}
        </p>
      </header>

      <FormularioLlamada contexto={contexto} persona={persona} programa={programa} />
      <AbonosDePersona persona={persona} contexto={contexto} />
    </section>
  );
}

function FormularioLlamada({
  contexto,
  persona,
  programa,
}: {
  contexto: ContextoMiDia;
  persona: PersonaEncontrada;
  programa: ProgramaCtx | undefined;
}) {
  const [resultado, setResultado] =
    useState<EntradaRegistroLlamadaUI["resultado"]>("show");
  const [origenId, setOrigenId] = useState("");
  const [notas, setNotas] = useState("");
  const [fechaSeguimiento, setFechaSeguimiento] = useState("");
  const [motivoId, setMotivoId] = useState("");
  // Venta (solo en cerrada).
  const [productoId, setProductoId] = useState("");
  const [precioAplicado, setPrecioAplicado] = useState("");
  const [fechaAbono, setFechaAbono] = useState("");
  const [montoAbono, setMontoAbono] = useState("");
  const [plataformaId, setPlataformaId] = useState("");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [pendiente, startTransition] = useTransition();

  const productos = programa?.productos ?? [];

  function limpiar() {
    setResultado("show");
    setOrigenId("");
    setNotas("");
    setFechaSeguimiento("");
    setMotivoId("");
    setProductoId("");
    setPrecioAplicado("");
    setFechaAbono("");
    setMontoAbono("");
    setPlataformaId("");
    setComprobanteUrl("");
  }

  function guardar() {
    const entrada: EntradaRegistroLlamadaUI = {
      programId: persona.programId,
      personId: persona.id,
      emailLead: persona.emailNormalizado,
      resultado,
      origenId: origenId || undefined,
      notas: notas.trim() || undefined,
      fechaSeguimiento: fechaSeguimiento || undefined,
      motivoId: motivoId || undefined,
      venta:
        resultado === "cerrada"
          ? {
              productoId,
              precioAplicadoUsd: precioAplicado,
              fecha: fechaAbono,
              monto: montoAbono,
              moneda: "USD",
              plataformaId: plataformaId || undefined,
              comprobanteUrl: comprobanteUrl.trim() || undefined,
            }
          : undefined,
    };

    startTransition(async () => {
      const res: ResultadoAccion = await registrarLlamadaAccion(entrada);
      if (res.ok) {
        toast.success("Llamada registrada");
        limpiar();
      } else {
        toast.error("No se pudo registrar", { description: res.error });
      }
    });
  }

  const pideSeguimiento = resultado === "reagendada" || resultado === "compromiso_pago";
  const pideMotivo = resultado === "perdida";
  const pideVenta = resultado === "cerrada";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Resultado">
          <select
            value={resultado}
            onChange={(e) =>
              setResultado(e.target.value as EntradaRegistroLlamadaUI["resultado"])
            }
            className={claseInput}
            aria-label="Resultado"
          >
            {RESULTADOS.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Origen">
          <select
            value={origenId}
            onChange={(e) => setOrigenId(e.target.value)}
            className={claseInput}
            aria-label="Origen"
          >
            <option value="">Sin especificar</option>
            {contexto.origenes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {pideSeguimiento ? (
        <Campo etiqueta="Fecha de seguimiento">
          <input
            type="date"
            value={fechaSeguimiento}
            onChange={(e) => setFechaSeguimiento(e.target.value)}
            required
            className={claseInput}
            aria-label="Fecha de seguimiento"
          />
        </Campo>
      ) : null}

      {pideMotivo ? (
        <Campo etiqueta="Motivo de pérdida">
          <select
            value={motivoId}
            onChange={(e) => setMotivoId(e.target.value)}
            required
            className={claseInput}
            aria-label="Motivo de pérdida"
          >
            <option value="">Elige un motivo</option>
            {contexto.motivos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </Campo>
      ) : null}

      {pideVenta ? (
        <fieldset className="space-y-3 rounded-md border p-3">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            Venta y primer abono
          </legend>

          <div className="space-y-2">
            <Campo etiqueta="Producto">
              <select
                value={productoId}
                onChange={(e) => setProductoId(e.target.value)}
                required
                className={claseInput}
                aria-label="Producto"
              >
                <option value="">Elige un producto</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {formatoMonto(Number(p.precioLista), p.moneda)}
                  </option>
                ))}
              </select>
            </Campo>
            {/* Crear producto EN LINEA (ADR 0016): tras crear queda seleccionado.
                No recibimos el id del nuevo producto desde la accion existente, asi
                que se refresca el contexto del servidor para traerlo a la lista. */}
            <ProductoCrearEnLinea programId={persona.programId} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Precio aplicado (USD)">
              <input
                value={precioAplicado}
                onChange={(e) => setPrecioAplicado(e.target.value)}
                inputMode="decimal"
                required
                className={claseInput}
                aria-label="Precio aplicado"
              />
            </Campo>
            <Campo etiqueta="Fecha del abono">
              <input
                type="date"
                value={fechaAbono}
                onChange={(e) => setFechaAbono(e.target.value)}
                required
                className={claseInput}
                aria-label="Fecha del abono"
              />
            </Campo>
            <Campo etiqueta="Monto del abono (USD)">
              <input
                value={montoAbono}
                onChange={(e) => setMontoAbono(e.target.value)}
                inputMode="decimal"
                required
                className={claseInput}
                aria-label="Monto del abono"
              />
            </Campo>
            <Campo etiqueta="Plataforma">
              <select
                value={plataformaId}
                onChange={(e) => setPlataformaId(e.target.value)}
                className={claseInput}
                aria-label="Plataforma"
              >
                <option value="">Sin especificar</option>
                {contexto.plataformas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Campo etiqueta="Comprobante (URL, opcional)">
            <input
              value={comprobanteUrl}
              onChange={(e) => setComprobanteUrl(e.target.value)}
              className={claseInput}
              aria-label="Comprobante"
            />
          </Campo>
        </fieldset>
      ) : null}

      <Campo etiqueta="Nota">
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className={`${claseInput} h-20 py-2`}
          aria-label="Nota"
        />
      </Campo>

      <Button type="submit" size="sm" disabled={pendiente}>
        Registrar llamada
      </Button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────── abonos

function AbonosDePersona({
  persona,
  contexto,
}: {
  persona: PersonaEncontrada;
  contexto: ContextoMiDia;
}) {
  const [ventas, setVentas] = useState<VentaDePersona[] | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cargar() {
    startTransition(async () => {
      const res = await ventasDePersonaAccion(persona.id);
      if (res.ok) setVentas(res.ventas);
      else toast.error("No se pudieron cargar las ventas", { description: res.error });
    });
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ventas y abonos</h3>
        <Button size="sm" variant="outline" disabled={pendiente} onClick={cargar}>
          {ventas === null ? "Ver ventas" : "Recargar"}
        </Button>
      </div>

      {ventas !== null && ventas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta persona no tiene ventas.</p>
      ) : null}

      <ul className="space-y-3">
        {(ventas ?? []).map((v) => (
          <li key={v.saleId} className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">{v.productoNombre ?? "Venta sin producto"}</span>
              <span className="text-muted-foreground">
                {v.fecha ? formatoFecha(v.fecha) : "sin fecha"}
              </span>
            </div>
            <div className="mt-1 text-muted-foreground">
              Abonado: {formatoMonto(Number(v.abonado), v.moneda)} ·{" "}
              {v.saldo === null
                ? "saldo: — (venta sin precio de contrato)"
                : `saldo: ${formatoMonto(Number(v.saldo), v.moneda)}`}
            </div>
            <FormularioAbono
              venta={v}
              contexto={contexto}
              alGuardar={cargar}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FormularioAbono({
  venta,
  contexto,
  alGuardar,
}: {
  venta: VentaDePersona;
  contexto: ContextoMiDia;
  alGuardar: () => void;
}) {
  const [fecha, setFecha] = useState("");
  const [montoTxt, setMontoTxt] = useState("");
  const [plataformaId, setPlataformaId] = useState("");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [pendiente, startTransition] = useTransition();

  function guardar(confirmarSobrepago: boolean) {
    startTransition(async () => {
      const res = await registrarAbonoAccion({
        saleId: venta.saleId,
        fecha,
        monto: montoTxt,
        moneda: "USD",
        plataformaId: plataformaId || undefined,
        comprobanteUrl: comprobanteUrl.trim() || undefined,
        confirmarSobrepago,
      });
      if (res.ok) {
        toast.success("Abono registrado");
        setFecha("");
        setMontoTxt("");
        setPlataformaId("");
        setComprobanteUrl("");
        alGuardar();
      } else {
        // Si el error es de sobrepago, se ofrece confirmar y reenviar.
        const esSobrepago = /sobrepago/i.test(res.error);
        toast.error("No se pudo registrar el abono", {
          description: res.error,
          action: esSobrepago
            ? {
                label: "Confirmar sobrepago",
                onClick: () => guardar(true),
              }
            : undefined,
        });
      }
    });
  }

  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        guardar(false);
      }}
    >
      <Campo etiqueta="Fecha">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          required
          className={claseInput}
          aria-label="Fecha del abono"
        />
      </Campo>
      <Campo etiqueta="Monto (USD)">
        <input
          value={montoTxt}
          onChange={(e) => setMontoTxt(e.target.value)}
          inputMode="decimal"
          required
          className={claseInput}
          aria-label="Monto del abono"
        />
      </Campo>
      <Campo etiqueta="Plataforma">
        <select
          value={plataformaId}
          onChange={(e) => setPlataformaId(e.target.value)}
          className={claseInput}
          aria-label="Plataforma del abono"
        >
          <option value="">Sin especificar</option>
          {contexto.plataformas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Button type="submit" size="sm" disabled={pendiente || !montoTxt.trim() || !fecha}>
        Registrar abono
      </Button>
    </form>
  );
}
