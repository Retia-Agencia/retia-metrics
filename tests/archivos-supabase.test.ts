import { afterEach, describe, expect, it, vi } from "vitest";
import { crearAlmacenSupabase } from "@/lib/archivos/supabase";

const BASE = "https://proyecto.supabase.co";
const CLAVE = "clave-super-secreta";
const RUTA = "programa/2026-10/archivo.pdf";

afterEach(() => vi.unstubAllGlobals());

describe("almacén Supabase REST", () => {
  it("firma la subida con autenticación y devuelve la URL completa", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ url: "/object/upload/signada" }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const salida = await crearAlmacenSupabase(BASE, CLAVE).urlDeSubida(RUTA, "application/pdf");
    expect(fetch).toHaveBeenCalledWith(`${BASE}/storage/v1/object/upload/sign/comprobantes/${RUTA}`, {
      method: "POST",
      headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}` },
    });
    expect(salida).toEqual({
      url: `${BASE}/storage/v1/object/upload/signada`,
      metodo: "PUT",
      cabeceras: { "content-type": "application/pdf" },
    });
  });

  it("lee bytes y convierte 400/404 en ausencia", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(Uint8Array.from([1, 2, 3]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    const almacen = crearAlmacenSupabase(BASE, CLAVE);
    expect(await almacen.leer(RUTA)).toEqual(Uint8Array.from([1, 2, 3]));
    expect(await almacen.leer(RUTA)).toBeNull();
    expect(fetch.mock.calls[0]).toEqual([
      `${BASE}/storage/v1/object/authenticated/comprobantes/${RUTA}`,
      { method: "GET", headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}` } },
    ]);
  });

  it("firma lectura y borra por prefijo", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ signedURL: "/object/firmado" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const almacen = crearAlmacenSupabase(BASE, CLAVE);
    expect(await almacen.urlDeLectura(RUTA, 60)).toBe(`${BASE}/storage/v1/object/firmado`);
    await almacen.borrar(RUTA);
    expect(fetch.mock.calls[0]).toEqual([
      `${BASE}/storage/v1/object/sign/comprobantes/${RUTA}`,
      expect.objectContaining({ method: "POST", body: JSON.stringify({ expiresIn: 60 }) }),
    ]);
    expect(fetch.mock.calls[1]).toEqual([
      `${BASE}/storage/v1/object/comprobantes`,
      expect.objectContaining({ method: "DELETE", body: JSON.stringify({ prefixes: [RUTA] }) }),
    ]);
  });

  it("los errores llevan el estado pero nunca la clave", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    const promesa = crearAlmacenSupabase(BASE, CLAVE).leer(RUTA);
    await expect(promesa).rejects.toThrow("estado 500");
    await expect(promesa).rejects.not.toThrow(CLAVE);
  });
});
