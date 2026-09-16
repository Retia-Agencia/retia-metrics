import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * El migrador de drizzle solo aplica una migracion si su `when` es mayor que el de
 * la ultima aplicada en la base. Si el journal no crece en orden, una migracion
 * puede quedar saltada para siempre sin ningun error (paso con 0002 y 0003 el
 * 16-sep, antes de llegar a Neon).
 */
const journal = JSON.parse(
  fs.readFileSync(fileURLToPath(new URL("../drizzle/meta/_journal.json", import.meta.url)), "utf8"),
) as { entries: { idx: number; when: number; tag: string }[] };

describe("journal de migraciones", () => {
  it("cada migracion tiene un when mayor que la anterior", () => {
    const desordenadas = journal.entries
      .slice(1)
      .filter((e, i) => e.when <= journal.entries[i].when)
      .map((e) => e.tag);
    expect(desordenadas).toEqual([]);
  });
});
