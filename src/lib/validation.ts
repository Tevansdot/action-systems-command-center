import { z } from "zod";
import { platforms } from "./model";

export const idSchema = z.uuid();
export const httpsUrl = z
  .url()
  .max(2048)
  .refine((s) => {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password;
  }, "Use a public HTTPS URL without credentials.");
export const productInput = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(5000),
  priceCents: z.number().int().min(0).max(100_000_000).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  url: httpsUrl,
  audience: z.string().trim().max(2000),
  benefits: z.array(z.string().trim().min(1).max(400)).max(20),
  images: z.array(httpsUrl).max(8),
  keywords: z.array(z.string().trim().min(1).max(80)).max(40),
  status: z.enum(["draft", "active", "archived"]),
});
export const draftFields = z.object({
  title: z.string().trim().max(150),
  body: z.string().trim().min(1).max(5000),
  hashtags: z.array(z.string().trim().max(100)).max(30),
  cta: z.string().trim().max(500),
  ideas: z.array(z.string().trim().max(500)).max(10),
});
export const generateInput = z.object({
  productId: idSchema,
  platform: z.enum(platforms),
  objective: z.enum(["awareness", "traffic", "engagement", "conversion"]),
  tone: z.enum(["professional", "friendly", "confident", "educational"]),
  campaignId: idSchema.nullable().default(null),
  regenerateId: idSchema.optional(),
});
export const operationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("product.save"), product: productInput }),
  z.object({ type: z.literal("product.archive"), id: idSchema }),
  z.object({
    type: z.literal("campaign.create"),
    name: z.string().trim().min(2).max(150),
    productId: idSchema,
    objective: z.string().trim().min(2).max(500),
    platforms: z.array(z.enum(platforms)).min(1).max(4),
  }),
  z.object({
    type: z.literal("content.edit"),
    id: idSchema,
    version: z.number().int().positive(),
    fields: draftFields,
  }),
  z.object({
    type: z.literal("content.transition"),
    id: idSchema,
    version: z.number().int().positive(),
    to: z.enum([
      "draft",
      "pending_approval",
      "approved",
      "rejected",
      "scheduled",
      "published",
      "failed",
      "cancelled",
    ]),
    reason: z.string().trim().max(2000).optional(),
    scheduledAt: z.iso.datetime({ offset: true }).optional(),
    publishedUrl: httpsUrl.optional(),
    confirmed: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("automation.run"),
    kind: z.enum([
      "daily_suggestions",
      "daily_drafts",
      "approval_reminders",
      "marketing_summary",
      "publishing_review",
    ]),
  }),
]);
export type UserOperation = z.infer<typeof operationSchema>;
export type GenerationInput = z.infer<typeof generateInput>;
