import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Iwara Mapper",
  description: "配置マッパー + 休憩管理 + タイムバー（MVP）",
};

export default async function TenantLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}>) {
  const { tenant } = await params;

  return <AppShell tenantId={tenant}>{children}</AppShell>;
}

