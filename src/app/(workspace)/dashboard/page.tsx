"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Package,
  ClipboardCheck,
  CalendarDays,
  Send,
  Sparkles,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Heading, Badge, Empty } from "@/components/ui";
import { displayDate, money } from "@/lib/time";
export default function Dashboard() {
  const { workspace: w } = useWorkspace();
  const metrics = [
    {
      name: "Total products",
      value: w.products.length,
      icon: Package,
      path: "/products",
      note: "In your product library",
      color: "blue",
    },
    {
      name: "Awaiting approval",
      value: w.content.filter((c) => c.status === "pending_approval").length,
      icon: ClipboardCheck,
      path: "/approvals",
      note: "Ready for your review",
      color: "amber",
    },
    {
      name: "Scheduled content",
      value: w.content.filter((c) => c.status === "scheduled").length,
      icon: CalendarDays,
      path: "/calendar",
      note: "Planned for publication",
      color: "teal",
    },
    {
      name: "Published content",
      value: w.content.filter((c) => c.status === "published").length,
      icon: Send,
      path: "/publishing",
      note: "Manually confirmed",
      color: "purple",
    },
  ];
  const next = w.content
    .filter((c) => c.status === "scheduled" && c.scheduledAt)
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))
    .slice(0, 3);
  const failures =
    w.content.filter((c) => c.status === "failed").length +
    w.jobs.filter((j) => j.status === "failed").length;
  const currencies = [...new Set(w.sales.map((s) => s.currency))];
  const steps = [
    {
      label: "Complete your product details",
      done: w.products.some((p) => p.description && p.audience),
      path: "/products",
    },
    {
      label: "Create your first marketing draft",
      done: w.content.length > 0,
      path: "/studio",
    },
    {
      label: "Approve and schedule your content",
      done: w.approvals.some((a) => a.decision === "approved"),
      path: "/approvals",
    },
    {
      label: "Bring your Gumroad sales into view",
      done: w.sales.length > 0,
      path: "/analytics",
    },
  ];
  return (
    <>
      <Heading
        eyebrow="YOUR WORKSPACE, AT A GLANCE"
        title="Let’s make your next move."
        description="A clear view of your business. A focused plan for what’s next."
        action={
          <Link href="/studio" className="button primary">
            <Sparkles size={17} />
            Create content
          </Link>
        }
      />
      <div className="metric-grid">
        {metrics.map((m) => (
          <Link key={m.name} href={m.path} className="metric-card">
            <div className="metric-top">
              <span>{m.name}</span>
              <div className={`metric-icon ${m.color}`}>
                <m.icon size={19} />
              </div>
            </div>
            <strong>{m.value}</strong>
            <div className="metric-note">
              {m.note}
              <ArrowUpRight size={15} />
            </div>
          </Link>
        ))}
      </div>
      {failures > 0 && (
        <Link href="/automation" className="failure-notice">
          <AlertTriangle size={19} />
          {failures} task{failures === 1 ? "" : "s"} need attention. Review
          failed publishing and workflow activity.
          <ArrowRight size={18} />
        </Link>
      )}
      <div className="dashboard-main">
        <section className="hero-card">
          <div className="hero-orbit" aria-hidden="true">
            <LayersIllustration />
          </div>
          <span className="eyebrow">
            <Sparkles size={15} /> INTELLIGENCE, WITH INTENTION
          </span>
          <h2>
            Your next campaign
            <br />
            starts with one good idea.
          </h2>
          <p>
            Turn your product details into platform-specific content. Review it,
            make it yours, and choose when to share.
          </p>
          <Link href="/studio" className="button light">
            Open content studio
            <ArrowRight size={16} />
          </Link>
          <div className="hero-foot">
            <CheckCircle2 size={14} />
            Always reviewed by you before publishing
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Build your momentum</h2>
              <p>Your workspace checklist</p>
            </div>
            <span className="tag">
              {steps.filter((s) => s.done).length} / 4
            </span>
          </div>
          <div className="progress-track">
            <div
              style={{ width: `${steps.filter((s) => s.done).length * 25}%` }}
            />
          </div>
          <div className="checklist">
            {steps.map((s) => (
              <Link href={s.path} key={s.label}>
                {s.done ? (
                  <CheckCircle2 className="teal-text" size={19} />
                ) : (
                  <Circle size={19} />
                )}
                <span>{s.label}</span>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Coming up next</h2>
              <p>Scheduled in America/Jamaica</p>
            </div>
            <Link href="/calendar">
              View calendar
              <ArrowRight size={15} />
            </Link>
          </div>
          {next.length ? (
            <div className="list">
              {next.map((c) => (
                <div className="list-row" key={c.id}>
                  <div className="date-block">
                    <strong>
                      {displayDate(c.scheduledAt!, {
                        day: "numeric",
                        month: undefined,
                        hour: undefined,
                        minute: undefined,
                      })}
                    </strong>
                    <small>
                      {displayDate(c.scheduledAt!, {
                        month: "short",
                        day: undefined,
                        hour: undefined,
                        minute: undefined,
                      })}
                    </small>
                  </div>
                  <div>
                    <strong>{c.title || "Untitled draft"}</strong>
                    <small>{displayDate(c.scheduledAt!)}</small>
                  </div>
                  <Badge status={c.status} />
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Room for your next idea"
              description="Approved and scheduled content will appear here."
              action={
                <Link href="/studio" className="button secondary">
                  Create a draft
                  <ArrowRight size={15} />
                </Link>
              }
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent activity</h2>
              <p>Your workflow, recorded</p>
            </div>
            <Activity size={19} className="muted" />
          </div>
          {w.audit.length ? (
            <div className="activity-list">
              {w.audit
                .slice(-5)
                .reverse()
                .map((a) => (
                  <div className="activity-item" key={a.id}>
                    <div className="activity-dot" />
                    <div>
                      <strong>{a.detail}</strong>
                      <span>
                        {a.actorName} · {displayDate(a.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <Empty
              title="A fresh start"
              description="Your product, approval, and publishing activity will be recorded here."
            />
          )}
        </section>
        <section className="panel sales-preview">
          <div className="panel-heading">
            <div>
              <h2>Sales snapshot</h2>
              <p>
                {w.sales.length
                  ? "From imported CSV data"
                  : "Connect the dots with real data"}
              </p>
            </div>
          </div>
          <span className="small muted">GROSS SALES · BEFORE FEES</span>
          <strong className="sales-number">
            {currencies.length === 1
              ? money(
                  w.sales.reduce((n, s) => n + s.grossCents, 0),
                  currencies[0],
                )
              : currencies.length > 1
                ? `${currencies.length} currencies`
                : "—"}
          </strong>
          <p>
            {w.sales.length
              ? `${w.sales.length} unique purchases imported. Refunds and currency breakdowns are in analytics.`
              : "No sales data imported yet. Upload your official Gumroad sales CSV to see your performance."}
          </p>
          <Link href="/analytics" className="button secondary">
            {w.sales.length ? "View performance" : "Import sales CSV"}
            <ArrowRight size={16} />
          </Link>
          <span className="small muted">
            No estimated or fabricated revenue.
          </span>
        </section>
      </div>
    </>
  );
}
function LayersIllustration() {
  return (
    <svg viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="76" stroke="currentColor" opacity=".2" />
      <circle cx="100" cy="100" r="55" stroke="currentColor" opacity=".3" />
      <path
        d="m100 57 43 25-43 25-43-25 43-25ZM57 100l43 25 43-25M57 119l43 25 43-25"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="36" cy="57" r="5" fill="currentColor" />
      <circle cx="164" cy="137" r="6" fill="currentColor" />
    </svg>
  );
}
