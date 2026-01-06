"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";

import { areasColRef } from "@/lib/firebase/refs";
import type { Area } from "@/lib/firebase/schema";

export function useAreas(tenantId: string) {
  const [areasById, setAreasById] = useState<Record<string, Area> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useMemo(() => {
    const col = areasColRef(tenantId);
    return query(col, orderBy("order", "asc"));
  }, [tenantId]);

  useEffect(() => {
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: Record<string, Area> = {};
        snap.forEach((d) => {
          next[d.id] = d.data() as Area;
        });
        setAreasById(next);
      },
      (e) => setError(e instanceof Error ? e.message : "Failed to load areas"),
    );
    return () => unsub();
  }, [q]);

  return { areasById, error };
}

