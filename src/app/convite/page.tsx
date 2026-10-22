import { config } from "@/server/config";
import { PreviewNotice } from "@/components/preview-notice";
import { AuthForm } from "@/components/auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (config.preview) return <PreviewNotice />;
  const q = await searchParams;
  return <AuthForm kind={"invite"} token={q.token || ""} />;
}
