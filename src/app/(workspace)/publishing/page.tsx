"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Heading, Empty } from "@/components/ui";
import { ContentCard } from "@/components/content-card";
import { platformLabels } from "@/lib/model";
export default function Publishing() {
  const { workspace: w } = useWorkspace(),
    [filter, setFilter] = useState("ready");
  const content = w.content
    .filter((c) =>
      filter === "ready"
        ? ["approved", "scheduled"].includes(c.status)
        : c.status === filter,
    )
    .slice()
    .reverse();
  return (
    <>
      <Heading
        eyebrow="PUBLISH WITH PURPOSE"
        title="Publishing tracker"
        description="Copy approved content, share it yourself, and keep a reliable record."
      />
      <div className="connection-grid">
        {w.connections
          .filter((c) => c.platform !== "facebook_group")
          .map((c) => (
            <div className="connection-card" key={c.id}>
              <div className={`platform-dot platform-${c.platform}`}>
                {c.platform === "pinterest"
                  ? "P"
                  : c.platform === "instagram"
                    ? "I"
                    : "f"}
              </div>
              <div>
                <strong>{platformLabels[c.platform]}</strong>
                <span>Manual publishing · OAuth not connected</span>
              </div>
              <span className="manual-dot" />
            </div>
          ))}
      </div>
      <div className="notice publishing-notice">
        <ShieldCheck size={23} />
        <div>
          <strong>You confirm the final step.</strong>
          <p>
            Scheduling never changes a post to published. Copy the approved
            content, publish on the platform, then choose “Mark as published”
            and enter its URL.
          </p>
        </div>
      </div>
      <div className="tabs" role="group" aria-label="Filter publications">
        {[
          ["ready", "Ready & scheduled"],
          ["published", "Published"],
          ["failed", "Failed"],
          ["cancelled", "Cancelled"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={filter === v ? "active" : ""}
            onClick={() => setFilter(v)}
            aria-pressed={filter === v}
          >
            {l}
            <span>
              {
                w.content.filter((c) =>
                  v === "ready"
                    ? ["approved", "scheduled"].includes(c.status)
                    : c.status === v,
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      {content.length ? (
        <div className="content-grid">
          {content.map((c) => (
            <ContentCard key={c.id} content={c} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title={
              filter === "published"
                ? "No confirmed publications yet"
                : "No posts in this view"
            }
            description="Content appears here after approval. Your published URL is recorded only when you explicitly confirm publication."
            action={
              <Link className="button secondary" href="/approvals">
                Review content
                <ExternalLink size={14} />
              </Link>
            }
          />
        </div>
      )}
    </>
  );
}
