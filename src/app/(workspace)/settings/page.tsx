"use client";
import { ShieldCheck, Link2, Bot, Globe, LockKeyhole } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Heading } from "@/components/ui";
import { connectionGuidance } from "@/lib/publishing";
import { platformLabels } from "@/lib/model";
export default function Settings() {
  const { actor, workspace, generationProvider } = useWorkspace();
  return (
    <>
      <Heading
        eyebrow="A WORKSPACE YOU CAN TRUST"
        title="Connections & settings"
        description="Know what’s connected, where your data lives, and what needs your permission."
      />
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                <LockKeyhole size={19} />
                Workspace access
              </h2>
              <p>{workspace.business.name}</p>
            </div>
          </div>
          <dl>
            <dt>Account</dt>
            <dd>{actor.name}</dd>
            <dt>Role</dt>
            <dd>{actor.role}</dd>
            <dt>Data mode</dt>
            <dd>
              {actor.mode === "demo"
                ? "Isolated local demo — not production storage"
                : "Supabase PostgreSQL with membership-based RLS"}
            </dd>
            <dt>Timezone</dt>
            <dd>America/Jamaica · UTC−05:00</dd>
          </dl>
          <div className="info-strip">
            <ShieldCheck size={18} />
            Live mode uses Supabase Auth. Demo sessions cannot access live
            workspaces.
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                <Bot size={19} />
                Content provider
              </h2>
              <p>Server-side generation</p>
            </div>
          </div>
          <dl>
            <dt>Configured provider</dt>
            <dd>
              {generationProvider === "openai"
                ? "OpenAI API"
                : "Local fact-based templates"}
            </dd>
            <dt>Publishing authority</dt>
            <dd>Manual confirmation required</dd>
            <dt>Credentials</dt>
            <dd>Server environment only</dd>
          </dl>
          <p className="panel-empty-text">
            Configure Supabase and OpenAI in your host’s environment settings
            using the README and .env.example. Keys are never entered or
            displayed in this dashboard.
          </p>
        </section>
      </div>
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>
              <Link2 size={19} />
              Platform connections
            </h2>
            <p>Prepared for official OAuth adapters; currently manual</p>
          </div>
        </div>
        <div className="integration-list">
          {workspace.connections.map((c) => (
            <div key={c.id}>
              <div className={`platform-dot platform-${c.platform}`}>
                {c.platform === "pinterest"
                  ? "P"
                  : c.platform === "instagram"
                    ? "I"
                    : "f"}
              </div>
              <div>
                <h3>{platformLabels[c.platform]}</h3>
                <p>{connectionGuidance[c.platform]}</p>
              </div>
              <span className="tag">MANUAL</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>
              <Globe size={19} />
              Gumroad storefront
            </h2>
            <p>Sales imports use your official CSV export</p>
          </div>
        </div>
        <div className="panel-empty-text">
          <a
            href="https://actionsystem.gumroad.com"
            target="_blank"
            rel="noreferrer"
          >
            actionsystem.gumroad.com ↗
          </a>
          <p>
            No store API authorization is configured. The MVP supports private
            CSV imports with purchase-ID deduplication and represented refunds.
            API synchronization can be added through an official, authorized
            adapter.
          </p>
        </div>
      </section>
    </>
  );
}
