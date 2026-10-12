"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ShieldCheck, Sparkles, Layers } from "lucide-react";
export function LoginForm({ demo, live }: { demo: boolean; live: boolean }) {
  const router = useRouter();
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(action: string, form?: FormData) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          email: form?.get("email"),
          password: form?.get("password"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.confirmationRequired) setMessage(data.message);
      else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <div className="brand-mark">
            <Layers size={24} />
          </div>
          <div>
            Action Systems<small>AI COMMAND CENTER</small>
          </div>
        </div>
        <div className="login-pitch">
          <span className="eyebrow">
            <Sparkles size={15} /> YOUR BUSINESS. IN COMMAND.
          </span>
          <h1>
            More intention.
            <br />
            Less busywork.
          </h1>
          <p>
            One focused workspace for your products, marketing, and next move.
          </p>
          <div className="login-benefits">
            {[
              "Create content with a thoughtful assistant",
              "Keep every publishing decision in your hands",
              "Turn your sales data into a clearer picture",
            ].map((t) => (
              <div key={t}>
                <Check size={18} />
                {t}
              </div>
            ))}
          </div>
        </div>
        <p className="login-footer">
          Built for Action Systems · America/Jamaica
        </p>
      </section>
      <main className="login-panel">
        <div className="login-card">
          <span className="tag">ACTION SYSTEMS</span>
          <h2>Welcome to your command center</h2>
          <p className="muted">A little structure. A lot more momentum.</p>
          {live && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(
                  signup ? "signup" : "login",
                  new FormData(e.currentTarget),
                );
              }}
            >
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@yourbusiness.com"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={signup ? "new-password" : "current-password"}
                  minLength={10}
                  maxLength={128}
                  required
                  placeholder="At least 10 characters"
                />
              </label>
              <button className="button primary full" disabled={busy}>
                {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
                <ArrowRight size={17} />
              </button>
              <button
                className="button ghost full"
                type="button"
                onClick={() => setSignup(!signup)}
              >
                {signup
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </button>
            </form>
          )}
          {demo && (
            <>
              <div className="notice">
                <ShieldCheck size={20} />
                <div>
                  <strong>A private demo workspace</strong>
                  <p>
                    Explore every workflow with local data. No live sales,
                    external messages, or automatic publishing.
                  </p>
                </div>
              </div>
              <button
                className="button primary full"
                disabled={busy}
                onClick={() => void submit("demo")}
              >
                {busy ? "Opening workspace…" : "Open demo workspace"}
                <ArrowRight size={17} />
              </button>
              <p className="small muted">
                Your workspace persists on this machine and is scoped to this
                browser’s signed session. The session lasts seven days.
              </p>
            </>
          )}
          {!live && !demo && (
            <div className="notice">
              Login is unavailable until Supabase is configured. See the README
              for setup.
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && <p role="status">{message}</p>}
          <div className="login-trust">
            <ShieldCheck size={16} /> Human approval comes first. Always.
          </div>
        </div>
      </main>
    </div>
  );
}
