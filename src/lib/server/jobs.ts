import "server-only";
import type { Actor } from "../model";
import { DomainError, type Operation } from "../workflow";
import { loadWorkspace, mutateWorkspace } from "./store";
import { generateContent } from "../providers";
async function persist(actor: Actor, operation: Operation) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { workspace } = await loadWorkspace(actor);
    try {
      return await mutateWorkspace(actor, operation, workspace.revision);
    } catch (error) {
      if (
        !(error instanceof DomainError) ||
        error.status !== 409 ||
        attempt === 2
      )
        throw error;
    }
  }
  throw new DomainError("Workspace stayed busy. Retry the workflow.", 409);
}
export async function runQueuedJob(actor: Actor, jobId: string) {
  try {
    const { workspace } = await loadWorkspace(actor),
      job = workspace.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "queued") return;
    await persist(actor, { type: "automation.claim", jobId });
  } catch (error) {
    if (error instanceof DomainError && error.status === 409) return; // Another worker won the claim.
    console.error(
      "Job claim failed:",
      error instanceof Error ? error.name : "unknown",
    );
    return;
  }
  try {
    const { workspace } = await loadWorkspace(actor),
      job = workspace.jobs.find((j) => j.id === jobId)!;
    let result: string | undefined;
    if (job.kind === "daily_drafts") {
      let created = 0;
      for (const product of workspace.products
        .filter((p) => p.status !== "archived")
        .slice(0, 5)) {
        const content = await generateContent(product, {
          productId: product.id,
          platform: "pinterest",
          objective: "awareness",
          tone: "professional",
          campaignId: null,
        });
        await persist(actor, { type: "content.create", content });
        created++;
      }
      result = `Prepared ${created} unapproved Pinterest drafts (up to five products per run). Review and edit them in the content studio, then request approval. Nothing was published.`;
    }
    await persist(actor, { type: "automation.execute", jobId, result });
  } catch (error) {
    try {
      await persist(actor, {
        type: "automation.fail",
        jobId,
        reason:
          error instanceof DomainError
            ? error.message
            : "Workflow failed. Check server configuration, then retry. Any already-created drafts remain unapproved.",
      });
    } catch (failure) {
      console.error(
        "Job failure could not be recorded:",
        failure instanceof Error ? failure.name : "unknown",
      );
    }
  }
}
