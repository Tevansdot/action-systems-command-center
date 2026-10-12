import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Actor } from "../model";
import { DomainError } from "../workflow";

const COOKIE = "action-systems-demo";
export function hasSupabase() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}
export function demoEnabled() {
  return !hasSupabase() && process.env.DEMO_MODE !== "false";
}
export const localDirectory = () =>
  path.resolve(
    /*turbopackIgnore: true*/ process.env.COMMAND_CENTER_DATA_DIR || ".local",
  );
let secretPromise: Promise<string> | undefined;
async function signingSecret() {
  if (process.env.COMMAND_CENTER_SESSION_SECRET) {
    if (process.env.COMMAND_CENTER_SESSION_SECRET.length < 32)
      throw new DomainError(
        "The session signing secret must contain at least 32 characters.",
        503,
      );
    return process.env.COMMAND_CENTER_SESSION_SECRET;
  }
  if (!secretPromise)
    secretPromise = (async () => {
      await mkdir(localDirectory(), { recursive: true, mode: 0o700 });
      const file = path.join(localDirectory(), "session-key");
      try {
        return await readFile(file, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const key = randomBytes(48).toString("hex");
      try {
        await writeFile(file, key, { mode: 0o600, flag: "wx" });
        return key;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        return readFile(file, "utf8");
      }
    })();
  return secretPromise;
}
export async function supabaseServer() {
  if (!hasSupabase()) throw new DomainError("Supabase is not configured.", 503);
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(items) {
          for (const { name, value, options } of items) {
            try {
              jar.set(name, value, options);
            } catch {
              /* Server Components cannot write; auth route handlers refresh cookies. */
            }
          }
        },
      },
    },
  );
}
export async function openDemoSession() {
  if (!demoEnabled()) throw new DomainError("Demo mode is disabled.", 403);
  const payload = Buffer.from(
    JSON.stringify({
      id: randomUUID(),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", await signingSecret())
    .update(payload)
    .digest("base64url");
  (await cookies()).set(COOKIE, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}
export async function closeSession() {
  (await cookies()).delete(COOKIE);
  if (hasSupabase()) await (await supabaseServer()).auth.signOut();
}
export async function currentActor(): Promise<Actor | null> {
  if (hasSupabase()) {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) return null;
    return {
      id: data.user.id,
      name: String(
        data.user.user_metadata?.full_name || data.user.email || "Team member",
      ).slice(0, 100),
      mode: "live",
      role: "viewer",
    };
  }
  if (!demoEnabled()) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", await signingSecret())
      .update(payload)
      .digest(),
    actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      !/^[0-9a-f-]{36}$/.test(parsed.id) ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Date.now()
    )
      return null;
    return { id: parsed.id, name: "Demo owner", role: "owner", mode: "demo" };
  } catch {
    return null;
  }
}
export async function requireActor() {
  const actor = await currentActor();
  if (!actor) throw new DomainError("Please sign in to continue.", 401);
  return actor;
}
