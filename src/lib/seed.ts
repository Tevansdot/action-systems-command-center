import { randomUUID } from "node:crypto";
import type { Workspace } from "./model";
export function createWorkspace(): Workspace {
  const at = new Date().toISOString();
  return {
    business: {
      id: randomUUID(),
      name: "Action Systems",
      timezone: "America/Jamaica",
    },
    revision: 0,
    products: [
      {
        id: randomUUID(),
        name: "Service Profit OS",
        url: "https://actionsystem.gumroad.com/l/serviceprofit-os",
        description: "",
        priceCents: null,
        currency: "USD",
        audience: "",
        benefits: [],
        images: [],
        keywords: [],
        status: "draft",
        createdAt: at,
        updatedAt: at,
      },
    ],
    campaigns: [],
    content: [],
    approvals: [],
    scheduled: [],
    sales: [],
    jobs: [],
    audit: [],
    connections: [
      "pinterest",
      "instagram",
      "facebook_page",
      "facebook_group",
    ].map((platform) => ({
      id: randomUUID(),
      platform: platform as Workspace["connections"][number]["platform"],
      status: "manual",
      label:
        platform === "facebook_group"
          ? "Discussion assistance only"
          : "Manual publishing",
    })),
  };
}
