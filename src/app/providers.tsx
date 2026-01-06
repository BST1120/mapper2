"use client";

import { useEffect, useState } from "react";

import { ensureAnonymousAuth } from "@/lib/firebase/client";

export function Providers({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureAnonymousAuth()
      .then(({ uid }) => {
        if (!cancelled) setUid(uid);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Auth init failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-dvh">
      <div className="border-b bg-white px-4 py-2 text-sm text-zinc-600">
        {error ? (
          <span className="text-red-600">Firebase: {error}</span>
        ) : uid ? (
          <span>Firebase: connected (device id: {uid})</span>
        ) : (
          <span>Firebase: connecting…</span>
        )}
      </div>
      {children}
    </div>
  );
}

