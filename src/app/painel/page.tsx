import { config } from "@/server/config";
import { redirect } from "next/navigation";
import { identity } from "@/server/auth";
import { Dashboard } from "@/components/dashboard";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (config.preview) redirect("/previa");
  if (!(await identity())) redirect("/entrar");
  return <Dashboard />;
}
