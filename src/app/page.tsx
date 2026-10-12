import { redirect } from "next/navigation";
import { currentActor } from "@/lib/server/auth";
export default async function Home() {
  redirect((await currentActor()) ? "/dashboard" : "/login");
}
