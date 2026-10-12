import { describe, expect, it } from "vitest";
import { parseSalesCsv, summarizeSales, MAX_CSV_BYTES } from "@/lib/csv";
import { createWorkspace } from "@/lib/seed";
import { applyOperation } from "@/lib/workflow";
import { randomUUID } from "node:crypto";
const w = createWorkspace();
const csv =
  "Purchase ID,Product,Price,Currency,Date,Refunded,Email\npurchase-1,Service Profit OS,19.95,USD,2026-10-12T12:00:00Z,false,buyer@example.com\npurchase-2,Service Profit OS,10.00,USD,2026-10-13T12:00:00Z,true,other@example.com";
const actor = {
  id: randomUUID(),
  name: "Owner",
  role: "owner" as const,
  mode: "demo" as const,
};
describe("sales CSV import", () => {
  it("parses integer cents, product association and represented refunds", () => {
    const s = parseSalesCsv(csv, w.products);
    expect(s[0].grossCents).toBe(1995);
    expect(s[0].productId).toBe(w.products[0].id);
    expect(s[1].refundCents).toBe(1000);
    expect(summarizeSales(s)[0]).toMatchObject({
      count: 2,
      grossCents: 2995,
      refundCents: 1000,
    });
  });
  it("never retains buyer email or customer fields", () => {
    expect(JSON.stringify(parseSalesCsv(csv, w.products))).not.toContain(
      "example.com",
    );
  });
  it("deduplicates across repeated imports", () => {
    const s = parseSalesCsv(csv, w.products);
    let next = applyOperation(w, { type: "sales.import", sales: s }, actor);
    next = applyOperation(
      next,
      { type: "sales.import", sales: parseSalesCsv(csv, w.products) },
      actor,
    );
    expect(next.sales).toHaveLength(2);
    expect(next.audit[1].detail).toContain("skipped 2 duplicates");
  });
  it("updates a refund on a later export without adding a purchase", () => {
    let next = applyOperation(
      w,
      { type: "sales.import", sales: parseSalesCsv(csv, w.products) },
      actor,
    );
    const updated = csv.replace("false,buyer", "true,buyer");
    next = applyOperation(
      next,
      { type: "sales.import", sales: parseSalesCsv(updated, w.products) },
      actor,
    );
    expect(next.sales).toHaveLength(2);
    expect(next.sales[0].refundCents).toBe(1995);
  });
  it("separates currencies instead of adding them", () => {
    const changed = csv.replace("10.00,USD", "10.00,EUR");
    expect(summarizeSales(parseSalesCsv(changed, w.products))).toHaveLength(2);
  });
  it("accepts BOM, quoted names, aliases and explicit partial refunds", () => {
    const data =
      '\uFEFFSale ID,Product Name,Gross,Currency Code,Sale Date,Refund Amount\nabc,"Product, One",25.50,USD,2026-10-12,5.25';
    expect(parseSalesCsv(data, w.products)[0]).toMatchObject({
      purchaseId: "abc",
      productName: "Product, One",
      grossCents: 2550,
      refundCents: 525,
    });
  });
  it("rejects invalid decimals, refunds, dates and missing IDs", () => {
    for (const changed of [
      csv.replace("19.95", "19.999"),
      csv.replace("19.95", "-1"),
      csv.replace("2026-10-12T12:00:00Z", "not-a-date"),
      csv.replace("purchase-1,", ","),
    ])
      expect(() => parseSalesCsv(changed, w.products)).toThrow();
    expect(() =>
      parseSalesCsv(
        "ID,Product,Price,Currency,Date,Refund Amount\na,p,1.00,USD,2026-10-12,2.00",
        w.products,
      ),
    ).toThrow("refund exceeds");
  });
  it("rejects conflicting duplicate IDs atomically", () => {
    const data =
      csv +
      "\npurchase-1,Service Profit OS,20.00,USD,2026-10-12T12:00:00Z,false,";
    expect(() => parseSalesCsv(data, w.products)).toThrow("conflicting");
    const state = applyOperation(
      w,
      { type: "sales.import", sales: parseSalesCsv(csv, w.products) },
      actor,
    );
    const bad = parseSalesCsv(csv.replace("19.95", "25.00"), w.products);
    expect(() =>
      applyOperation(state, { type: "sales.import", sales: bad }, actor),
    ).toThrow("conflicts");
    expect(state.sales[0].grossCents).toBe(1995);
  });
  it("collapses matching duplicate rows within one upload", () => {
    const data =
      csv +
      "\npurchase-1,Service Profit OS,19.95,USD,2026-10-12T12:00:00Z,false,";
    expect(parseSalesCsv(data, w.products)).toHaveLength(2);
  });
  it("rejects malformed or oversized files and formula-like identifiers", () => {
    expect(() =>
      parseSalesCsv("x".repeat(MAX_CSV_BYTES + 1), w.products),
    ).toThrow("2 MB");
    expect(() =>
      parseSalesCsv(csv.replace("purchase-1", "=SUM(1)"), w.products),
    ).toThrow("formula");
    expect(() => parseSalesCsv("Email,Date\nx,2026-10-12", w.products)).toThrow(
      "Missing",
    );
  });
  it("supports explicit mapping, a confirmed currency, and offset-free export timestamps", () => {
    const data =
      "Order,Item,Amount ($),Created\nmap-1,Service Profit OS,25.50,2026-10-12 09:30:00";
    expect(
      parseSalesCsv(data, w.products, new Date(), {
        mapping: {
          purchaseId: "Order",
          productName: "Item",
          gross: "Amount ($)",
        },
        defaultCurrency: "USD",
        sourceTimezone: "America/Jamaica",
      })[0],
    ).toMatchObject({
      grossCents: 2550,
      currency: "USD",
      purchasedAt: "2026-10-12T14:30:00.000Z",
    });
  });
  it("does not guess the timezone or currency and rejects impossible dates", () => {
    expect(() =>
      parseSalesCsv(
        csv.replace("2026-10-12T12:00:00Z", "2026-10-12 12:00:00"),
        w.products,
      ),
    ).toThrow("timezone");
    expect(() =>
      parseSalesCsv(
        csv.replace("2026-10-12T12:00:00Z", "2026-02-30T12:00:00Z"),
        w.products,
      ),
    ).toThrow("calendar");
  });
});
