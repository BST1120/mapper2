"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { bootstrapTenantAndAreas } from "@/lib/firebase/bootstrap";

export function AdminSettingsClient() {
  const params = useParams<{ tenant: string; editKey: string }>();
  const tenantId = params.tenant;

  const [tenantName, setTenantName] = useState("iwara");
  const [minStaff, setMinStaff] = useState<number>(0);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const hint = useMemo(
    () =>
      `この操作は Firestore に tenants/${tenantId} と areas を作成します。`,
    [tenantId],
  );

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm text-zinc-600">{hint}</div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-medium">園名（tenant name）</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">手薄しきい値（最低人数）</span>
          <input
            className="rounded-lg border px-3 py-2"
            type="number"
            value={minStaff}
            onChange={(e) => setMinStaff(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={busy || !tenantName.trim()}
          onClick={async () => {
            setBusy(true);
            setStatus("");
            try {
              const res = await bootstrapTenantAndAreas({
                tenantId,
                tenantName: tenantName.trim(),
                minStaffThreshold: minStaff,
              });
              setStatus(
                res.created
                  ? "初期データを作成しました。"
                  : "既に作成済みのため変更しませんでした。",
              );
            } catch (e: unknown) {
              setStatus(e instanceof Error ? e.message : "Failed to bootstrap.");
            } finally {
              setBusy(false);
            }
          }}
        >
          初期データ作成（テナント＋エリア）
        </button>

        {status ? (
          <span className="text-sm text-zinc-700">{status}</span>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        注意：秘密URL方式のため、このURLを知っている人は編集機能にアクセスできます。URLは管理者のみで共有してください。
      </div>
    </div>
  );
}

