import { z } from "zod";

const respuestaSchema = z
  .object({
    id: z.string(),
    submittedAt: z.string().datetime({ offset: true }),
    completed: z.boolean(),
    answers: z.array(z.object({}).passthrough()),
    metadata: z
      .object({
        tags: z.array(z.string()).optional(),
        score: z.number().optional(),
        hidden: z.record(z.string(), z.string()).optional(),
        variables: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough(),
  })
  .passthrough();

const paginaSchema = z.object({
  data: z.array(respuestaSchema),
  nextCursor: z.string().nullable(),
});

type RespuestaForm30x = z.infer<typeof respuestaSchema>;

/** Lee una pagina de respuestas de Form30x (ADR 0093, ticket 272). */
export async function leerRespuestas(
  formId: string,
  cursor?: string,
  opciones?: { fetch?: typeof fetch },
): Promise<{ data: RespuestaForm30x[]; nextCursor: string | null }> {
  const apiKey = process.env.FORM_30X_API_KEY;
  if (!apiKey) throw new Error("Falta FORM_30X_API_KEY.");

  const url = new URL(`https://form.30x.com/api/v1/forms/${encodeURIComponent(formId)}/responses`);
  url.searchParams.set("limit", "200");
  if (cursor !== undefined) url.searchParams.set("cursor", cursor);

  const respuesta = await (opciones?.fetch ?? fetch)(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!respuesta.ok) throw new Error(`Form30x respondió HTTP ${respuesta.status}.`);
  return paginaSchema.parse(await respuesta.json());
}
