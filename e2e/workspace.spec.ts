import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("authenticated user completes the entire manual marketing workflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Open demo workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Let’s make your next move." }),
  ).toBeVisible();
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/dashboard.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Product library", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit Service Profit OS" }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("Product details are awaiting owner verification.");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Content studio", exact: true }).click();
  await page
    .getByRole("button", { name: "Generate draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Request approval", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Content", { exact: true })
    .fill(
      "Explore Service Profit OS. Visit the product page to review the details.",
    );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("button", { name: "Request approval", exact: true })
    .click();
  await page.getByRole("link", { name: /Approval queue/ }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("button", { name: /^Approved/ }).click();
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await page.getByLabel("Publishing date and time").fill("2099-10-15T09:30");
  await page.getByRole("button", { name: "Save schedule" }).click();
  await page
    .getByRole("link", { name: "Publishing tracker", exact: true })
    .click();
  await expect(page.locator(".badge-scheduled")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".badge-scheduled")).toHaveCount(1);
  await expect(
    page.getByText("View manually confirmed publication"),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Mark as published" }).click();
  await page
    .getByLabel("Published post URL")
    .fill("https://www.pinterest.com/pin/manual-test-post/");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Confirm manual publication" })
    .click();
  await page.getByRole("button", { name: /^Published/ }).click();
  await expect(
    page.getByRole("link", { name: /View manually confirmed publication/ }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Sales analytics", exact: true })
    .click();
  const fixture =
    "Purchase ID,Product,Price,Currency,Date,Refunded,Email\ne2e-test-1,Service Profit OS,19.95,USD,2026-10-12T12:00:00Z,false,test-buyer@example.test\ne2e-test-2,Service Profit OS,10.00,USD,2026-10-13T12:00:00Z,true,other@example.test";
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Import sales CSV" }).click();
    await page.getByLabel("Sales CSV", { exact: true }).setInputFiles({
      name: "sales-test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(fixture),
    });
    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
  await expect(
    page
      .locator(".metric-card")
      .filter({ hasText: "Unique purchases" })
      .locator("strong"),
  ).toHaveText("2");
  await expect(
    page
      .locator(".metric-card")
      .filter({ hasText: "Gross sales" })
      .locator("strong"),
  ).toHaveText("$29.95");
  await expect(page.locator("body")).not.toContainText(
    "test-buyer@example.test",
  );
  await page.getByRole("link", { name: "Workflows", exact: true }).click();
  await page.getByRole("button", { name: "Run now" }).first().click();
  await expect(page.locator(".job-list")).toContainText("Service Profit OS");
  await page.getByRole("link", { name: "Approval queue", exact: true }).click();
  await expect(page.locator("table")).toContainText("Demo owner");
  await page
    .getByRole("link", { name: "Marketing calendar", exact: true })
    .click();
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await expect(page.locator(".calendar-week")).toBeVisible();
  await page.getByRole("link", { name: "Connections & settings" }).click();
  await expect(
    page.getByRole("heading", { name: "Platform connections" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test("API requires authentication, valid origin, and isolates demo sessions", async ({
  playwright,
}) => {
  const a = await playwright.request.newContext({
    baseURL: "http://localhost:3100",
    extraHTTPHeaders: { Origin: "http://localhost:3100" },
  });
  const b = await playwright.request.newContext({
    baseURL: "http://localhost:3100",
    extraHTTPHeaders: { Origin: "http://localhost:3100" },
  });
  expect((await a.get("/api/workspace")).status()).toBe(401);
  expect(
    (
      await a.post("/api/auth", {
        data: { action: "demo" },
        headers: { Origin: "https://attacker.example" },
      })
    ).status(),
  ).toBe(403);
  expect((await a.post("/api/auth", { data: { action: "demo" } })).ok()).toBe(
    true,
  );
  expect((await b.post("/api/auth", { data: { action: "demo" } })).ok()).toBe(
    true,
  );
  const one = await (await a.get("/api/workspace")).json(),
    two = await (await b.get("/api/workspace")).json();
  expect(one.workspace.business.id).not.toBe(two.workspace.business.id);
  const forbidden = await a.post("/api/workspace", {
    data: {
      revision: one.workspace.revision,
      operation: { type: "product.archive", id: two.workspace.products[0].id },
    },
  });
  expect(forbidden.status()).toBe(404);
  const forged = await a.post("/api/generate", {
    data: {
      revision: 0,
      productId: one.workspace.products[0].id,
      platform: "pinterest",
      objective: "awareness",
      tone: "professional",
    },
  });
  expect(forged.ok()).toBe(true);
  const state = await forged.json();
  const directPublish = await a.post("/api/workspace", {
    data: {
      revision: state.workspace.revision,
      operation: {
        type: "content.transition",
        id: state.workspace.content[0].id,
        version: 1,
        to: "published",
        confirmed: true,
        publishedUrl: "https://example.test/post",
      },
    },
  });
  expect(directPublish.status()).toBe(400);
  const queued = await a.post("/api/workspace", {
    data: {
      revision: state.workspace.revision,
      operation: { type: "automation.run", kind: "daily_drafts" },
    },
  });
  expect(queued.ok()).toBe(true);
  await expect
    .poll(
      async () => {
        const current = await (await a.get("/api/workspace")).json();
        return current.workspace.jobs[0]?.status;
      },
      { timeout: 15_000 },
    )
    .toBe("completed");
  const completed = await (await a.get("/api/workspace")).json();
  expect(completed.workspace.content).toHaveLength(2);
  expect(
    completed.workspace.content.every(
      (c: { status: string }) => c.status === "draft",
    ),
  ).toBe(true);
  await a.dispose();
  await b.dispose();
});
test("mobile navigation and layout remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Open demo workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Let’s make your next move." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "Product library", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Product library", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/mobile-products.png",
    fullPage: true,
  });
});
