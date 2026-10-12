import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireActor } from "@/lib/server/auth";
import { mutateWorkspace } from "@/lib/server/store";
import { runQueuedJob } from "@/lib/server/jobs";
import {
  assertSameOrigin,
  errorResponse,
  limitedJson,
  rateLimit,
} from "@/lib/server/http";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    rateLimit(`jobs:${actor.id}`, 10);
    const body = z
      .object({ jobId: z.uuid(), revision: z.number().int().min(0) })
      .parse(await limitedJson(request));
    const result = await mutateWorkspace(
      actor,
      { type: "automation.retry", jobId: body.jobId },
      body.revision,
    );
    after(() => runQueuedJob(actor, body.jobId));
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
