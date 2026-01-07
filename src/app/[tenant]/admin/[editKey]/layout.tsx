import { NavClient } from "../../NavClient";

export default async function AdminTenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string; editKey: string }>;
}) {
  const { tenant, editKey } = await params;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      <NavClient tenant={tenant} mode="admin" editKey={editKey} />
      {children}
    </div>
  );
}

