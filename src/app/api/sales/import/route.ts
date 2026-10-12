import { NextResponse } from "next/server";
import { requireActor } from "@/lib/server/auth";
import { loadWorkspace, mutateWorkspace } from "@/lib/server/store";
import { assertSameOrigin, errorResponse, rateLimit } from "@/lib/server/http";
import { MAX_CSV_BYTES, parseSalesCsv } from "@/lib/csv";
import { assertPermission, DomainError } from "@/lib/workflow";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const { workspace } = await loadWorkspace(actor);
    assertPermission(actor, "sales.import");
    rateLimit(`import:${actor.id}`, 8);
    if (!request.headers.get("content-type")?.includes("multipart/form-data"))
      throw new DomainError("Upload a CSV file.", 415);
    // Bound the entire multipart body, including uploads with no Content-Length.
    const limit = MAX_CSV_BYTES + 64 * 1024;
    if (Number(request.headers.get("content-length") || 0) > limit)
      throw new DomainError("CSV files are limited to 2 MB.", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new DomainError("A file is required.");
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > limit) {
        await reader.cancel();
        throw new DomainError("CSV files are limited to 2 MB.", 413);
      }
      chunks.push(value);
    }
    const bounded = new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type")! },
      body: Buffer.concat(chunks),
    });
    const form = await bounded.formData(),
      file = form.get("file"),
      revision = Number(form.get("revision"));
    if (!Number.isInteger(revision) || revision < 0)
      throw new DomainError("Invalid workspace revision.");
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith(".csv") ||
      file.size > MAX_CSV_BYTES
    )
      throw new DomainError("Upload a .csv file no larger than 2 MB.");
    const options = z
      .object({
        mapping: z
          .object({
            purchaseId: z.string().max(150).optional(),
            productName: z.string().max(150).optional(),
            gross: z.string().max(150).optional(),
            currency: z.string().max(150).optional(),
            date: z.string().max(150).optional(),
            refunded: z.string().max(150).optional(),
            refund: z.string().max(150).optional(),
          })
          .optional(),
        defaultCurrency: z
          .string()
          .regex(/^[A-Z]{3}$/)
          .optional(),
        sourceTimezone: z.enum(["UTC", "America/Jamaica"]).optional(),
      })
      .parse({
        mapping: Object.fromEntries(
          [
            "purchaseId",
            "productName",
            "gross",
            "currency",
            "date",
            "refunded",
            "refund",
          ].map((key) => [
            key,
            String(form.get(`map.${key}`) || "") || undefined,
          ]),
        ),
        defaultCurrency:
          String(form.get("defaultCurrency") || "").toUpperCase() || undefined,
        sourceTimezone: String(form.get("sourceTimezone") || "") || undefined,
      });
    const sales = parseSalesCsv(
      await file.text(),
      workspace.products,
      new Date(),
      options,
    );
    return NextResponse.json(
      await mutateWorkspace(actor, { type: "sales.import", sales }, revision),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
