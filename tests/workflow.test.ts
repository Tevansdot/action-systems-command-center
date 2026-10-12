import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { applyOperation, type Operation } from "@/lib/workflow";
import { createWorkspace } from "@/lib/seed";
import type { Actor, Content, ContentStatus, Workspace } from "@/lib/model";
import { jamaicaToUtc, utcToJamaicaInput } from "@/lib/time";
const owner: Actor = {
  id: randomUUID(),
  name: "Owner",
  role: "owner",
  mode: "demo",
};
const now = new Date("2026-10-12T17:00:00Z");
export function draft(w: Workspace): Content {
  return {
    id: randomUUID(),
    productId: w.products[0].id,
    campaignId: null,
    platform: "pinterest",
    objective: "awareness",
    tone: "professional",
    title: "Explore Service Profit OS",
    body: "Review the product page.",
    hashtags: [],
    cta: "Explore the product",
    ideas: [],
    status: "draft",
    source: "template",
    version: 1,
    approvedVersion: null,
    scheduledAt: null,
    publishedAt: null,
    publishedUrl: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
function setup() {
  const w = createWorkspace();
  w.content.push(draft(w));
  return w;
}
function move(
  w: Workspace,
  to: ContentStatus,
  extra: object = {},
  actor = owner,
) {
  return applyOperation(
    w,
    {
      type: "content.transition",
      id: w.content[0].id,
      version: w.content[0].version,
      to,
      ...extra,
    } as Operation,
    actor,
    now,
  );
}
function approved() {
  return move(move(setup(), "pending_approval"), "approved");
}
describe("human approval boundary", () => {
  it("blocks scheduling and publication from a draft", () => {
    const w = setup();
    expect(() =>
      move(w, "scheduled", { scheduledAt: "2026-10-15T15:00:00Z" }),
    ).toThrow();
    expect(() =>
      move(w, "published", {
        confirmed: true,
        publishedUrl: "https://pinterest.com/pin/1",
      }),
    ).toThrow();
  });
  it("records the approving actor, timestamp, and exact content version", () => {
    const w = approved();
    expect(w.approvals[0]).toMatchObject({
      actorId: owner.id,
      decision: "approved",
      version: 1,
      createdAt: now.toISOString(),
    });
    expect(w.content[0].approvedVersion).toBe(1);
  });
  it("keeps scheduled content separate from published content", () => {
    const w = move(approved(), "scheduled", {
      scheduledAt: "2026-10-15T15:00:00Z",
    });
    expect(w.content[0].status).toBe("scheduled");
    expect(w.content[0].publishedAt).toBeNull();
    expect(w.scheduled[0].status).toBe("scheduled");
    expect(w.approvals[0].version).toBe(1);
  });
  it("rejects past dates and invalid transitions", () => {
    expect(() =>
      move(approved(), "scheduled", { scheduledAt: "2026-10-11T15:00:00Z" }),
    ).toThrow("future");
    expect(() => move(setup(), "approved")).toThrow();
  });
  it("requires a publication URL and explicit manual confirmation", () => {
    const w = approved();
    expect(() =>
      move(w, "published", { publishedUrl: "https://pinterest.com/pin/1" }),
    ).toThrow("Confirm");
    expect(() => move(w, "published", { confirmed: true })).toThrow("Confirm");
    expect(
      move(w, "published", {
        confirmed: true,
        publishedUrl: "https://pinterest.com/pin/1",
      }).content[0].status,
    ).toBe("published");
  });
  it("editing an approved or scheduled item invalidates approval and cancels its schedule", () => {
    let w = move(approved(), "scheduled", {
      scheduledAt: "2026-10-15T15:00:00Z",
    });
    w = applyOperation(
      w,
      {
        type: "content.edit",
        id: w.content[0].id,
        version: 1,
        fields: {
          title: "Updated",
          body: "New text.",
          hashtags: [],
          cta: "",
          ideas: [],
        },
      },
      owner,
      now,
    );
    expect(w.content[0]).toMatchObject({
      status: "draft",
      version: 2,
      approvedVersion: null,
      scheduledAt: null,
    });
    expect(w.scheduled[0].status).toBe("cancelled");
    expect(w.approvals.map((a) => a.decision)).toEqual([
      "approved",
      "invalidated",
    ]);
    expect(w.approvals[0].version).toBe(1);
    expect(() =>
      move(w, "published", {
        confirmed: true,
        publishedUrl: "https://pinterest.com/pin/1",
      }),
    ).toThrow();
  });
  it("requires rejection and failure reasons", () => {
    expect(() => move(move(setup(), "pending_approval"), "rejected")).toThrow(
      "reason",
    );
    const w = move(approved(), "scheduled", {
      scheduledAt: "2026-10-15T15:00:00Z",
    });
    expect(() => move(w, "failed")).toThrow("failure");
    expect(
      move(w, "failed", { reason: "Manual platform upload failed" }).content[0]
        .status,
    ).toBe("failed");
  });
  it("allows recovery and rescheduling of a failed approved item", () => {
    let w = move(approved(), "scheduled", {
      scheduledAt: "2026-10-15T15:00:00Z",
    });
    w = move(w, "failed", { reason: "Platform unavailable" });
    w = move(w, "scheduled", { scheduledAt: "2026-10-16T16:00:00Z" });
    expect(w.scheduled).toHaveLength(1);
    expect(w.scheduled[0].scheduledAt).toBe("2026-10-16T16:00:00.000Z");
  });
  it("forbids editing published content and detects stale text versions", () => {
    const w = move(approved(), "published", {
      confirmed: true,
      publishedUrl: "https://pinterest.com/pin/1",
    });
    expect(() =>
      applyOperation(
        w,
        {
          type: "content.edit",
          id: w.content[0].id,
          version: 1,
          fields: {
            title: "Edit",
            body: "Modified",
            hashtags: [],
            cta: "",
            ideas: [],
          },
        },
        owner,
      ),
    ).toThrow("Published");
    expect(() =>
      applyOperation(
        setup(),
        {
          type: "content.edit",
          id: setup().content[0].id,
          version: 2,
          fields: {
            title: "Edit",
            body: "Modified",
            hashtags: [],
            cta: "",
            ideas: [],
          },
        },
        owner,
      ),
    ).toThrow();
  });
});
describe("roles and tenant references", () => {
  it("prevents viewers from changing any data", () => {
    expect(() =>
      applyOperation(
        setup(),
        { type: "automation.run", kind: "daily_suggestions" },
        { ...owner, role: "viewer" },
      ),
    ).toThrow("role");
  });
  it("allows editors to submit but never approve", () => {
    const editor = { ...owner, role: "editor" as const };
    const pending = move(setup(), "pending_approval", {}, editor);
    expect(() => move(pending, "approved", {}, editor)).toThrow("reviewer");
  });
  it("restricts reviewers to review decisions", () => {
    expect(() =>
      move(setup(), "pending_approval", {}, { ...owner, role: "reviewer" }),
    ).toThrow("editor");
    expect(
      move(
        move(setup(), "pending_approval"),
        "approved",
        {},
        { ...owner, role: "reviewer" },
      ).content[0].status,
    ).toBe("approved");
  });
  it("rejects foreign product/campaign references", () => {
    const w = createWorkspace(),
      c = draft(w);
    c.productId = randomUUID();
    expect(() =>
      applyOperation(w, { type: "content.create", content: c }, owner),
    ).toThrow("Product");
  });
  it("does not mutate input when an operation fails", () => {
    const w = setup(),
      copy = structuredClone(w);
    expect(() => move(w, "published")).toThrow();
    expect(w).toEqual(copy);
  });
  it("internal workflows never publish due content", () => {
    const w = move(approved(), "scheduled", {
      scheduledAt: "2026-10-15T15:00:00Z",
    });
    const next = applyOperation(
      w,
      { type: "automation.run", kind: "publishing_review" },
      owner,
      new Date("2026-10-16T17:00:00Z"),
    );
    expect(next.content[0].status).toBe("scheduled");
    expect(next.jobs[0].result).toContain("1 approved posts");
  });
  it("persists queued jobs, claims once, and permits recovery after a failed attempt", () => {
    const jobId = randomUUID();
    let w = applyOperation(
      setup(),
      { type: "automation.enqueue", jobId, kind: "marketing_summary" },
      owner,
      now,
    );
    w = applyOperation(w, { type: "automation.claim", jobId }, owner, now);
    expect(() =>
      applyOperation(w, { type: "automation.claim", jobId }, owner, now),
    ).toThrow("claimed");
    expect(() =>
      applyOperation(w, { type: "automation.retry", jobId }, owner, now),
    ).toThrow("still running");
    w = applyOperation(
      w,
      {
        type: "automation.fail",
        jobId,
        reason: "Temporary configuration failure",
      },
      owner,
      now,
    );
    w = applyOperation(w, { type: "automation.retry", jobId }, owner, now);
    w = applyOperation(w, { type: "automation.claim", jobId }, owner, now);
    w = applyOperation(w, { type: "automation.execute", jobId }, owner, now);
    expect(w.jobs[0]).toMatchObject({
      status: "completed",
      attempts: 2,
      leaseUntil: null,
    });
  });
});
describe("Jamaica scheduling", () => {
  it("round-trips a Jamaica time to UTC", () => {
    expect(jamaicaToUtc("2026-10-15T09:30")).toBe("2026-10-15T14:30:00.000Z");
    expect(utcToJamaicaInput("2026-10-15T14:30:00Z")).toBe("2026-10-15T09:30");
  });
  it("rejects malformed and impossible dates", () => {
    expect(() => jamaicaToUtc("2026-02-30T09:30")).toThrow();
    expect(() => jamaicaToUtc("tomorrow")).toThrow();
  });
  it("handles midnight across the UTC date boundary", () => {
    expect(utcToJamaicaInput("2026-10-15T02:30:00Z")).toBe("2026-10-14T21:30");
  });
});
