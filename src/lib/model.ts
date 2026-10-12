export const platforms = [
  "pinterest",
  "instagram",
  "facebook_page",
  "facebook_group",
] as const;
export type Platform = (typeof platforms)[number];
export const platformLabels: Record<Platform, string> = {
  pinterest: "Pinterest",
  instagram: "Instagram",
  facebook_page: "Facebook Page",
  facebook_group: "Facebook Group",
};
export const statuses = [
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
  "published",
  "rejected",
  "failed",
  "cancelled",
] as const;
export type ContentStatus = (typeof statuses)[number];
export type Role = "owner" | "editor" | "reviewer" | "viewer";
export interface Actor {
  id: string;
  name: string;
  role: Role;
  mode: "demo" | "live";
}
export interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number | null;
  currency: string;
  url: string;
  audience: string;
  benefits: string[];
  images: string[];
  keywords: string[];
  status: "draft" | "active" | "archived";
  createdAt: string;
  updatedAt: string;
}
export interface Campaign {
  id: string;
  name: string;
  productId: string;
  objective: string;
  platforms: Platform[];
  createdAt: string;
}
export interface Content {
  id: string;
  productId: string;
  campaignId: string | null;
  platform: Platform;
  objective: string;
  tone: string;
  title: string;
  body: string;
  hashtags: string[];
  cta: string;
  ideas: string[];
  status: ContentStatus;
  source: "openai" | "template" | "manual";
  version: number;
  approvedVersion: number | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  publishedUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Approval {
  id: string;
  contentId: string;
  actorId: string;
  actorName: string;
  decision: "approved" | "rejected" | "invalidated";
  version: number;
  reason: string;
  createdAt: string;
}
export interface ScheduledPost {
  id: string;
  contentId: string;
  scheduledAt: string;
  status: "scheduled" | "completed" | "cancelled";
  createdAt: string;
}
export interface Sale {
  id: string;
  purchaseId: string;
  productName: string;
  productId: string | null;
  grossCents: number;
  refundCents: number;
  currency: string;
  purchasedAt: string;
  importedAt: string;
}
export interface Job {
  id: string;
  kind:
    | "daily_suggestions"
    | "daily_drafts"
    | "approval_reminders"
    | "marketing_summary"
    | "publishing_review";
  status: "queued" | "running" | "completed" | "failed";
  result: string;
  createdAt: string;
  finishedAt: string | null;
  leaseUntil: string | null;
  attempts: number;
}
export interface Audit {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  entityId: string | null;
  detail: string;
  createdAt: string;
}
export interface Connection {
  id: string;
  platform: Platform;
  status: "manual" | "disconnected";
  label: string;
}
export interface Workspace {
  business: { id: string; name: string; timezone: string };
  revision: number;
  products: Product[];
  campaigns: Campaign[];
  content: Content[];
  approvals: Approval[];
  scheduled: ScheduledPost[];
  sales: Sale[];
  jobs: Job[];
  audit: Audit[];
  connections: Connection[];
}
export interface WorkspaceResponse {
  workspace: Workspace;
  actor: Actor;
  generationProvider: "openai" | "template";
}
