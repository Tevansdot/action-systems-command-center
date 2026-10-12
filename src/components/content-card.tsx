"use client";
import { useState } from "react";
import {
  Copy,
  Pencil,
  Check,
  X,
  CalendarDays,
  Send,
  RotateCcw,
  AlertTriangle,
  Clock3,
  ChevronDown,
} from "lucide-react";
import { useWorkspace } from "./workspace-context";
import { Button, Modal, Field, Badge } from "./ui";
import { platformLabels, type Content, type ContentStatus } from "@/lib/model";
import { displayDate, jamaicaToUtc, utcToJamaicaInput } from "@/lib/time";
import { copyableContent } from "@/lib/publishing";
export function ContentCard({
  content: c,
  compact = false,
}: {
  content: Content;
  compact?: boolean;
}) {
  const { workspace, actor, mutate, busy, notify } = useWorkspace();
  const [modal, setModal] = useState<
      "edit" | "reject" | "schedule" | "publish" | "fail" | "history" | null
    >(null),
    [expanded, setExpanded] = useState(!compact);
  const [scheduleMin] = useState(() =>
    utcToJamaicaInput(new Date(Date.now() + 60_000).toISOString()),
  );
  const canWrite = ["owner", "editor"].includes(actor.role),
    canReview = ["owner", "reviewer"].includes(actor.role);
  const product = workspace.products.find((p) => p.id === c.productId),
    history = workspace.approvals.filter((a) => a.contentId === c.id);
  async function transition(
    to: ContentStatus,
    extra: {
      reason?: string;
      scheduledAt?: string;
      publishedUrl?: string;
      confirmed?: boolean;
    } = {},
  ) {
    if (to === "published" && !extra.confirmed) return;
    const ok = await mutate(
      {
        type: "content.transition",
        id: c.id,
        version: c.version,
        to,
        ...extra,
      },
      to === "published" ? "Manual publication recorded." : "Workflow updated.",
    );
    if (ok) setModal(null);
  }
  async function save(form: FormData) {
    const ok = await mutate(
      {
        type: "content.edit",
        id: c.id,
        version: c.version,
        fields: {
          title: String(form.get("title")),
          body: String(form.get("body")),
          hashtags: String(form.get("hashtags") || "")
            .split(/\s+/)
            .filter(Boolean),
          cta: String(form.get("cta")),
          ideas: c.ideas,
        },
      },
      "Draft saved. Review and approval are required again.",
    );
    if (ok) setModal(null);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(copyableContent(c));
      notify("Content copied to clipboard.");
    } catch {
      notify(
        "Clipboard access is unavailable. Select the content and copy it manually.",
      );
    }
  }
  return (
    <article className="content-card">
      <div className="content-card-top">
        <div className={`platform-dot platform-${c.platform}`}>
          {c.platform === "pinterest"
            ? "P"
            : c.platform === "instagram"
              ? "I"
              : "f"}
        </div>
        <div>
          <strong>{platformLabels[c.platform]}</strong>
          <small>
            {product?.name || "Product"}
            {c.campaignId
              ? ` · ${workspace.campaigns.find((x) => x.id === c.campaignId)?.name || "Campaign"}`
              : ""}
          </small>
        </div>
        <Badge status={c.status} />
      </div>
      <h3>{c.title || "Untitled draft"}</h3>
      <p className={`content-body ${expanded ? "" : "content-clamped"}`}>
        {c.body}
      </p>
      {expanded && (
        <>
          <p className="content-hashtags">{c.hashtags.join(" ")}</p>
          {c.cta && <div className="content-cta">{c.cta}</div>}
          {c.ideas.length > 0 && (
            <details>
              <summary>Campaign ideas</summary>
              <ul>
                {c.ideas.map((idea, i) => (
                  <li key={i}>{idea}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {compact && (
        <button className="text-button" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show less" : "Read draft"}
          <ChevronDown size={14} />
        </button>
      )}
      <div className="content-meta">
        <Badge status={c.source === "manual" ? "manual" : c.source} />
        <span>
          Version {c.version} · {c.tone}
        </span>
        {c.scheduledAt && (
          <span>
            <Clock3 size={13} />
            {displayDate(c.scheduledAt)}
          </span>
        )}
      </div>
      {c.publishedUrl && (
        <a
          className="published-link"
          href={c.publishedUrl}
          target="_blank"
          rel="noreferrer"
        >
          View manually confirmed publication ↗
        </a>
      )}
      {c.platform === "facebook_group" && (
        <p className="small muted">
          Discussion assistance only. Follow the group’s rules before sharing
          manually.
        </p>
      )}
      <div className="content-actions">
        <Button variant="secondary" onClick={() => void copy()}>
          <Copy size={14} />
          Copy
        </Button>
        {canWrite && c.status !== "published" && (
          <Button variant="secondary" onClick={() => setModal("edit")}>
            <Pencil size={14} />
            Edit
          </Button>
        )}
        {canWrite && c.status === "draft" && (
          <Button
            disabled={busy}
            onClick={() => void transition("pending_approval")}
          >
            Request approval
          </Button>
        )}
        {canReview && c.status === "pending_approval" && (
          <>
            <Button disabled={busy} onClick={() => void transition("approved")}>
              <Check size={15} />
              Approve
            </Button>
            <Button variant="danger" onClick={() => setModal("reject")}>
              <X size={15} />
              Reject
            </Button>
          </>
        )}
        {canReview &&
          ["approved", "scheduled", "failed"].includes(c.status) &&
          c.approvedVersion === c.version && (
            <>
              <Button variant="secondary" onClick={() => setModal("schedule")}>
                <CalendarDays size={15} />
                {c.status === "scheduled" ? "Reschedule" : "Schedule"}
              </Button>
              <Button onClick={() => setModal("publish")}>
                <Send size={14} />
                Mark as published
              </Button>
            </>
          )}
        {canWrite && c.status === "scheduled" && (
          <Button variant="danger" onClick={() => setModal("fail")}>
            <AlertTriangle size={14} />
            Report failure
          </Button>
        )}
        {canWrite && ["rejected", "failed", "cancelled"].includes(c.status) && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void transition("draft")}
          >
            <RotateCcw size={14} />
            Return to draft
          </Button>
        )}
        {canWrite && !["published", "cancelled"].includes(c.status) && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void transition("cancelled")}
          >
            Cancel
          </Button>
        )}
        <Button variant="ghost" onClick={() => setModal("history")}>
          History
        </Button>
      </div>
      <Modal
        open={modal !== null}
        onOpenChange={(v) => {
          if (!v) setModal(null);
        }}
        title={
          modal === "edit"
            ? "Edit draft"
            : modal === "reject"
              ? "Reject content"
              : modal === "schedule"
                ? "Schedule content"
                : modal === "publish"
                  ? "Record manual publication"
                  : modal === "fail"
                    ? "Report publishing failure"
                    : "Approval history"
        }
        description={
          modal === "edit"
            ? "Editing resets approval and cancels the current schedule."
            : modal === "publish"
              ? "Publish on the platform yourself, then record it here."
              : "Every decision is recorded in your workflow history."
        }
        wide={modal === "edit"}
      >
        {modal === "edit" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(new FormData(e.currentTarget));
            }}
          >
            <Field label="Title">
              <input name="title" defaultValue={c.title} maxLength={150} />
            </Field>
            <Field label="Content">
              <textarea
                name="body"
                defaultValue={c.body}
                rows={8}
                required
                maxLength={5000}
              />
            </Field>
            <Field label="Hashtags">
              <input name="hashtags" defaultValue={c.hashtags.join(" ")} />
            </Field>
            <Field label="Call to action">
              <textarea
                name="cta"
                defaultValue={c.cta}
                rows={2}
                maxLength={500}
              />
            </Field>
            <div className="modal-actions">
              <Button disabled={busy}>Save draft</Button>
            </div>
          </form>
        )}
        {(modal === "reject" || modal === "fail") && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void transition(modal === "reject" ? "rejected" : "failed", {
                reason: String(new FormData(e.currentTarget).get("reason")),
              });
            }}
          >
            <Field
              label={
                modal === "reject" ? "Rejection reason" : "What went wrong?"
              }
            >
              <textarea
                name="reason"
                rows={4}
                required
                minLength={3}
                maxLength={2000}
              />
            </Field>
            <div className="modal-actions">
              <Button variant="danger" disabled={busy}>
                {modal === "reject" ? "Reject draft" : "Record failure"}
              </Button>
            </div>
          </form>
        )}
        {modal === "schedule" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                void transition("scheduled", {
                  scheduledAt: jamaicaToUtc(
                    String(new FormData(e.currentTarget).get("date")),
                  ),
                });
              } catch (err) {
                notify(err instanceof Error ? err.message : "Invalid date.");
              }
            }}
          >
            <Field
              label="Publishing date and time"
              hint="America/Jamaica (UTC−05:00). Stored in UTC."
            >
              <input
                type="datetime-local"
                name="date"
                defaultValue={
                  c.scheduledAt ? utcToJamaicaInput(c.scheduledAt) : ""
                }
                min={scheduleMin}
                required
              />
            </Field>
            <div className="notice">
              This plans a manual publishing task. Scheduling does not publish
              content.
            </div>
            <div className="modal-actions">
              <Button disabled={busy}>Save schedule</Button>
            </div>
          </form>
        )}
        {modal === "publish" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void transition("published", {
                publishedUrl: String(f.get("url")),
                confirmed: f.get("confirmed") === "on",
              });
            }}
          >
            <Field label="Published post URL">
              <input name="url" type="url" placeholder="https://…" required />
            </Field>
            <label className="checkbox-label">
              <input type="checkbox" name="confirmed" required />I personally
              confirm this content was published on {platformLabels[c.platform]}
              .
            </label>
            <div className="modal-actions">
              <Button disabled={busy}>Confirm manual publication</Button>
            </div>
          </form>
        )}
        {modal === "history" && (
          <div className="history-list">
            {history.length ? (
              history.map((a) => (
                <div key={a.id}>
                  <Badge status={a.decision} />
                  <strong>
                    {a.actorName} · version {a.version}
                  </strong>
                  <span>{displayDate(a.createdAt)}</span>
                  {a.reason && <p>{a.reason}</p>}
                </div>
              ))
            ) : (
              <p className="muted">No approval decisions recorded yet.</p>
            )}
          </div>
        )}
      </Modal>
    </article>
  );
}
