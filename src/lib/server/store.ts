import "server-only";
import { generationProvider } from "./config";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Actor, Workspace, WorkspaceResponse } from "../model";
import { createWorkspace } from "../seed";
import { applyOperation, DomainError, type Operation } from "../workflow";
import { localDirectory, supabaseServer } from "./auth";

const queues = new Map<string, Promise<unknown>>();
async function exclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const promise = prev.catch(() => {}).then(fn);
  queues.set(key, promise);
  try {
    return await promise;
  } finally {
    if (queues.get(key) === promise) queues.delete(key);
  }
}
async function saveDemo(actor: Actor, state: Workspace) {
  await mkdir(path.join(localDirectory(), "workspaces"), {
    recursive: true,
    mode: 0o700,
  });
  const target = path.join(localDirectory(), "workspaces", `${actor.id}.json`),
    temp = `${target}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
  await rename(temp, target);
}
async function readDemo(actor: Actor): Promise<Workspace> {
  try {
    return JSON.parse(
      await readFile(
        path.join(localDirectory(), "workspaces", `${actor.id}.json`),
        "utf8",
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const state = createWorkspace();
    await saveDemo(actor, state);
    return state;
  }
}
export async function loadWorkspace(actor: Actor): Promise<WorkspaceResponse> {
  let workspace: Workspace;
  if (actor.mode === "demo")
    workspace = await exclusive(actor.id, () => readDemo(actor));
  else {
    const sb = await supabaseServer();
    const { data, error } = await sb.rpc("command_center_workspace");
    if (error) {
      console.error("Workspace load failed:", error.code);
      throw new DomainError(
        "Workspace could not be loaded. Apply the Supabase migration and check account permissions.",
        503,
      );
    }
    workspace = data.workspace as Workspace;
    actor.role = data.role;
  }
  return {
    workspace,
    actor,
    generationProvider: generationProvider(),
  };
}
export async function mutateWorkspace(
  actor: Actor,
  op: Operation,
  revision: number,
): Promise<WorkspaceResponse> {
  if (actor.mode === "demo") {
    const workspace = await exclusive(actor.id, async () => {
      const old = await readDemo(actor);
      if (old.revision !== revision)
        throw new DomainError("Workspace changed. Refresh and try again.", 409);
      const next = applyOperation(old, op, actor);
      await saveDemo(actor, next);
      return next;
    });
    return {
      workspace,
      actor,
      generationProvider: generationProvider(),
    };
  }
  const current = await loadWorkspace(actor);
  // Validate against the same state the database will lock and compare by revision.
  applyOperation(current.workspace, op, current.actor);
  const sb = await supabaseServer();
  const { error } = await sb.rpc("command_center_operation", {
    p_business_id: current.workspace.business.id,
    p_revision: revision,
    p_operation: op,
  });
  if (error) {
    console.error("Workspace mutation failed:", error.code);
    if (error.code === "40001")
      throw new DomainError("Workspace changed. Refresh and try again.", 409);
    if (error.code === "42501")
      throw new DomainError("Your role does not permit this action.", 403);
    throw new DomainError(
      "Could not save this change. Refresh, check the input, and try again.",
      400,
    );
  }
  return loadWorkspace(actor);
}
