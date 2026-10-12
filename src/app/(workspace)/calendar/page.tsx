"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Heading, Button, Modal } from "@/components/ui";
import { ContentCard } from "@/components/content-card";
import { platformLabels, platforms } from "@/lib/model";
import { jamaicaDay, utcToJamaicaInput, displayDate } from "@/lib/time";
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
export default function Calendar() {
  const { workspace: w } = useWorkspace(),
    [mode, setMode] = useState<"month" | "week">("month"),
    [anchor, setAnchor] = useState(
      () =>
        new Date(
          `${utcToJamaicaInput(new Date().toISOString()).slice(0, 10)}T12:00:00Z`,
        ),
    ),
    [platform, setPlatform] = useState("all"),
    [product, setProduct] = useState("all"),
    [selected, setSelected] = useState<string | null>(null);
  const start =
    mode === "month"
      ? new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 12))
      : new Date(anchor);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const days = Array.from({ length: mode === "month" ? 42 : 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
  const entries = w.content.filter(
    (c) =>
      ["scheduled", "published", "failed"].includes(c.status) &&
      (c.scheduledAt || c.publishedAt) &&
      (platform === "all" || c.platform === platform) &&
      (product === "all" || c.productId === product),
  );
  const visible = entries.filter((c) => {
    const key = jamaicaDay((c.scheduledAt || c.publishedAt)!);
    return key >= dayKey(days[0]) && key <= dayKey(days[days.length - 1]);
  });
  const content = w.content.find((c) => c.id === selected),
    today = jamaicaDay(new Date().toISOString());
  function move(offset: number) {
    const date = new Date(anchor);
    if (mode === "month") {
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + offset);
    } else date.setUTCDate(date.getUTCDate() + offset * 7);
    setAnchor(date);
  }
  return (
    <>
      <Heading
        eyebrow="GIVE YOUR CONTENT A RHYTHM"
        title="Marketing calendar"
        description="Plan with intention. Reschedule when plans change. Track what’s actually published."
        action={
          <Link href="/approvals" className="button primary">
            <Plus size={17} />
            Schedule approved content
          </Link>
        }
      />
      <div className="calendar-summary">
        <div>
          <CalendarDays size={19} />
          <strong>
            {visible.filter((c) => c.status === "scheduled").length}
          </strong>
          <span>Planned in view</span>
        </div>
        <div>
          <span className="status-dot teal" />
          <strong>
            {visible.filter((c) => c.status === "published").length}
          </strong>
          <span>Completed in view</span>
        </div>
        <div>
          <span className="status-dot red" />
          <strong>{visible.filter((c) => c.status === "failed").length}</strong>
          <span>Need attention</span>
        </div>
        <span className="timezone-label">America/Jamaica · UTC−05:00</span>
      </div>
      <section className="panel calendar-panel">
        <div className="calendar-toolbar">
          <div className="calendar-navigation">
            <Button
              variant="ghost"
              aria-label="Previous period"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={18} />
            </Button>
            <h2>
              {mode === "month"
                ? displayDate(anchor.toISOString(), {
                    month: "long",
                    year: "numeric",
                    day: undefined,
                    hour: undefined,
                    minute: undefined,
                  })
                : `${displayDate(days[0].toISOString(), { hour: undefined, minute: undefined })} – ${displayDate(days[6].toISOString(), { hour: undefined, minute: undefined })}`}
            </h2>
            <Button
              variant="ghost"
              aria-label="Next period"
              onClick={() => move(1)}
            >
              <ChevronRight size={18} />
            </Button>
            <Button
              variant="secondary"
              onClick={() => setAnchor(new Date(`${today}T12:00:00Z`))}
            >
              Today
            </Button>
          </div>
          <div className="calendar-filters">
            <select
              aria-label="Filter calendar by product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            >
              <option value="all">All products</option>
              {w.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter calendar by platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              <option value="all">All platforms</option>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {platformLabels[p]}
                </option>
              ))}
            </select>
            <div className="segmented">
              <button
                className={mode === "month" ? "active" : ""}
                onClick={() => setMode("month")}
                aria-pressed={mode === "month"}
              >
                Month
              </button>
              <button
                className={mode === "week" ? "active" : ""}
                onClick={() => setMode("week")}
                aria-pressed={mode === "week"}
              >
                Week
              </button>
            </div>
          </div>
        </div>
        <div className="calendar-scroll">
          <div
            className={`calendar-grid ${mode === "week" ? "calendar-week" : ""}`}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="calendar-day-name">
                {d}
              </div>
            ))}
            {days.map((d) => (
              <div
                className={`calendar-cell ${d.getUTCMonth() !== anchor.getUTCMonth() && mode === "month" ? "outside" : ""}`}
                key={dayKey(d)}
              >
                <span
                  className={`calendar-date ${dayKey(d) === today ? "today" : ""}`}
                >
                  {d.getUTCDate()}
                </span>
                {entries
                  .filter(
                    (c) =>
                      jamaicaDay((c.scheduledAt || c.publishedAt)!) ===
                      dayKey(d),
                  )
                  .map((c) => (
                    <button
                      className={`calendar-event event-${c.status}`}
                      key={c.id}
                      onClick={() => setSelected(c.id)}
                    >
                      <span className="event-platform">
                        {platformLabels[c.platform]}
                      </span>
                      <strong>{c.title || "Untitled draft"}</strong>
                      <span>
                        {displayDate((c.scheduledAt || c.publishedAt)!, {
                          month: undefined,
                          day: undefined,
                        })}{" "}
                        · {c.status}
                      </span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
        <div className="calendar-legend">
          <span>
            <i className="status-dot blue" />
            Scheduled
          </span>
          <span>
            <i className="status-dot teal" />
            Manually published
          </span>
          <span>
            <i className="status-dot red" />
            Failed
          </span>
          <p>Click a post to review, reschedule, or record publication.</p>
        </div>
      </section>
      <Modal
        open={Boolean(content)}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title="Scheduled content"
        description="A schedule is a plan; publication must be manually confirmed."
        wide
      >
        {content && <ContentCard content={content} />}
      </Modal>
    </>
  );
}
