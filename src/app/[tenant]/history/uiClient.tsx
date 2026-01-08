"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Timestamp } from "firebase/firestore";

import { formatDateYYYYMMDD } from "@/lib/date/today";
import { useAuditLogs, useStaff } from "@/lib/firebase/hooks";
import type { AuditLog } from "@/lib/firebase/schema";
import { buildDisplayName } from "@/lib/staff/displayName";

function formatTime(ts: unknown): string {
  const t = ts as Timestamp | undefined;
  if (!t?.toDate) return "-";
  const d = t.toDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function labelForType(type: AuditLog["type"]) {
  switch (type) {
    case "move":
      return "移動";
    case "lock":
      return "ロック";
    case "unlock":
      return "ロック解除";
    case "break_start":
      return "休憩開始";
    case "break_end":
      return "休憩終了";
    case "break_cancel":
      return "休憩取消";
    case "import":
      return "取込";
    default:
      return type;
  }
}

export function HistoryClient() {
  const params = useParams<{ tenant: string }>();
  const tenantId = params.tenant;
  const sp = useSearchParams();
  const date =
    sp.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(sp.get("date")!)
      ? sp.get("date")!
      : formatDateYYYYMMDD(new Date());

  const { staffById } = useStaff(tenantId);
  const { logs, error } = useAuditLogs(tenantId, date, 300);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");

  const staffOptions = useMemo(() => {
    if (!staffById) return [];
    return Object.entries(staffById)
      .map(([id, s]) => ({ id, label: buildDisplayName(s) }))
      .sort((a, b) => a.label.localeCompare(b.label, "ja"));
  }, [staffById]);

  const filtered = useMemo(() => {
    if (!logs) return null;
    return logs.filter(({ log }) => {
      if (typeFilter !== "all" && log.type !== typeFilter) return false;
      if (staffFilter !== "all" && log.staffId !== staffFilter) return false;
      return true;
    });
  }, [logs, typeFilter, staffFilter]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!logs || !staffById) return <div className="rounded-xl border bg-white p-4 text-sm text-zinc-600">読み込み中…</div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 text-sm">
        <div className="text-xs text-zinc-500">日付: {date}</div>
        <label className="inline-flex items-center gap-2">
          <span className="text-xs text-zinc-600">種別</span>
          <select
            className="rounded-lg border px-2 py-1"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">すべて</option>
            <option value="move">移動</option>
            <option value="break_start">休憩開始</option>
            <option value="break_end">休憩終了</option>
            <option value="break_cancel">休憩取消</option>
            <option value="lock">ロック</option>
            <option value="unlock">ロック解除</option>
            <option value="import">取込</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2">
          <span className="text-xs text-zinc-600">職員</span>
          <select
            className="rounded-lg border px-2 py-1"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
          >
            <option value="all">すべて</option>
            {staffOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto text-xs text-zinc-500">
          表示: {filtered?.length ?? 0} / {logs.length}
        </div>
      </div>

      <div className="overflow-auto rounded-xl border bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-zinc-50 text-zinc-700">
            <tr>
              <th className="p-2 text-left">時刻</th>
              <th className="p-2 text-left">種別</th>
              <th className="p-2 text-left">職員</th>
              <th className="p-2 text-left">内容</th>
            </tr>
          </thead>
          <tbody>
            {(filtered ?? []).map(({ id, log }) => {
              const staff = log.staffId ? staffById[log.staffId] : undefined;
              const staffName = staff ? buildDisplayName(staff) : log.staffId ?? "-";
              const detail =
                log.type === "move"
                  ? `${log.fromAreaId ?? "?"} → ${log.toAreaId ?? "?"}`
                  : log.type === "break_start"
                    ? `${log.minutes ?? ""}分`
                    : log.type === "import"
                      ? `${log.importedCount ?? ""}件`
                      : "";
              return (
                <tr key={id} className="border-t">
                  <td className="p-2 text-zinc-600">{formatTime(log.timestamp)}</td>
                  <td className="p-2 font-medium">{labelForType(log.type)}</td>
                  <td className="p-2">{staffName}</td>
                  <td className="p-2 text-zinc-700">{detail}</td>
                </tr>
              );
            })}
            {(filtered ?? []).length === 0 ? (
              <tr>
                <td className="p-4 text-sm text-zinc-600" colSpan={4}>
                  該当する履歴がありません。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-zinc-500">
        ※履歴は当日（選択日）の `auditLogs` を表示しています。
      </div>
    </div>
  );
}

