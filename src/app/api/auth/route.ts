import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertSameOrigin,
  errorResponse,
  limitedJson,
  rateLimit,
} from "@/lib/server/http";
import {
  closeSession,
  hasSupabase,
  openDemoSession,
  supabaseServer,
} from "@/lib/server/auth";
import { DomainError } from "@/lib/workflow";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await limitedJson(request);
    const action = z
      .enum(["demo", "login", "signup", "logout"])
      .parse(body.action);
    if (action === "logout") await closeSession();
    else if (action === "demo") {
      rateLimit("demo-sessions", 100);
      await openDemoSession();
    } else {
      if (!hasSupabase())
        throw new DomainError(
          "Supabase login is not configured. Use the demo workspace.",
          503,
        );
      const input = z
        .object({
          email: z.email().max(254),
          password: z.string().min(10).max(128),
        })
        .parse(body);
      rateLimit(`auth:${input.email.toLowerCase()}`, 8);
      const sb = await supabaseServer();
      const result =
        action === "signup"
          ? await sb.auth.signUp({
              email: input.email,
              password: input.password,
            })
          : await sb.auth.signInWithPassword(input);
      if (result.error)
        throw new DomainError(
          action === "signup"
            ? "Account could not be created. Check your email and password, or try signing in."
            : "Sign-in failed. Check your details and confirm your email address.",
          400,
        );
      if (action === "signup" && !result.data.session)
        return NextResponse.json({
          confirmationRequired: true,
          message: "Check your email to confirm your account, then sign in.",
        });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
