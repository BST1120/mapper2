"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

function todayYYYYMMDD() {
  // client-side: local timezone is fine for a quick selector
  return new Date().toISOString().slice(0, 10);
}

export function DateSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const date = searchParams.get("date") ?? todayYYYYMMDD();

  const hrefForDate = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    params.set("date", date);
    return `${pathname}?${params.toString()}`;
  }, [date, pathname, searchParams]);

  return (
    <div className="flex items-center gap-2">
      <label className="hidden text-xs text-zinc-600 sm:block" htmlFor="date">
        日付
      </label>
      <input
        id="date"
        type="date"
        value={date}
        onChange={(e) => {
          const next = e.target.value;
          const params = new URLSearchParams(searchParams);
          params.set("date", next);
          router.replace(`${pathname}?${params.toString()}`);
        }}
        className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 shadow-sm"
      />
      <a
        href={hrefForDate}
        className="hidden rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 sm:block"
        title="この日付のURLを再読み込み"
      >
        URL
      </a>
    </div>
  );
}

