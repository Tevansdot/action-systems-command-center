import { redirect } from "next/navigation";
import { currentActor } from "@/lib/server/auth";
import { loadWorkspace } from "@/lib/server/store";
import { WorkspaceProvider } from "@/components/workspace-context";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const initial = await loadWorkspace(actor);
  return (
    <WorkspaceProvider initial={initial}>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}
