import { redirect } from "next/navigation";
import { currentActor, demoEnabled, hasSupabase } from "@/lib/server/auth";
import { LoginForm } from "@/components/login-form";
export default async function Login() {
  if (await currentActor()) redirect("/dashboard");
  return <LoginForm demo={demoEnabled()} live={hasSupabase()} />;
}
