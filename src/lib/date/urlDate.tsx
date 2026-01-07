"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { formatDateYYYYMMDD } from "@/lib/date/today";

export function useUrlDate() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const date = useMemo(() => {
    const v = sp.get("date");
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    return formatDateYYYYMMDD(new Date());
  }, [sp]);

  const setDate = (next: string) => {
    const params = new URLSearchParams(sp.toString());
    if (next) params.set("date", next);
    router.push(`${pathname}?${params.toString()}`);
  };

  return { date, setDate };
}

