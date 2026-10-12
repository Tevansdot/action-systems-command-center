import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { TemplateProvider, OpenAIProvider } from "@/lib/providers";
import { createWorkspace } from "@/lib/seed";
const product = createWorkspace().products[0];
const input = {
  productId: product.id,
  platform: "pinterest" as const,
  objective: "awareness" as const,
  tone: "professional" as const,
  campaignId: null,
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("content provider contract", () => {
  it("uses only supplied product facts and clearly reports template provenance", async () => {
    const result = await new TemplateProvider().generate(product, input);
    expect(result.source).toBe("template");
    expect(result.body).toContain("Service Profit OS");
    expect(result.cta).toContain(product.url);
    expect(result.body).not.toContain("$");
    expect(result.body).not.toMatch(
      /guarantee|testimonial|earnings|save time/i,
    );
  });
  it("adapts tone, objective, and Instagram hashtags", async () => {
    const result = await new TemplateProvider().generate(product, {
      ...input,
      platform: "instagram",
      tone: "friendly",
      objective: "engagement",
    });
    expect(result.body).toContain("Take a look");
    expect(result.cta).toContain("share your questions");
    expect(result.hashtags).toContain("#ActionSystems");
  });
  it("bounds Pinterest text and keeps group assistance free of promotion links", async () => {
    const long = await new TemplateProvider().generate(
      { ...product, description: "Owner-supplied information. ".repeat(200) },
      input,
    );
    expect(long.body.length).toBeLessThanOrEqual(500);
    const group = await new TemplateProvider().generate(product, {
      ...input,
      platform: "facebook_group",
    });
    expect(group.body).toContain("group's rules");
    expect(group.cta).not.toContain("https://");
  });
  it("handles an unavailable OpenAI service without claiming generation succeeded", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("Provider error", { status: 503 })),
    );
    await expect(new OpenAIProvider().generate(product, input)).rejects.toThrow(
      "503",
    );
  });
  it("rejects malformed responses and platform-length violations", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ choices: [{ message: { content: "{}" } }] }),
            { status: 200 },
          ),
        ),
    );
    await expect(new OpenAIProvider().generate(product, input)).rejects.toThrow(
      "invalid draft",
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      title: "Explore",
                      body: "x".repeat(501),
                      hashtags: [],
                      cta: "Read more",
                      ideas: [],
                    }),
                  },
                },
              ],
            }),
            { status: 200 },
          ),
        ),
    );
    await expect(new OpenAIProvider().generate(product, input)).rejects.toThrow(
      "length guidance",
    );
  });
});
