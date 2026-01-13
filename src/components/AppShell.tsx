"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DateSwitcher } from "@/components/DateSwitcher";

const NAV_ITEMS = [
  { key: "mapper", label: "Mapper", path: "mapper" },
  { key: "dashboard", label: "Dashboard", path: "dashboard" },
  { key: "timeline", label: "Timeline", path: "timeline" },
  { key: "history", label: "History", path: "history" },
  { key: "staff", label: "Staff", path: "staff" },
  { key: "import", label: "Import", path: "import" },
  { key: "settings", label: "Settings", path: "settings" },
] as const;

function withDateQuery(path: string, date: string | null) {
  if (!date) return path;
  const u = new URL(path, "http://local");
  u.searchParams.set("date", date);
  return `${u.pathname}?${u.searchParams.toString()}`;
}

export function AppShell({
  tenantId,
  children,
}: {
  tenantId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const date = searchParams.get("date");

  const base = `/${encodeURIComponent(tenantId)}`;

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={withDateQuery(`${base}/mapper`, date)}
              className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold tracking-tight text-zinc-900 hover:bg-zinc-100"
            >
              Iwara Mapper
            </Link>
            <span className="truncate text-xs text-zinc-500">{tenantId}</span>
          </div>
          <DateSwitcher />
        </div>
        <nav className="mx-auto w-full max-w-7xl overflow-x-auto px-2 pb-2">
          <div className="flex items-center gap-1 px-2">
            {NAV_ITEMS.map((item) => {
              const href = withDateQuery(`${base}/${item.path}`, date);
              const isActive = pathname === `${base}/${item.path}`;
              return (
                <Link
                  key={item.key}
                  href={href}
                  className={[
                    "whitespace-nowrap rounded-full px-3 py-1.5 text-sm",
                    isActive
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-100",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

