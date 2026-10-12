"use client";
import { useState } from "react";
import { Sparkles, Plus, WandSparkles, ArrowRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Heading, Button, Modal, Field, Empty } from "@/components/ui";
import { ContentCard } from "@/components/content-card";
import { platforms, platformLabels, type Platform } from "@/lib/model";
export default function Studio() {
  const {
    workspace: w,
    actor,
    generationProvider,
    request,
    mutate,
    busy,
  } = useWorkspace();
  const [product, setProduct] = useState(
      w.products.find((p) => p.status !== "archived")?.id || "",
    ),
    [platform, setPlatform] = useState<Platform>("pinterest"),
    [campaign, setCampaign] = useState(""),
    [objective, setObjective] = useState("awareness"),
    [tone, setTone] = useState("professional"),
    [open, setOpen] = useState(false),
    [filter, setFilter] = useState("all");
  const canEdit = ["owner", "editor"].includes(actor.role),
    products = w.products.filter((p) => p.status !== "archived");
  async function generate(regenerateId?: string) {
    await request(
      "/api/generate",
      {
        productId: product,
        platform,
        campaignId: campaign || null,
        objective,
        tone,
        revision: w.revision,
        regenerateId,
      },
      "Draft prepared. Review all claims before requesting approval.",
    );
  }
  async function createCampaign(form: FormData) {
    const ok = await mutate(
      {
        type: "campaign.create",
        name: String(form.get("name")),
        productId: String(form.get("productId")),
        objective: String(form.get("objective")),
        platforms: form.getAll("platform").map(String) as Platform[],
      },
      "Campaign created. Select it when preparing a draft.",
    );
    if (ok) setOpen(false);
  }
  const content = w.content
    .filter((c) => filter === "all" || c.platform === filter)
    .slice()
    .reverse();
  return (
    <>
      <Heading
        eyebrow="YOUR IDEAS, READY TO TAKE SHAPE"
        title="AI content studio"
        description="Create thoughtful marketing drafts. Keep the final word."
        action={
          canEdit && (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              <Plus size={16} />
              New campaign
            </Button>
          )
        }
      />
      <div className="studio-layout">
        <aside className="panel studio-controls">
          <div className="panel-heading">
            <div>
              <div className="studio-icon">
                <WandSparkles size={22} />
              </div>
              <h2>Start with a direction</h2>
              <p>We’ll help with the first draft.</p>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <Field label="Product">
              <select
                value={product}
                onChange={(e) => {
                  setProduct(e.target.value);
                  setCampaign("");
                }}
                required
              >
                <option value="" disabled>
                  Choose a product
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Platform">
              <select
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value as Platform);
                  setCampaign("");
                }}
              >
                {platforms.map((p) => (
                  <option value={p} key={p}>
                    {platformLabels[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Marketing objective">
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              >
                <option value="awareness">Build awareness</option>
                <option value="traffic">Drive product-page traffic</option>
                <option value="engagement">Start a conversation</option>
                <option value="conversion">
                  Encourage product consideration
                </option>
              </select>
            </Field>
            <Field label="Tone of voice">
              <select value={tone} onChange={(e) => setTone(e.target.value)}>
                {["professional", "friendly", "confident", "educational"].map(
                  (t) => (
                    <option key={t} value={t}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Campaign">
              <select
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
              >
                <option value="">No campaign</option>
                {w.campaigns
                  .filter(
                    (c) =>
                      c.productId === product && c.platforms.includes(platform),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Button className="full" disabled={busy || !product || !canEdit}>
              <Sparkles size={16} />
              {busy ? "Preparing draft…" : "Generate draft"}
            </Button>
          </form>
          <div className="studio-provider">
            <span
              className={`provider-dot ${generationProvider === "openai" ? "active" : ""}`}
            />
            <strong>
              {generationProvider === "openai"
                ? "OpenAI configured"
                : "Template provider"}
            </strong>
            <p>
              {generationProvider === "openai"
                ? "Generated server-side. Always check facts before approving."
                : "No AI key configured. Useful starting text from your product facts; this is not an AI-generated response."}
            </p>
          </div>
        </aside>
        <section>
          <div className="section-toolbar">
            <div>
              <h2>Your content drafts</h2>
              <p className="muted small">
                {content.length} draft{content.length === 1 ? "" : "s"} · All
                content stays internal until you publish.
              </p>
            </div>
            <select
              aria-label="Filter drafts by platform"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All platforms</option>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {platformLabels[p]}
                </option>
              ))}
            </select>
          </div>
          {content.length ? (
            <div className="content-grid">
              {content.map((c) => (
                <div key={c.id}>
                  <ContentCard content={c} compact />
                  {canEdit &&
                    c.status !== "published" &&
                    c.productId === product &&
                    c.platform === platform && (
                      <Button
                        className="regenerate-button"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void generate(c.id)}
                      >
                        <Sparkles size={14} />
                        Regenerate this draft
                      </Button>
                    )}
                </div>
              ))}
            </div>
          ) : (
            <div className="panel studio-empty">
              <Empty
                title="Give your next idea a head start"
                description="Choose a product, a platform, and an objective. Your first editable draft will appear here."
                action={
                  <span className="teal-text small">
                    Choose your direction to get started{" "}
                    <ArrowRight size={14} />
                  </span>
                }
              />
            </div>
          )}
        </section>
      </div>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Create a marketing campaign"
        description="Group content around a product and a shared objective."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void createCampaign(new FormData(e.currentTarget));
          }}
        >
          <Field label="Campaign name">
            <input name="name" required minLength={2} maxLength={150} />
          </Field>
          <Field label="Product">
            <select name="productId" required>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Objective">
            <textarea
              name="objective"
              required
              minLength={2}
              maxLength={500}
              rows={3}
            />
          </Field>
          <fieldset>
            <legend>Platforms</legend>
            {platforms.map((p) => (
              <label className="checkbox-label" key={p}>
                <input
                  name="platform"
                  type="checkbox"
                  value={p}
                  defaultChecked={p === "pinterest"}
                />
                {platformLabels[p]}
              </label>
            ))}
          </fieldset>
          <div className="modal-actions">
            <Button disabled={busy || !products.length}>Create campaign</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
