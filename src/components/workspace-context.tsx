"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceResponse } from "@/lib/model";
import type { UserOperation } from "@/lib/validation";
type Context = WorkspaceResponse & {
  busy: boolean;
  mutate: (operation: UserOperation, success?: string) => Promise<boolean>;
  request: (
    url: string,
    body: object | FormData,
    success: string,
  ) => Promise<boolean>;
  refresh: () => Promise<void>;
  notify: (text: string) => void;
};
const WorkspaceContext = createContext<Context | null>(null);
export function WorkspaceProvider({
  initial,
  children,
}: {
  initial: WorkspaceResponse;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const notify = useCallback(
    (text: string) => setToast({ text, error: false }),
    [],
  );
  const refresh = useCallback(async () => {
    const res = await fetch("/api/workspace", { cache: "no-store" });
    if (res.ok) setData(await res.json());
    else if (res.status === 401) {
      router.push("/login");
      router.refresh();
    }
  }, [router]);
  const pendingJobs = data.workspace.jobs.some(
    (j) => j.status === "queued" || j.status === "running",
  );
  useEffect(() => {
    if (!pendingJobs) return;
    const timer = setInterval(() => {
      void refresh().catch(() => {});
    }, 1200);
    return () => clearInterval(timer);
  }, [pendingJobs, refresh]);
  async function request(
    url: string,
    body: object | FormData,
    success: string,
  ) {
    setBusy(true);
    try {
      const form = body instanceof FormData;
      const res = await fetch(url, {
        method: "POST",
        headers: form ? undefined : { "Content-Type": "application/json" },
        body: form ? body : JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) await refresh();
        throw new Error(json.error || "Could not save changes.");
      }
      setData(json);
      setToast({ text: success, error: false });
      return true;
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Please try again.",
        error: true,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }
  const mutate = (operation: UserOperation, success = "Changes saved.") =>
    request(
      "/api/workspace",
      { revision: data.workspace.revision, operation },
      success,
    );
  return (
    <WorkspaceContext.Provider
      value={{ ...data, busy, mutate, request, refresh, notify }}
    >
      {children}
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          <span>{toast.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Workspace provider is required.");
  return context;
}
