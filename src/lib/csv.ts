import Papa from "papaparse";
import { randomUUID } from "node:crypto";
import type { Product, Sale } from "./model";
import { DomainError } from "./workflow";

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
const normalize = (header: string) =>
  header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[ _-]+/g, " ");
const aliases = {
  purchaseId: ["purchase id", "sale id", "order id", "id"],
  productName: ["product name", "product"],
  gross: [
    "gross",
    "gross sale",
    "gross sales",
    "sale price",
    "price",
    "amount",
  ],
  currency: ["currency", "currency code"],
  date: [
    "sale date",
    "date",
    "created at",
    "created",
    "date created",
    "purchase date",
    "sale timestamp",
    "timestamp",
  ],
  refunded: ["refunded", "refunded?", "is refunded"],
  refund: ["refund amount", "amount refunded", "refund"],
};
export interface CsvOptions {
  mapping?: Partial<Record<keyof typeof aliases, string>>;
  defaultCurrency?: string;
  sourceTimezone?: "UTC" | "America/Jamaica";
}
function amount(value: string, line: number, label: string): number {
  const clean = value
    .trim()
    .replace(/[$£€¥]/g, "")
    .replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean))
    throw new DomainError(
      `Row ${line}: ${label} must be a non-negative decimal with at most two fractional digits.`,
    );
  const [whole, fractional = ""] = clean.split(".");
  const result = Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 100_000_000)
    throw new DomainError(
      `Row ${line}: ${label} is outside the supported range.`,
    );
  return result;
}
function timestamp(
  raw: string,
  line: number,
  timezone?: CsvOptions["sourceTimezone"],
): string {
  if (
    /^\d{4}-\d{2}-\d{2}(T| )\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw) &&
    timezone
  )
    raw = raw.replace(" ", "T") + (timezone === "UTC" ? "Z" : "-05:00");
  if (
    !/^\d{4}-\d{2}-\d{2}(T| )[\d:.]+(Z|[+-]\d{2}:?\d{2})$/.test(raw) &&
    !/^\d{4}-\d{2}-\d{2}$/.test(raw)
  )
    throw new DomainError(
      `Row ${line}: use ISO 8601 dates, and select the export's timezone if timestamps have no offset.`,
    );
  const [year, month, day] = raw.slice(0, 10).split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  )
    throw new DomainError(`Row ${line}: invalid calendar date.`);
  const date = new Date(
    raw.length === 10 ? `${raw}T00:00:00Z` : raw.replace(" ", "T"),
  );
  if (!Number.isFinite(date.getTime()))
    throw new DomainError(`Row ${line}: invalid date.`);
  return date.toISOString();
}
export function parseSalesCsv(
  text: string,
  products: Product[],
  at = new Date(),
  options: CsvOptions = {},
): Sale[] {
  if (Buffer.byteLength(text, "utf8") > MAX_CSV_BYTES)
    throw new DomainError("CSV files are limited to 2 MB.", 413);
  if (text.includes("\0"))
    throw new DomainError("CSV contains invalid binary data.");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalize,
    dynamicTyping: false,
  });
  if (parsed.errors.length)
    throw new DomainError(
      `CSV could not be parsed: ${parsed.errors[0].message}`,
    );
  const headers = parsed.meta.fields ?? [];
  const mapping = Object.fromEntries(
    Object.entries(aliases).map(([key, variants]) => [
      key,
      options.mapping?.[key as keyof typeof aliases]
        ? normalize(options.mapping[key as keyof typeof aliases]!)
        : variants.find((h) => headers.includes(h)),
    ]),
  );
  for (const [key, header] of Object.entries(mapping))
    if (header && !headers.includes(header))
      throw new DomainError(`Mapped ${key} column does not exist in this CSV.`);
  for (const key of ["purchaseId", "productName", "gross", "currency", "date"])
    if (!mapping[key] && !(key === "currency" && options.defaultCurrency))
      throw new DomainError(
        `Missing ${key} column. Map this field before importing. Accepted headers: ${aliases[key as keyof typeof aliases].join(", ")}.`,
      );
  if (!parsed.data.length || parsed.data.length > 10_000)
    throw new DomainError("Upload between 1 and 10,000 purchase rows.");
  const sales = new Map<string, Sale>();
  parsed.data.forEach((row, index) => {
    const line = index + 2;
    const get = (key: keyof typeof aliases) =>
      (mapping[key] ? (row[mapping[key]!] ?? "") : "").trim();
    const purchaseId = get("purchaseId"),
      productName = get("productName"),
      currency = (
        get("currency") ||
        options.defaultCurrency ||
        ""
      ).toUpperCase();
    if (
      !purchaseId ||
      purchaseId.length > 200 ||
      !productName ||
      productName.length > 300
    )
      throw new DomainError(
        `Row ${line}: a valid purchase ID and product name are required.`,
      );
    if ([purchaseId, productName].some((v) => /^[=+@\t\r]/.test(v)))
      throw new DomainError(
        `Row ${line}: formula-like identifiers are not supported.`,
      );
    if (!/^[A-Z]{3}$/.test(currency))
      throw new DomainError(`Row ${line}: use a three-letter currency code.`);
    try {
      new Intl.NumberFormat("en", { style: "currency", currency }).format(0);
    } catch {
      throw new DomainError(`Row ${line}: invalid currency.`);
    }
    const grossCents = amount(get("gross"), line, "gross amount");
    const refundFlag = get("refunded").toLowerCase();
    if (
      refundFlag &&
      !["1", "0", "true", "false", "yes", "no"].includes(refundFlag)
    )
      throw new DomainError(
        `Row ${line}: refunded must be true/false or yes/no.`,
      );
    const refundCents = get("refund")
      ? amount(get("refund"), line, "refund amount")
      : ["true", "yes", "1"].includes(refundFlag)
        ? grossCents
        : 0;
    if (refundCents > grossCents)
      throw new DomainError(`Row ${line}: refund exceeds gross sales.`);
    const sale: Sale = {
      id: randomUUID(),
      purchaseId,
      productName,
      productId:
        products.find((p) => p.name.toLowerCase() === productName.toLowerCase())
          ?.id ?? null,
      grossCents,
      refundCents,
      currency,
      purchasedAt: timestamp(get("date"), line, options.sourceTimezone),
      importedAt: at.toISOString(),
    };
    const old = sales.get(purchaseId);
    if (
      old &&
      (old.grossCents !== sale.grossCents ||
        old.currency !== sale.currency ||
        old.productName !== sale.productName ||
        old.purchasedAt !== sale.purchasedAt)
    )
      throw new DomainError(
        `Row ${line}: purchase ID ${purchaseId} has conflicting duplicate rows.`,
      );
    if (old) old.refundCents = Math.max(old.refundCents, refundCents);
    else sales.set(purchaseId, sale);
  });
  return [...sales.values()];
}
export function summarizeSales(sales: Sale[]) {
  return [...new Set(sales.map((s) => s.currency))].sort().map((currency) => {
    const rows = sales.filter((s) => s.currency === currency);
    return {
      currency,
      count: rows.length,
      grossCents: rows.reduce((n, s) => n + s.grossCents, 0),
      refundCents: rows.reduce((n, s) => n + s.refundCents, 0),
    };
  });
}
