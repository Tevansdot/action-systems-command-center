"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Inbox } from "lucide-react";
import { clsx } from "clsx";
import { cloneElement, isValidElement, useId } from "react";
import type { ContentStatus } from "@/lib/model";

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return <button className={clsx("button", variant, className)} {...props} />;
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={clsx("modal", wide && "modal-wide")}>
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description className="muted small">
                {description || "Review your changes before saving."}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Badge({
  status,
}: {
  status:
    | ContentStatus
    | "active"
    | "archived"
    | "completed"
    | "manual"
    | "template"
    | "openai"
    | "queued"
    | "running"
    | "invalidated";
}) {
  return (
    <span className={clsx("badge", `badge-${status}`)}>
      <span />
      {status === "template"
        ? "Template draft"
        : status === "openai"
          ? "AI assisted"
          : status.replaceAll("_", " ")}
    </span>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={28} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = useId();
  const input = isValidElement(children)
    ? cloneElement(
        children as React.ReactElement<{
          id?: string;
          "aria-describedby"?: string;
        }>,
        { id, "aria-describedby": hint ? `${id}-hint` : undefined },
      )
    : children;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {input}
      {hint && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  );
}
