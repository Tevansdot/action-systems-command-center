import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "../workflow";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin"),
    expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (!origin || origin !== expected)
    throw new DomainError("This request must come from the application.", 403);
}
export async function limitedJson(request: Request) {
  const limit = 64 * 1024;
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new DomainError("Send a JSON request.", 415);
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new DomainError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError("Request body is required.");
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new DomainError("Request is too large.", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DomainError("Invalid JSON.");
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof DomainError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  console.error(
    "Unexpected server error:",
    error instanceof Error ? error.name : "unknown",
  );
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
// Cost/abuse guard for a single app instance. Use a shared limiter for horizontal deployment.
const buckets = new Map<string, { count: number; expires: number }>();
export function rateLimit(key: string, max = 15, windowMs = 60_000) {
  const now = Date.now();
  if (buckets.size > 5000)
    for (const [k, v] of buckets) if (v.expires < now) buckets.delete(k);
  const current = buckets.get(key);
  if (!current || current.expires < now) {
    buckets.set(key, { count: 1, expires: now + windowMs });
    return;
  }
  if (current.count >= max)
    throw new DomainError(
      "Too many requests. Please wait a minute and retry.",
      429,
    );
  current.count++;
}
