"use client";
import { useState } from "react";
import Image from "next/image";
import {
  Plus,
  ArrowUpRight,
  Pencil,
  Archive,
  Search,
  Package,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Heading, Button, Modal, Field, Badge, Empty } from "@/components/ui";
import type { Product } from "@/lib/model";
import { money } from "@/lib/time";
export default function Products() {
  const { workspace, actor, mutate, busy } = useWorkspace();
  const [editing, setEditing] = useState<Product | null>(null),
    [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all");
  const canEdit = ["owner", "editor"].includes(actor.role);
  const products = workspace.products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (status === "all" || p.status === status),
  );
  async function save(form: FormData) {
    const list = (key: string) =>
      String(form.get(key) || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    const price = String(form.get("price") || "");
    const ok = await mutate(
      {
        type: "product.save",
        product: {
          id: editing?.id,
          name: String(form.get("name")),
          description: String(form.get("description")),
          priceCents: price === "" ? null : Math.round(Number(price) * 100),
          currency: String(form.get("currency")).toUpperCase(),
          url: String(form.get("url")),
          audience: String(form.get("audience")),
          benefits: list("benefits"),
          images: list("images"),
          keywords: list("keywords"),
          status: String(form.get("status")) as Product["status"],
        },
      },
      "Product saved.",
    );
    if (ok) setOpen(false);
  }
  return (
    <>
      <Heading
        eyebrow="THE FOUNDATION OF YOUR MARKETING"
        title="Product library"
        description="Your products, their details, and the stories worth telling."
        action={
          canEdit && (
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus size={17} />
              Add product
            </Button>
          )
        }
      />
      <div className="toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search products"
            placeholder="Search your products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Product status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <span className="muted small">
          {products.length} product{products.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="product-grid">
        {products.map((p) => (
          <article className="product-card" key={p.id}>
            <div className="product-cover">
              {p.images[0] ? (
                <Image
                  src={p.images[0]}
                  alt={p.name}
                  width={700}
                  height={350}
                  unoptimized
                />
              ) : (
                <>
                  <Package size={38} />
                  <span>ACTION SYSTEMS</span>
                  <strong>{p.name}</strong>
                  <small>DIGITAL PRODUCT</small>
                </>
              )}
              <div className="cover-badge">
                <Badge status={p.status} />
              </div>
            </div>
            <div className="product-details">
              <div className="product-heading">
                <h2>{p.name}</h2>
                <span>
                  {p.priceCents === null
                    ? "Price unverified"
                    : money(p.priceCents, p.currency)}
                </span>
              </div>
              <p>
                {p.description ||
                  "Add a verified description, audience, and benefits to give your content a solid foundation."}
              </p>
              <div className="keyword-list">
                {p.keywords.slice(0, 4).map((k) => (
                  <span key={k}>{k}</span>
                ))}
                {!p.description && <span>Details needed</span>}
              </div>
              <div className="product-actions">
                <a
                  className="button secondary"
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Product page
                  <ArrowUpRight size={15} />
                </a>
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      aria-label={`Edit ${p.name}`}
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                    >
                      <Pencil size={16} />
                    </Button>
                    {p.status !== "archived" && (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        aria-label={`Archive ${p.name}`}
                        onClick={() =>
                          void mutate(
                            { type: "product.archive", id: p.id },
                            "Product archived. You can restore it by editing its status.",
                          )
                        }
                      >
                        <Archive size={16} />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!products.length && (
        <Empty
          title="No products found"
          description="Add a product or adjust your filters to continue."
        />
      )}
      <div className="info-strip">
        Only the preloaded product’s name and supplied URL are known. Its price,
        capabilities, images, and audience need your verification.
      </div>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit product" : "Add a product"}
        description="Use confirmed product facts. Unknown details can stay blank."
        wide
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(new FormData(e.currentTarget));
          }}
        >
          <div className="form-grid">
            <Field label="Product name">
              <input
                name="name"
                defaultValue={editing?.name}
                minLength={2}
                maxLength={150}
                required
              />
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={editing?.status || "draft"}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Price" hint="Leave blank when unverified.">
              <input
                name="price"
                type="number"
                step="0.01"
                min="0"
                max="1000000"
                defaultValue={
                  editing?.priceCents == null ? "" : editing.priceCents / 100
                }
              />
            </Field>
            <Field label="Currency">
              <input
                name="currency"
                defaultValue={editing?.currency || "USD"}
                pattern="[A-Za-z]{3}"
                maxLength={3}
                required
              />
            </Field>
          </div>
          <Field label="Product URL">
            <input
              name="url"
              type="url"
              placeholder="https://…"
              defaultValue={editing?.url}
              required
            />
          </Field>
          <Field label="Description">
            <textarea
              name="description"
              defaultValue={editing?.description}
              rows={3}
              maxLength={5000}
            />
          </Field>
          <Field label="Target audience">
            <textarea
              name="audience"
              defaultValue={editing?.audience}
              rows={2}
              maxLength={2000}
            />
          </Field>
          <div className="form-grid">
            <Field
              label="Marketing benefits"
              hint="One verified benefit per line."
            >
              <textarea
                name="benefits"
                defaultValue={editing?.benefits.join("\n")}
                rows={3}
              />
            </Field>
            <Field label="Keywords" hint="One keyword per line.">
              <textarea
                name="keywords"
                defaultValue={editing?.keywords.join("\n")}
                rows={3}
              />
            </Field>
          </div>
          <Field
            label="Product image URLs"
            hint="Up to eight HTTPS image URLs, one per line. Images remain hosted at their source."
          >
            <textarea
              name="images"
              defaultValue={editing?.images.join("\n")}
              rows={2}
            />
          </Field>
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={busy}>Save product</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
