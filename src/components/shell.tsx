"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  Sparkles,
  ClipboardCheck,
  CalendarDays,
  Send,
  BarChart3,
  Workflow,
  Layers,
  ChevronDown,
  Bell,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  Settings2,
  ArrowUpRight,
} from "lucide-react";
import { useWorkspace } from "./workspace-context";
const nav = [
  { path: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { path: "/products", label: "Product library", icon: Package },
  { path: "/studio", label: "Content studio", icon: Sparkles },
  { path: "/approvals", label: "Approval queue", icon: ClipboardCheck },
  { path: "/calendar", label: "Marketing calendar", icon: CalendarDays },
  { path: "/publishing", label: "Publishing tracker", icon: Send },
  { path: "/analytics", label: "Sales analytics", icon: BarChart3 },
  { path: "/automation", label: "Workflows", icon: Workflow },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { workspace, actor } = useWorkspace(),
    path = usePathname(),
    [mobile, setMobile] = useState(false);
  const pending = workspace.content.filter(
    (c) => c.status === "pending_approval",
  ).length;
  const failed =
    workspace.content.filter((c) => c.status === "failed").length +
    workspace.jobs.filter((j) => j.status === "failed").length;
  async function logout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/login");
    router.refresh();
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Link href="/dashboard" className="brand">
            <div className="brand-mark">
              <Layers size={23} />
            </div>
            <div>
              Action Systems<small>AI COMMAND CENTER</small>
            </div>
          </Link>
          <button
            className="icon-button mobile-only"
            aria-label="Close menu"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <div className="business-switch">
          <div className="business-avatar">AS</div>
          <div>
            <strong>{workspace.business.name}</strong>
            <span>Marketing workspace</span>
          </div>
          <ChevronDown size={16} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setMobile(false)}
              className={`nav-link ${path === item.path ? "nav-active" : ""}`}
              aria-current={path === item.path ? "page" : undefined}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.path === "/approvals" && pending > 0 && <b>{pending}</b>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="approval-note">
            <ShieldCheck size={20} />
            <strong>You’re in control</strong>
            <p>
              Every post gets your approval. Nothing publishes automatically.
            </p>
          </div>
          <Link className="nav-link" href="/settings">
            <Settings2 size={19} />
            Connections & settings
          </Link>
          <a
            className="nav-link"
            href="https://actionsystem.gumroad.com"
            target="_blank"
            rel="noreferrer"
          >
            Visit your storefront
            <ArrowUpRight size={16} />
          </a>
          <div className="sidebar-user">
            <div className="user-avatar">
              {actor.mode === "demo"
                ? "D"
                : actor.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{actor.name}</strong>
              <small>
                {actor.role} ·{" "}
                {actor.mode === "demo" ? "Demo workspace" : "Live workspace"}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={() => void logout()}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-scrim"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}
      <div className="main-wrapper">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span className="muted">Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {nav.find((n) => n.path === path)?.label || "Settings"}
            </strong>
          </div>
          <div className="topbar-actions">
            <span
              className={`mode-chip ${actor.mode === "live" ? "live" : ""}`}
            >
              <span />
              {actor.mode === "demo" ? "Demo mode" : "Live workspace"}
            </span>
            <Link
              href="/automation"
              className="notification-button"
              aria-label={`${failed} failed tasks`}
            >
              <Bell size={20} />
              {failed > 0 && <span>{failed}</span>}
            </Link>
            <div className="user-avatar top-avatar">AS</div>
          </div>
        </header>
        {actor.mode === "demo" && (
          <div className="demo-banner">
            <ShieldCheck size={15} />
            <span>
              Demo workspace · Local data only. Sales appear after a CSV import.
              Publishing stays manual.
            </span>
          </div>
        )}
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>Action Systems AI Command Center</span>
          <span>Human approved · America/Jamaica (UTC−05:00)</span>
        </footer>
      </div>
    </div>
  );
}
