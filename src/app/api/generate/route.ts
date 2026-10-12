import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActor } from "@/lib/server/auth";
import { loadWorkspace, mutateWorkspace } from "@/lib/server/store";
import {
  assertSameOrigin,
  errorResponse,
  limitedJson,
  rateLimit,
} from "@/lib/server/http";
import { generateInput } from "@/lib/validation";
import { generateContent } from "@/lib/providers";
import { assertPermission, DomainError } from "@/lib/workflow";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const { workspace } = await loadWorkspace(actor);
    assertPermission(actor, "content.create");
    rateLimit(`generate:${actor.id}`, 10);
    const input = generateInput
      .extend({ revision: z.number().int().min(0) })
      .parse(await limitedJson(request));
    if (input.revision !== workspace.revision)
      throw new DomainError("Workspace changed. Refresh and try again.", 409);
    const product = workspace.products.find(
      (p) => p.id === input.productId && p.status !== "archived",
    );
    if (!product) throw new DomainError("Choose an available product.", 404);
    const content = await generateContent(product, input);
    if (input.regenerateId) {
      const old = workspace.content.find(
        (c) =>
          c.id === input.regenerateId &&
          c.productId === product.id &&
          c.platform === input.platform,
      );
      if (!old) throw new DomainError("Draft not found.", 404);
      return NextResponse.json(
        await mutateWorkspace(
          actor,
          {
            type: "content.edit",
            id: old.id,
            version: old.version,
            fields: {
              title: content.title,
              body: content.body,
              hashtags: content.hashtags,
              cta: content.cta,
              ideas: content.ideas,
            },
          },
          input.revision,
        ),
      );
    }
    return NextResponse.json(
      await mutateWorkspace(
        actor,
        { type: "content.create", content },
        input.revision,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
