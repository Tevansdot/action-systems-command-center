import type { Content, Platform } from "./model";
// Every future OAuth adapter must independently enforce current approval and scoped authorization.
export interface PublishingAuthorization {
  businessId: string;
  actorId: string;
  contentId: string;
  approvedVersion: number;
  explicitlyAuthorized: true;
}
export interface VerifiedPublication {
  platform: Platform;
  externalId: string;
  url: string;
  publishedAt: string;
}
export interface PublishingAdapter {
  platform: Platform;
  connected: boolean;
  publish(
    content: Content,
    authorization: PublishingAuthorization,
  ): Promise<VerifiedPublication>;
}
export const connectionGuidance = {
  pinterest:
    "Manual. A future official Pinterest v5 adapter requires approved app access and pins:write / boards:read; add pins:read when verifying created Pins. OAuth tokens and account authorization are not configured.",
  instagram:
    "Manual. Future integration requires the appropriate Meta professional-account API, app permissions, and review. No OAuth connection is configured.",
  facebook_page:
    "Manual. Future integration requires official Meta Page access, permissions, and app review. No OAuth connection is configured.",
  facebook_group:
    "Manual discussion assistance only. No group publishing or engagement automation.",
};
export function copyableContent(
  content: Pick<Content, "title" | "body" | "hashtags" | "cta">,
): string {
  return [content.title, content.body, content.hashtags.join(" "), content.cta]
    .filter(Boolean)
    .join("\n\n");
}
