import Link from "next/link";

const nav = [
  { href: "mapper", label: "マッパー" },
  { href: "timeline", label: "タイムバー" },
  { href: "dashboard", label: "ダッシュボード" },
  { href: "history", label: "履歴" },
  { href: "staff", label: "職員" },
  { href: "import", label: "取込" },
  { href: "settings", label: "設定" },
] as const;

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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-semibold tracking-tight">
            mapper2 <span className="text-sm font-normal text-zinc-500">{tenant}</span>
          </div>
          <div className="text-sm text-zinc-600">
            MVP（実装中）— 配置/休憩/タイムバー
          </div>
        </div>
        <nav className="flex flex-wrap gap-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={`/${tenant}/${item.href}`}
              className="rounded-full border bg-white px-3 py-1 text-sm hover:bg-zinc-50"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}

