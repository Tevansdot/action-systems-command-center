"use client";
import { useState } from "react";
import Papa from "papaparse";
import {
  Upload,
  ShieldCheck,
  Receipt,
  Banknote,
  RotateCcw,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Heading, Button, Modal, Field, Empty } from "@/components/ui";
import { displayDate, jamaicaDay, money } from "@/lib/time";
export default function Analytics() {
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const { workspace: w, actor, busy, request } = useWorkspace(),
    [open, setOpen] = useState(false),
    [currency, setCurrency] = useState("all"),
    [product, setProduct] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const currencies = [...new Set(w.sales.map((s) => s.currency))].sort();
  const sales = w.sales.filter(
    (s) =>
      (currency === "all" || s.currency === currency) &&
      (product === "all" || s.productName === product) &&
      (!from || jamaicaDay(s.purchasedAt) >= from) &&
      (!to || jamaicaDay(s.purchasedAt) <= to),
  );
  const totals = [...new Set(sales.map((s) => s.currency))].map((code) => ({
    code,
    gross: sales
      .filter((s) => s.currency === code)
      .reduce((n, s) => n + s.grossCents, 0),
    refunds: sales
      .filter((s) => s.currency === code)
      .reduce((n, s) => n + s.refundCents, 0),
  }));
  const total = (key: "gross" | "refunds") =>
    totals.length === 1
      ? money(totals[0][key], totals[0].code)
      : totals.length
        ? `${totals.length} currencies`
        : "—";
  async function upload(form: FormData) {
    form.set("revision", String(w.revision));
    const ok = await request(
      "/api/sales/import",
      form,
      "CSV imported. Duplicate purchase IDs were skipped; represented refunds were updated.",
    );
    if (ok) setOpen(false);
  }
  const productNames = [...new Set(sales.map((s) => s.productName))].sort(),
    dates = [...new Set(sales.map((s) => jamaicaDay(s.purchasedAt)))]
      .sort()
      .reverse();
  return (
    <>
      <Heading
        eyebrow="REAL DATA, CLEARER DECISIONS"
        title="Gumroad sales analytics"
        description="Understand your performance from imported purchases. No estimates or invented results."
        action={
          ["owner", "editor"].includes(actor.role) && (
            <Button onClick={() => setOpen(true)}>
              <Upload size={17} />
              Import sales CSV
            </Button>
          )
        }
      />
      <div className="toolbar analytics-filters">
        <select
          aria-label="Sales currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          <option value="all">All currencies (separate totals)</option>
          {currencies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Sales product"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        >
          <option value="all">All products</option>
          {[...new Set(w.sales.map((s) => s.productName))].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <label className="inline-label">
          From
          <input
            type="date"
            aria-label="Sales from date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="inline-label">
          To
          <input
            type="date"
            aria-label="Sales to date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span>Unique purchases</span>
            <Receipt size={20} />
          </div>
          <strong>{w.sales.length ? sales.length : "—"}</strong>
          <p className="metric-note">Deduplicated by purchase ID</p>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Gross sales</span>
            <Banknote size={20} />
          </div>
          <strong>{total("gross")}</strong>
          <p className="metric-note">Before refunds, fees & taxes</p>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Represented refunds</span>
            <RotateCcw size={20} />
          </div>
          <strong>{total("refunds")}</strong>
          <p className="metric-note">Only when present in CSV data</p>
        </div>
        <div className="metric-card">
          <div className="metric-top">
            <span>Net proceeds</span>
            <TrendingUp size={20} />
          </div>
          <strong>—</strong>
          <p className="metric-note">Fee and payout data not imported</p>
        </div>
      </div>
      {!w.sales.length ? (
        <div className="panel analytics-empty">
          <Empty
            title="Your real performance starts here"
            description="Export your sales CSV from Gumroad and import it. Purchase identifiers keep repeated imports from inflating your results."
            action={
              <Button variant="secondary" onClick={() => setOpen(true)}>
                <FileSpreadsheet size={16} />
                Choose a CSV file
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="notice">
            <ShieldCheck size={19} />
            <div>
              <strong>
                Imported data ·{" "}
                {actor.mode === "demo"
                  ? "local demo workspace"
                  : "private live workspace"}
              </strong>
              <p>
                CSV format and purchase IDs are validated; the file’s origin is
                supplied by you. These are gross sales, not net earnings.
                Currencies are never added together. Buyer emails are discarded.
              </p>
            </div>
          </div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Totals by currency</h2>
                <p>Amounts stay in their original currency</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th>Sales</th>
                    <th>Gross sales</th>
                    <th>Refunds</th>
                    <th>Gross less refunds (before fees)</th>
                  </tr>
                </thead>
                <tbody>
                  {totals.map((t) => (
                    <tr key={t.code}>
                      <td>{t.code}</td>
                      <td>
                        {sales.filter((s) => s.currency === t.code).length}
                      </td>
                      <td>{money(t.gross, t.code)}</td>
                      <td>{money(t.refunds, t.code)}</td>
                      <td>{money(t.gross - t.refunds, t.code)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="analytics-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Product performance</h2>
                  <p>Unique purchases and gross amounts</p>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Currency</th>
                      <th>Sales</th>
                      <th>Gross</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productNames.flatMap((name) =>
                      [
                        ...new Set(
                          sales
                            .filter((s) => s.productName === name)
                            .map((s) => s.currency),
                        ),
                      ].map((code) => {
                        const rows = sales.filter(
                          (s) => s.productName === name && s.currency === code,
                        );
                        return (
                          <tr key={`${name}-${code}`}>
                            <td>{name}</td>
                            <td>{code}</td>
                            <td>{rows.length}</td>
                            <td>
                              {money(
                                rows.reduce((n, s) => n + s.grossCents, 0),
                                code,
                              )}
                            </td>
                          </tr>
                        );
                      }),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Revenue by date</h2>
                  <p>America/Jamaica dates · gross before fees</p>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Currency</th>
                      <th>Sales</th>
                      <th>Gross</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dates.flatMap((day) =>
                      [
                        ...new Set(
                          sales
                            .filter((s) => jamaicaDay(s.purchasedAt) === day)
                            .map((s) => s.currency),
                        ),
                      ].map((code) => {
                        const rows = sales.filter(
                          (s) =>
                            jamaicaDay(s.purchasedAt) === day &&
                            s.currency === code,
                        );
                        return (
                          <tr key={`${day}-${code}`}>
                            <td>{day}</td>
                            <td>{code}</td>
                            <td>{rows.length}</td>
                            <td>
                              {money(
                                rows.reduce((n, s) => n + s.grossCents, 0),
                                code,
                              )}
                            </td>
                          </tr>
                        );
                      }),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <section className="panel history-panel">
            <div className="panel-heading">
              <div>
                <h2>Purchase ledger</h2>
                <p>No buyer emails or names are stored</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Purchase ID</th>
                    <th>Product</th>
                    <th>Date</th>
                    <th>Gross</th>
                    <th>Refunds</th>
                  </tr>
                </thead>
                <tbody>
                  {sales
                    .slice()
                    .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))
                    .slice(0, 200)
                    .map((s) => (
                      <tr key={s.id}>
                        <td className="mono">{s.purchaseId}</td>
                        <td>{s.productName}</td>
                        <td>{displayDate(s.purchasedAt)}</td>
                        <td>{money(s.grossCents, s.currency)}</td>
                        <td>{money(s.refundCents, s.currency)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {sales.length > 200 && (
              <p className="small panel-empty-text">
                Showing the latest 200 purchases. Totals include all filtered
                rows.
              </p>
            )}
          </section>
        </>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Import Gumroad sales"
        description="Upload an official sales export, up to 2 MB and 10,000 rows."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void upload(new FormData(e.currentTarget));
          }}
        >
          <Field label="Sales CSV">
            <input
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file || file.size > 2 * 1024 * 1024) {
                  setCsvHeaders([]);
                  return;
                }
                Papa.parse(file, {
                  header: true,
                  preview: 1,
                  complete: (result) => setCsvHeaders(result.meta.fields || []),
                });
              }}
            />
          </Field>
          <div className="form-grid">
            <Field
              label="Currency if absent from export"
              hint="Leave blank when the CSV includes a currency column."
            >
              <input
                name="defaultCurrency"
                placeholder="e.g. USD"
                maxLength={3}
                pattern="[A-Za-z]{3}"
              />
            </Field>
            <Field label="Timezone for timestamps without an offset">
              <select name="sourceTimezone">
                <option value="">Require an explicit offset</option>
                <option value="UTC">Export is in UTC</option>
                <option value="America/Jamaica">
                  Export is in America/Jamaica
                </option>
              </select>
            </Field>
          </div>
          {csvHeaders.length > 0 && (
            <details className="csv-mapping">
              <summary>Map export columns (optional)</summary>
              <div className="form-grid">
                {[
                  ["purchaseId", "Purchase identifier"],
                  ["productName", "Product name"],
                  ["gross", "Gross amount"],
                  ["currency", "Currency"],
                  ["date", "Purchase date"],
                  ["refunded", "Refunded flag"],
                  ["refund", "Refund amount"],
                ].map(([key, label]) => (
                  <Field label={label} key={key}>
                    <select name={`map.${key}`}>
                      <option value="">Detect automatically</option>
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            </details>
          )}
          <div className="csv-help">
            <strong>Required columns</strong>
            <p>
              Purchase ID (or Sale ID / ID), Product Name (or Product), Price
              (or Amount / Gross), Currency, Date (or Sale Date / Created At).
            </p>
            <p>
              Dates use ISO 8601 with a timezone, or YYYY-MM-DD (UTC). Amounts
              use decimal currency units. Optional: Refunded (true/false) and
              Refund Amount.
            </p>
            <p>
              If your export uses different headers, map its columns above.
              Confirm its currency or timezone only when absent from the file.
              Fees, customer names, and emails are ignored. Conflicting
              duplicate IDs reject the whole import.
            </p>
            <code>Purchase ID,Product,Price,Currency,Date,Refunded</code>
          </div>
          <div className="modal-actions">
            <Button disabled={busy}>
              {busy ? "Importing…" : "Import CSV"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
