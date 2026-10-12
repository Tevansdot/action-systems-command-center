import { randomUUID } from "node:crypto";
import type {
  Actor,
  Content,
  ContentStatus,
  Sale,
  Workspace,
  Job,
} from "./model";
import type { UserOperation } from "./validation";
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export type Operation =
  | UserOperation
  | { type: "content.create"; content: Content }
  | { type: "sales.import"; sales: Sale[] }
  | { type: "automation.enqueue"; jobId: string; kind: Job["kind"] }
  | { type: "automation.claim"; jobId: string }
  | { type: "automation.retry"; jobId: string }
  | { type: "automation.execute"; jobId: string; result?: string }
  | { type: "automation.fail"; jobId: string; reason: string };
const transitions: Record<ContentStatus, ContentStatus[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "rejected", "draft", "cancelled"],
  approved: ["scheduled", "published", "draft", "cancelled"],
  scheduled: ["scheduled", "published", "failed", "draft", "cancelled"],
  rejected: ["draft", "cancelled"],
  failed: ["draft", "scheduled", "published", "cancelled"],
  cancelled: ["draft"],
  published: [],
};
export function assertPermission(actor: Actor, action: string) {
  const review = action === "content.transition";
  if (
    actor.role === "viewer" ||
    (review
      ? !["owner", "reviewer", "editor"].includes(actor.role)
      : !["owner", "editor"].includes(actor.role))
  )
    throw new DomainError("Your role does not permit this action.", 403);
}
export function applyOperation(
  original: Workspace,
  op: Operation,
  actor: Actor,
  now = new Date(),
): Workspace {
  assertPermission(actor, op.type);
  const state = structuredClone(original),
    at = now.toISOString();
  let entityId: string | null = null,
    detail = "";
  if (op.type === "product.save") {
    const old = op.product.id
      ? state.products.find((p) => p.id === op.product.id)
      : undefined;
    if (op.product.id && !old) throw new DomainError("Product not found.", 404);
    const product = {
      ...op.product,
      id: old?.id ?? randomUUID(),
      createdAt: old?.createdAt ?? at,
      updatedAt: at,
    };
    state.products = old
      ? state.products.map((p) => (p.id === old.id ? product : p))
      : [...state.products, product];
    entityId = product.id;
    detail = `${old ? "Updated" : "Created"} ${product.name}`;
  } else if (op.type === "product.archive") {
    const product = state.products.find((p) => p.id === op.id);
    if (!product) throw new DomainError("Product not found.", 404);
    product.status = "archived";
    product.updatedAt = at;
    entityId = product.id;
    detail = `Archived ${product.name}`;
  } else if (op.type === "campaign.create") {
    if (
      !state.products.some(
        (p) => p.id === op.productId && p.status !== "archived",
      )
    )
      throw new DomainError("Choose an available product.");
    entityId = randomUUID();
    state.campaigns.push({
      id: entityId,
      name: op.name,
      productId: op.productId,
      objective: op.objective,
      platforms: op.platforms,
      createdAt: at,
    });
    detail = `Created campaign ${op.name}`;
  } else if (op.type === "content.create") {
    if (
      !state.products.some(
        (p) => p.id === op.content.productId && p.status !== "archived",
      )
    )
      throw new DomainError("Product not found or archived.", 404);
    if (
      op.content.campaignId &&
      !state.campaigns.some(
        (c) =>
          c.id === op.content.campaignId &&
          c.productId === op.content.productId &&
          c.platforms.includes(op.content.platform),
      )
    )
      throw new DomainError("Campaign must match the product and platform.");
    if (op.content.status !== "draft" || op.content.approvedVersion !== null)
      throw new DomainError("New content must begin as an unapproved draft.");
    state.content.push(op.content);
    entityId = op.content.id;
    detail = `Created ${op.content.source} content draft`;
  } else if (op.type === "content.edit" || op.type === "content.transition") {
    const content = state.content.find((c) => c.id === op.id);
    if (!content) throw new DomainError("Content not found.", 404);
    if (content.version !== op.version)
      throw new DomainError(
        "This draft changed. Refresh and review the latest version.",
        409,
      );
    entityId = content.id;
    if (op.type === "content.edit") {
      if (content.status === "published")
        throw new DomainError(
          "Published content cannot be edited. Create a new draft.",
        );
      Object.assign(content, op.fields);
      content.version++;
      content.status = "draft";
      if (content.approvedVersion)
        state.approvals.push({
          id: randomUUID(),
          contentId: content.id,
          actorId: actor.id,
          actorName: actor.name,
          decision: "invalidated",
          version: content.approvedVersion,
          reason: "Content edited; approval must be requested again.",
          createdAt: at,
        });
      content.approvedVersion = null;
      content.scheduledAt = null;
      state.scheduled
        .filter((s) => s.contentId === content.id && s.status === "scheduled")
        .forEach((s) => {
          s.status = "cancelled";
        });
      detail = "Edited content and reset approval";
    } else {
      if (!transitions[content.status].includes(op.to))
        throw new DomainError(
          `Cannot move ${content.status.replaceAll("_", " ")} to ${op.to.replaceAll("_", " ")}.`,
        );
      if (
        ["approved", "rejected", "scheduled", "published"].includes(op.to) &&
        !["owner", "reviewer"].includes(actor.role)
      )
        throw new DomainError(
          "An owner or reviewer must authorize this action.",
          403,
        );
      if (
        actor.role === "reviewer" &&
        !["approved", "rejected", "scheduled", "published"].includes(op.to)
      )
        throw new DomainError(
          "An owner or editor must modify the draft workflow.",
          403,
        );
      if (op.to === "rejected" && (!op.reason || op.reason.length < 3))
        throw new DomainError("A rejection reason is required.");
      if (op.to === "failed" && (!op.reason || op.reason.length < 3))
        throw new DomainError("Describe the publishing failure.");
      if (op.to === "approved" || op.to === "rejected") {
        content.approvedVersion = op.to === "approved" ? content.version : null;
        state.approvals.push({
          id: randomUUID(),
          contentId: content.id,
          actorId: actor.id,
          actorName: actor.name,
          decision: op.to,
          version: content.version,
          reason: op.reason ?? "",
          createdAt: at,
        });
      }
      if (op.to === "scheduled" || op.to === "published") {
        if (
          content.approvedVersion !== content.version ||
          !state.approvals.some(
            (a) =>
              a.contentId === content.id &&
              a.version === content.version &&
              a.decision === "approved",
          )
        )
          throw new DomainError(
            "The current content version requires human approval.",
          );
      }
      if (op.to === "scheduled") {
        if (
          !op.scheduledAt ||
          new Date(op.scheduledAt).getTime() <= now.getTime()
        )
          throw new DomainError("Choose a future publishing date.");
        content.scheduledAt = new Date(op.scheduledAt).toISOString();
        const scheduled = state.scheduled.find(
          (s) => s.contentId === content.id,
        );
        if (scheduled)
          Object.assign(scheduled, {
            scheduledAt: content.scheduledAt,
            status: "scheduled",
          });
        else
          state.scheduled.push({
            id: randomUUID(),
            contentId: content.id,
            scheduledAt: content.scheduledAt,
            status: "scheduled",
            createdAt: at,
          });
      }
      if (op.to === "published") {
        if (!op.confirmed || !op.publishedUrl)
          throw new DomainError(
            "Confirm manual publication and provide the published HTTPS URL.",
          );
        content.publishedUrl = op.publishedUrl;
        content.publishedAt = at;
        state.scheduled
          .filter((s) => s.contentId === content.id)
          .forEach((s) => {
            s.status = "completed";
          });
      }
      if (["cancelled", "draft"].includes(op.to)) {
        if (content.approvedVersion)
          state.approvals.push({
            id: randomUUID(),
            contentId: content.id,
            actorId: actor.id,
            actorName: actor.name,
            decision: "invalidated",
            version: content.approvedVersion,
            reason: "Approval withdrawn",
            createdAt: at,
          });
        content.approvedVersion = null;
        content.scheduledAt = null;
        state.scheduled
          .filter((s) => s.contentId === content.id && s.status === "scheduled")
          .forEach((s) => {
            s.status = "cancelled";
          });
      }
      content.status = op.to;
      detail = `${op.to.replaceAll("_", " ")}${op.reason ? `: ${op.reason}` : ""}`;
    }
    content.updatedAt = at;
  } else if (op.type === "sales.import") {
    let added = 0,
      updated = 0;
    for (const sale of op.sales) {
      const existing = state.sales.find(
        (s) => s.purchaseId === sale.purchaseId,
      );
      if (!existing) {
        state.sales.push(sale);
        added++;
      } else {
        if (
          existing.grossCents !== sale.grossCents ||
          existing.currency !== sale.currency ||
          existing.productName !== sale.productName ||
          existing.purchasedAt !== sale.purchasedAt
        )
          throw new DomainError(
            `Purchase ${sale.purchaseId} conflicts with an existing import.`,
          );
        if (sale.refundCents > existing.refundCents) {
          existing.refundCents = sale.refundCents;
          updated++;
        }
      }
    }
    detail = `Imported ${added} purchases; updated ${updated} refunds; skipped ${op.sales.length - added - updated} duplicates`;
  } else if (op.type === "automation.enqueue") {
    if (state.jobs.some((j) => j.id === op.jobId))
      throw new DomainError("Job already exists.", 409);
    state.jobs.push({
      id: op.jobId,
      kind: op.kind,
      status: "queued",
      result: "Waiting for the authenticated worker.",
      createdAt: at,
      finishedAt: null,
      leaseUntil: null,
      attempts: 0,
    });
    entityId = op.jobId;
    detail = "Queued internal workflow";
  } else if (
    op.type === "automation.claim" ||
    op.type === "automation.retry" ||
    op.type === "automation.fail"
  ) {
    const job = state.jobs.find((j) => j.id === op.jobId);
    if (!job) throw new DomainError("Job not found.", 404);
    if (op.type === "automation.claim") {
      if (job.status !== "queued")
        throw new DomainError("Job has already been claimed.", 409);
      job.status = "running";
      job.attempts++;
      job.leaseUntil = new Date(now.getTime() + 300_000).toISOString();
      job.result = "Preparing internal workflow.";
    } else if (op.type === "automation.retry") {
      if (
        job.status === "completed" ||
        (job.status === "running" &&
          job.leaseUntil &&
          new Date(job.leaseUntil) > now)
      )
        throw new DomainError("This job is completed or still running.", 409);
      job.status = "queued";
      job.finishedAt = null;
      job.leaseUntil = null;
      job.result = "Queued for retry.";
    } else {
      if (job.status === "completed")
        throw new DomainError("Completed job cannot fail.");
      job.status = "failed";
      job.finishedAt = at;
      job.leaseUntil = null;
      job.result = op.reason.slice(0, 2000);
    }
    entityId = job.id;
    detail = `${job.kind}: ${job.status}`;
  } else if (op.type === "automation.run" || op.type === "automation.execute") {
    const job =
      op.type === "automation.execute"
        ? state.jobs.find((j) => j.id === op.jobId)
        : null;
    if (
      op.type === "automation.execute" &&
      (!job ||
        job.status !== "running" ||
        !job.leaseUntil ||
        new Date(job.leaseUntil) <= now)
    )
      throw new DomainError(
        "Job is not running or its lease has expired.",
        409,
      );
    const jobId = job?.id ?? randomUUID(),
      kind = op.type === "automation.run" ? op.kind : job!.kind;
    let result: string;
    if (kind === "daily_suggestions")
      result =
        state.products
          .filter((p) => p.status !== "archived")
          .map(
            (p) =>
              `Prepare a product introduction for ${p.name}; confirm product details, create a draft in the studio, then request approval.`,
          )
          .join("\n") || "Add a product before preparing suggestions.";
    else if (kind === "daily_drafts")
      result =
        op.type === "automation.execute"
          ? op.result ||
            "Draft preparation completed. Review the content studio."
          : "Enqueue this workflow to prepare drafts in the background.";
    else if (kind === "approval_reminders")
      result = `${state.content.filter((c) => c.status === "pending_approval").length} items await review. Reminder recorded here; no external message sent.`;
    else if (kind === "marketing_summary")
      result = `${state.content.filter((c) => c.status === "published").length} manually confirmed publications; ${state.content.filter((c) => c.status === "scheduled").length} scheduled; ${state.content.filter((c) => c.status === "failed").length} failed. Review the queue and sales import for the latest results.`;
    else
      result = `${state.content.filter((c) => c.status === "scheduled" && c.scheduledAt && new Date(c.scheduledAt) <= now).length} approved posts are due. Publish manually, then record each published URL. No automatic publisher is connected.`;
    if (job)
      Object.assign(job, {
        status: "completed",
        result,
        finishedAt: at,
        leaseUntil: null,
      });
    else
      state.jobs.push({
        id: jobId,
        kind,
        status: "completed",
        result,
        createdAt: at,
        finishedAt: at,
        leaseUntil: null,
        attempts: 1,
      });
    entityId = jobId;
    detail = result;
  }
  state.audit.push({
    id: randomUUID(),
    actorId: actor.id,
    actorName: actor.name,
    action: op.type,
    entityId,
    detail,
    createdAt: at,
  });
  state.revision++;
  return state;
}
