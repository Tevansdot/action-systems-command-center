"use client";
import {
  Sparkles,
  ClipboardCheck,
  FileText,
  CalendarClock,
  Play,
  AlertTriangle,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Heading, Button, Badge, Empty } from "@/components/ui";
import { ContentCard } from "@/components/content-card";
import { displayDate } from "@/lib/time";
import type { Job } from "@/lib/model";
const recipes: {
  kind: Job["kind"];
  title: string;
  description: string;
  icon: typeof Sparkles;
}[] = [
  {
    kind: "daily_suggestions",
    title: "Content suggestions",
    description:
      "Prepare product-based suggestions, then create drafts in the studio.",
    icon: Sparkles,
  },
  {
    kind: "daily_drafts",
    title: "Prepare content drafts",
    description:
      "Create unapproved Pinterest drafts for up to five products in the background.",
    icon: FileText,
  },
  {
    kind: "approval_reminders",
    title: "Approval reminder",
    description: "Count pending reviews and record an internal reminder.",
    icon: ClipboardCheck,
  },
  {
    kind: "marketing_summary",
    title: "Marketing summary",
    description: "A concise view of scheduled, published, and failed content.",
    icon: FileText,
  },
  {
    kind: "publishing_review",
    title: "Due publishing review",
    description:
      "Identify due approved posts for manual publishing. No external publishing calls.",
    icon: CalendarClock,
  },
];
export default function Automation() {
  const { workspace: w, actor, mutate, busy, request } = useWorkspace(),
    failed = w.content.filter((c) => c.status === "failed");
  return (
    <>
      <Heading
        eyebrow="A STEADIER WAY TO WORK"
        title="Approval-based workflows"
        description="Helpful routines that prepare the next step. You decide what happens outside this workspace."
      />
      <div className="notice">
        <CalendarClock size={21} />
        <div>
          <strong>Background workflows · Human-triggered</strong>
          <p>
            These workflows queue suggestions, draft creation, summaries, and
            review reminders inside your workspace. Daily scheduling and OAuth
            publishing are future integrations; no external messages are sent.
          </p>
        </div>
      </div>
      <div className="workflow-grid">
        {recipes.map((r) => (
          <section className="panel workflow-card" key={r.kind}>
            <div className="workflow-icon">
              <r.icon size={23} />
            </div>
            <h2>{r.title}</h2>
            <p>{r.description}</p>
            <div className="workflow-foot">
              <span className="tag">MANUAL TRIGGER</span>
              <Button
                variant="secondary"
                disabled={busy || !["owner", "editor"].includes(actor.role)}
                onClick={() =>
                  void mutate(
                    { type: "automation.run", kind: r.kind },
                    "Workflow queued. Its result will appear in the run history.",
                  )
                }
              >
                <Play size={13} />
                Run now
              </Button>
            </div>
          </section>
        ))}
      </div>
      {failed.length > 0 && (
        <section className="history-panel">
          <div className="section-toolbar">
            <h2>
              <AlertTriangle size={20} />
              Failed publishing tasks
            </h2>
            <span>{failed.length} need attention</span>
          </div>
          <div className="content-grid">
            {failed.map((c) => (
              <ContentCard content={c} key={c.id} />
            ))}
          </div>
        </section>
      )}
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>Workflow runs</h2>
            <p>Results and failures stay visible</p>
          </div>
        </div>
        {w.jobs.length ? (
          <div className="job-list">
            {w.jobs
              .slice()
              .reverse()
              .map((j) => (
                <article key={j.id}>
                  <div>
                    <h3>
                      {recipes.find((r) => r.kind === j.kind)?.title || j.kind}
                    </h3>
                    <Badge status={j.status} />
                  </div>
                  <p>{j.result}</p>
                  {["failed", "queued", "running"].includes(j.status) && (
                    <Button
                      variant="secondary"
                      disabled={
                        busy ||
                        (j.status === "running" &&
                          Boolean(j.leaseUntil) &&
                          new Date(j.leaseUntil!) > new Date())
                      }
                      onClick={() =>
                        void request(
                          "/api/jobs/retry",
                          { jobId: j.id, revision: w.revision },
                          "Workflow queued for recovery.",
                        )
                      }
                    >
                      Retry / recover job
                    </Button>
                  )}
                  <span className="muted small">
                    {displayDate(j.createdAt)}
                    {j.finishedAt
                      ? ` · Finished ${displayDate(j.finishedAt)}`
                      : ""}
                  </span>
                </article>
              ))}
          </div>
        ) : (
          <Empty
            title="Ready when you are"
            description="Run a workflow to start your internal activity history."
          />
        )}
      </section>
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>Audit log</h2>
            <p>Changes, approvals, imports, and manual confirmations</p>
          </div>
        </div>
        {w.audit.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Details</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {w.audit
                  .slice(-100)
                  .reverse()
                  .map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{a.action}</td>
                      <td>{a.actorName}</td>
                      <td>{a.detail}</td>
                      <td>{displayDate(a.createdAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="panel-empty-text">No workflow events recorded yet.</p>
        )}
      </section>
    </>
  );
}
