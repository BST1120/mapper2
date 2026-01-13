import { redirect } from "next/navigation";

export default function Home() {
  const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? "demo";
  redirect(`/${encodeURIComponent(tenantId)}`);
}
