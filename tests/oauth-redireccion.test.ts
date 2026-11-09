import { describe, expect, it } from "vitest";
import { coincideRedireccion, esRedireccionPermitida } from "@/lib/oauth/redireccion";

describe("redirect_uri OAuth", () => {
  it("compara exactamente las redirecciones https", () => {
    expect(coincideRedireccion("https://cliente.test/callback", ["https://cliente.test/callback"])).toBe(true);
    expect(coincideRedireccion("https://cliente.test/callback?x=1", ["https://cliente.test/callback"])).toBe(false);
  });

  it("acepta localhost con puerto contra localhost sin puerto", () => {
    expect(coincideRedireccion("http://localhost:43123/callback", ["http://localhost/callback"])).toBe(true);
  });

  it("considera equivalentes los hosts loopback e ignora solo el puerto", () => {
    expect(coincideRedireccion("http://localhost:43123/callback", ["http://127.0.0.1/callback"])).toBe(true);
    expect(coincideRedireccion("http://[::1]:43123/callback", ["http://localhost/callback"])).toBe(true);
    expect(coincideRedireccion("http://localhost:43123/otro", ["http://127.0.0.1/callback"])).toBe(false);
  });

  it("solo permite https o http loopback", () => {
    expect(esRedireccionPermitida("https://cliente.test/callback")).toBe(true);
    expect(esRedireccionPermitida("http://127.0.0.1:3000/callback")).toBe(true);
    expect(esRedireccionPermitida("http://cliente.test/callback")).toBe(false);
  });
});
