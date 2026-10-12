"use client";
import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Heading, Empty } from "@/components/ui";
import { ContentCard } from "@/components/content-card";
import { displayDate } from "@/lib/time";
export default function Approvals() {
  const { workspace: w } = useWorkspace(),
    [filter, setFilter] = useState("pending_approval");
  const filtered = w.content
    .filter((c) => filter === "all" || c.status === filter)
    .slice()
    .reverse();
  return (
    <>
      <Heading
        eyebrow="HUMAN JUDGMENT, AT THE CENTER"
        title="Approval queue"
        description="Check the facts, refine the message, and give good content the green light."
      />
      <div className="approval-process">
        <ShieldCheck size={22} />
        <strong>Draft</strong>
        <span>→</span>
        <strong>Pending approval</strong>
        <span>→</span>
        <strong>Approved</strong>
        <span>→</span>
        <strong>Scheduled</strong>
        <span>→</span>
        <strong>Manually published</strong>
      </div>
      <div className="tabs" role="group" aria-label="Filter approval queue">
        {[
          ["pending_approval", "Awaiting review"],
          ["approved", "Approved"],
          ["rejected", "Rejected"],
          ["all", "All content"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
          >
            {label}
            <span>
              {value === "all"
                ? w.content.length
                : w.content.filter((c) => c.status === value).length}
            </span>
          </button>
        ))}
      </div>
      {filtered.length ? (
        <div className="content-grid">
          {filtered.map((c) => (
            <ContentCard key={c.id} content={c} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title={
              filter === "pending_approval"
                ? "You’re all caught up"
                : "No content in this view"
            }
            description="Create a draft in the studio, review its details, and request approval."
            action={
              <Link className="button secondary" href="/studio">
                <Sparkles size={15} />
                Open content studio
              </Link>
            }
          />
        </div>
      )}
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>Approval history</h2>
            <p>Who made each decision, and when</p>
          </div>
        </div>
        {w.approvals.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Content</th>
                  <th>Decision</th>
                  <th>Reviewer</th>
                  <th>Version</th>
                  <th>Date</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {w.approvals
                  .slice()
                  .reverse()
                  .map((a) => (
                    <tr key={a.id}>
                      <td>
                        {w.content.find((c) => c.id === a.contentId)?.title ||
                          "Draft"}
                      </td>
                      <td>{a.decision}</td>
                      <td>{a.actorName}</td>
                      <td>{a.version}</td>
                      <td>{displayDate(a.createdAt)}</td>
                      <td>{a.reason || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="panel-empty-text">
            Your first review decision will start the history.
          </p>
        )}
      </section>
    </>
  );
}
