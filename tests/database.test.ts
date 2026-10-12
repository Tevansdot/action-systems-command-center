import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Workspace } from "@/lib/model";
const db = new PGlite();
const alice = randomUUID(),
  bob = randomUUID(),
  editor = randomUUID(),
  viewer = randomUUID();
let a: Workspace, b: Workspace;
async function as(id: string, sql: string, params: unknown[] = []) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
  return db.query(sql, params);
}
async function workspace(id = alice) {
  const result = await as(
    id,
    "select public.command_center_workspace() as data",
  );
  return (result.rows[0] as { data: { workspace: Workspace } }).data.workspace;
}
async function op(
  operation: object,
  id = alice,
  business = a.business.id,
  revision?: number,
) {
  const state = await workspace(id);
  await as(
    id,
    "select public.command_center_operation($1::uuid,$2::integer,$3::jsonb)",
    [business, revision ?? state.revision, JSON.stringify(operation)],
  );
  return workspace(id);
}
async function createDraft() {
  a = await workspace();
  const id = randomUUID();
  a = await op({
    type: "content.create",
    content: {
      id,
      productId: a.products[0].id,
      campaignId: null,
      platform: "pinterest",
      objective: "awareness",
      tone: "professional",
      title: "Explore the product",
      body: "Review the product page.",
      hashtags: [],
      cta: "Read more",
      ideas: [],
      source: "template",
    },
  });
  return id;
}
async function transition(id: string, to: string, extra: object = {}) {
  a = await workspace();
  const content = a.content.find((c) => c.id === id)!;
  return op({
    type: "content.transition",
    id,
    version: content.version,
    to,
    ...extra,
  });
}
beforeAll(async () => {
  await db.exec(
    `create schema auth; create role anon; create role authenticated; grant usage on schema public,auth to authenticated,anon; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/202610120001_command_center.sql",
      "utf8",
    ),
  );
  for (const [id, name] of [
    [alice, "Alice"],
    [bob, "Bob"],
    [editor, "Editor"],
    [viewer, "Viewer"],
  ])
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3::jsonb)",
      [
        id,
        `${name.toLowerCase()}@example.test`,
        JSON.stringify({ full_name: name }),
      ],
    );
  a = await workspace(alice);
  b = await workspace(bob);
  await db.exec("reset role;");
  await db.query(
    "insert into public.business_memberships(business_id,user_id,role) values($1,$2,'editor'),($1,$3,'viewer')",
    [a.business.id, editor, viewer],
  );
}, 30_000);
afterAll(async () => {
  await db.close();
});
describe("Supabase migration and RPC security (real PostgreSQL via PGlite)", () => {
  it("provisions a persistent first business with unknown product facts left blank", async () => {
    const state = await workspace();
    expect(state.business.id).toBe(a.business.id);
    expect(state.products[0].priceCents).toBeNull();
    expect(state.products[0].description).toBe("");
    expect(state.sales).toHaveLength(0);
  });
  it("enables RLS on all eleven business tables", async () => {
    await db.exec("reset role;");
    const result = await db.query<{ count: number }>(
      "select count(*)::int as count from pg_tables where schemaname='public' and rowsecurity=true",
    );
    expect(result.rows[0].count).toBe(11);
  });
  it("isolates another user's product rows using RLS", async () => {
    const result = await as(
      bob,
      "select id from public.products where business_id=$1",
      [a.business.id],
    );
    expect(result.rows).toHaveLength(0);
  });
  it("denies direct writes that could forge approvals or publication", async () => {
    await expect(
      as(alice, "update public.content_drafts set status='published'"),
    ).rejects.toThrow("permission denied");
    await expect(
      as(
        alice,
        'insert into public.content_approvals(business_id,"contentId","actorId","actorName",decision,version) values($1,$2,$3,\'Fake\',\'approved\',1)',
        [a.business.id, randomUUID(), alice],
      ),
    ).rejects.toThrow("permission denied");
  });
  it("denies unauthenticated reads and RPC calls", async () => {
    await db.exec(
      "set role anon; select set_config('request.jwt.claim.sub','',false);",
    );
    await expect(
      db.query("select * from public.sales_transactions"),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query("select public.command_center_workspace()"),
    ).rejects.toThrow("permission denied");
  });
  it("denies foreign business mutations and viewer mutations", async () => {
    await expect(
      op(
        { type: "automation.run", kind: "marketing_summary" },
        bob,
        a.business.id,
      ),
    ).rejects.toThrow("Permission denied");
    await expect(
      op({ type: "automation.run", kind: "marketing_summary" }, viewer),
    ).rejects.toThrow("Permission denied");
  });
  it("prevents cross-business foreign keys even through RPC", async () => {
    await expect(
      op({
        type: "campaign.create",
        name: "Invalid campaign",
        productId: b.products[0].id,
        objective: "Build awareness",
        platforms: ["pinterest"],
      }),
    ).rejects.toThrow("Product not available");
  });
  it("rejects stale workspace revisions before making a change", async () => {
    const current = await workspace();
    await op({ type: "automation.run", kind: "marketing_summary" });
    await expect(
      op(
        { type: "automation.run", kind: "marketing_summary" },
        alice,
        a.business.id,
        current.revision,
      ),
    ).rejects.toThrow("Workspace changed");
  });
  it("enforces the entire approval/schedule/manual publishing sequence in the database", async () => {
    const id = await createDraft();
    await expect(
      transition(id, "scheduled", { scheduledAt: "2099-10-15T14:00:00Z" }),
    ).rejects.toThrow("Invalid approval transition");
    await transition(id, "pending_approval");
    await expect(
      op(
        { type: "content.transition", id, version: 1, to: "approved" },
        editor,
      ),
    ).rejects.toThrow("Reviewer permission");
    await transition(id, "approved");
    a = await transition(id, "scheduled", {
      scheduledAt: "2099-10-15T14:00:00Z",
    });
    expect(a.content.find((c) => c.id === id)?.publishedAt).toBeNull();
    await expect(
      transition(id, "published", {
        publishedUrl: "https://pinterest.com/pin/123",
      }),
    ).rejects.toThrow("Explicit confirmation");
    a = await transition(id, "published", {
      confirmed: true,
      publishedUrl: "https://pinterest.com/pin/123",
    });
    expect(a.content.find((c) => c.id === id)?.status).toBe("published");
    expect(a.approvals.find((x) => x.contentId === id)?.actorName).toBe(
      "Alice",
    );
    expect(a.scheduled.find((s) => s.contentId === id)?.status).toBe(
      "completed",
    );
  });
  it("invalidates approval and retains immutable reviewer history when editing", async () => {
    const id = await createDraft();
    await transition(id, "pending_approval");
    await transition(id, "approved");
    await transition(id, "scheduled", { scheduledAt: "2099-10-15T14:00:00Z" });
    a = await op({
      type: "content.edit",
      id,
      version: 1,
      fields: {
        title: "Updated",
        body: "Updated copy.",
        hashtags: [],
        cta: "",
        ideas: [],
      },
    });
    expect(a.content.find((c) => c.id === id)).toMatchObject({
      status: "draft",
      approvedVersion: null,
      version: 2,
    });
    expect(
      a.approvals.filter((x) => x.contentId === id).map((x) => x.decision),
    ).toEqual(["approved", "invalidated"]);
    expect(a.scheduled.find((s) => s.contentId === id)?.status).toBe(
      "cancelled",
    );
  });
  it("atomically deduplicates purchases and rolls back conflicting imports", async () => {
    const sales = [
      {
        id: randomUUID(),
        purchaseId: "DB-1",
        productName: "Service Profit OS",
        productId: a.products[0].id,
        grossCents: 1995,
        refundCents: 0,
        currency: "USD",
        purchasedAt: "2026-10-12T12:00:00Z",
      },
    ];
    await op({ type: "sales.import", sales });
    a = await op({ type: "sales.import", sales });
    expect(a.sales.filter((s) => s.purchaseId === "DB-1")).toHaveLength(1);
    await expect(
      op({
        type: "sales.import",
        sales: [
          { ...sales[0], purchaseId: "DB-2" },
          { ...sales[0], grossCents: 2000 },
        ],
      }),
    ).rejects.toThrow("Conflicting purchase");
    a = await workspace();
    expect(a.sales.some((s) => s.purchaseId === "DB-2")).toBe(false);
    a = await op({
      type: "sales.import",
      sales: [{ ...sales[0], refundCents: 500 }],
    });
    expect(a.sales.find((s) => s.purchaseId === "DB-1")?.refundCents).toBe(500);
  });
  it("claims durable jobs once, protects active leases, and completes without publishing", async () => {
    const jobId = randomUUID();
    await op({ type: "automation.enqueue", jobId, kind: "publishing_review" });
    a = await op({ type: "automation.claim", jobId });
    expect(a.jobs.find((j) => j.id === jobId)).toMatchObject({
      status: "running",
      attempts: 1,
    });
    await expect(op({ type: "automation.claim", jobId })).rejects.toThrow(
      "already claimed",
    );
    await expect(op({ type: "automation.retry", jobId })).rejects.toThrow(
      "still running",
    );
    a = await op({ type: "automation.execute", jobId });
    expect(a.jobs.find((j) => j.id === jobId)?.status).toBe("completed");
    await expect(op({ type: "automation.execute", jobId })).rejects.toThrow(
      "not running",
    );
  });
});
