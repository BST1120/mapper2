import { NavClient } from "./NavClient";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      <NavClient tenant={tenant} mode="viewer" />
      {children}
    </div>
  );
}

