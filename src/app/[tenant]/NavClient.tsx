"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { useUrlDate } from "@/lib/date/urlDate";

const nav = [
  { href: "mapper", label: "マッパー" },
  { href: "timeline", label: "タイムバー" },
  { href: "dashboard", label: "ダッシュボード" },
  { href: "history", label: "履歴" },
  { href: "staff", label: "職員" },
  { href: "import", label: "取込" },
  { href: "settings", label: "設定" },
] as const;

export function NavClient({
  tenant,
  mode,
  editKey,
}: {
  tenant: string;
  mode: "viewer" | "admin";
  editKey?: string;
}) {
  const sp = useSearchParams();
  const { date, setDate } = useUrlDate();

  const base = mode === "admin" ? `/${tenant}/admin/${editKey}` : `/${tenant}`;

  const query = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    p.set("date", date);
    return `?${p.toString()}`;
  }, [sp, date]);

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-lg font-semibold tracking-tight">
          mapper2 <span className="text-sm font-normal text-zinc-500">{tenant}</span>
        </div>
        <div className="text-sm text-zinc-600">
          {mode === "admin" ? "管理者（秘密URL）" : "閲覧"} — 配置/休憩/タイムバー
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 sm:items-end">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <span>日付</span>
          <input
            className="rounded-lg border px-2 py-1"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <nav className="flex flex-wrap gap-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={`${base}/${item.href}${query}`}
              className="rounded-full border bg-white px-3 py-1 text-sm hover:bg-zinc-50"
            >
              {item.label}
            </Link>
          ))}
          {mode === "admin" ? (
            <Link
              href={`/${tenant}/mapper${query}`}
              className="rounded-full border bg-white px-3 py-1 text-sm hover:bg-zinc-50"
            >
              閲覧URLへ
            </Link>
          ) : null}
        </nav>
      </div>
    </div>
  );
}

