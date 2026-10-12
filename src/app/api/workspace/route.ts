import { NextResponse } from "next/server";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireActor } from "@/lib/server/auth";
import { loadWorkspace, mutateWorkspace } from "@/lib/server/store";
import {
  assertSameOrigin,
  errorResponse,
  limitedJson,
} from "@/lib/server/http";
import { operationSchema } from "@/lib/validation";
import { runQueuedJob } from "@/lib/server/jobs";
import { rateLimit } from "@/lib/server/http";
export const maxDuration = 300;
export async function GET() {
  try {
    return NextResponse.json(await loadWorkspace(await requireActor()), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const body = z
      .object({ revision: z.number().int().min(0), operation: operationSchema })
      .parse(await limitedJson(request));
    if (body.operation.type === "automation.run") {
      rateLimit(`jobs:${actor.id}`, 10);
      const jobId = randomUUID();
      const result = await mutateWorkspace(
        actor,
        { type: "automation.enqueue", jobId, kind: body.operation.kind },
        body.revision,
      );
      after(() => runQueuedJob(actor, jobId));
      return NextResponse.json(result);
    }
    return NextResponse.json(
      await mutateWorkspace(actor, body.operation, body.revision),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
