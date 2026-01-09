"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { formatDateYYYYMMDD } from "@/lib/date/today";
import { useAreas, useAssignments, useShifts, useStaff } from "@/lib/firebase/hooks";

function pct(used: number, total: number) {
  if (total <= 0) return "-";
  return `${Math.round((used / total) * 100)}%`;
}

type AreaSlot = { id: string; fallbackName: string; span?: number };

const topRow: AreaSlot[] = [
  { id: "saru", fallbackName: "さる" },
  { id: "hebi", fallbackName: "へび" },
  { id: "lunch", fallbackName: "ランチ" },
  { id: "usagi", fallbackName: "うさぎ" },
  { id: "tora", fallbackName: "とら" },
  { id: "nezumi", fallbackName: "ねずみ" },
];

const midRow: AreaSlot[] = [
  { id: "yard_older", fallbackName: "以上児園庭", span: 2 },
  { id: "office", fallbackName: "事務室", span: 2 },
  { id: "yard_younger", fallbackName: "未満児園庭", span: 2 },
];

const bottomRow: AreaSlot = { id: "yard", fallbackName: "園庭（広い）", span: 6 };

function spanClass(span: number | undefined) {
  switch (span) {
    case 1:
      return "col-span-1";
    case 2:
      return "col-span-2";
    case 3:
      return "col-span-3";
    case 4:
      return "col-span-4";
    case 5:
      return "col-span-5";
    case 6:
    default:
      return "col-span-6";
  }
}

export function DashboardClient() {
  const params = useParams<{ tenant: string }>();
  const tenantId = params.tenant;
  const sp = useSearchParams();
  const date =
    sp.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(sp.get("date")!)
      ? sp.get("date")!
      : formatDateYYYYMMDD(new Date());

  const { areasById } = useAreas(tenantId);
  const { staffById } = useStaff(tenantId);
  const { assignmentsByStaffId } = useAssignments(tenantId, date);
  const { shiftsByStaffId } = useShifts(tenantId, date);

  const computed = useMemo(() => {
    if (!areasById || !staffById || !assignmentsByStaffId || !shiftsByStaffId) return null;

    // Count only staff that are meant to appear on mapper (gives the manager "現場の人数").
    const presentIds = Object.keys(shiftsByStaffId).filter((id) => {
      const s = staffById[id];
      const sh = shiftsByStaffId[id];
      if (!s || !sh) return false;
      if (s.active === false) return false;
      if (s.showOnMapper === false) return false;
      if (sh.absent) return false;
      return true;
    });

    const totalPresent = presentIds.length;

    // break stats
    let breakTotal = 0;
    let breakUsed = 0;
    for (const id of presentIds) {
      const sh = shiftsByStaffId[id]!;
      const slots = sh.breakSlots ?? [];
      breakTotal += slots.length;
      breakUsed += slots.filter((x) => x.used).length;
    }

    // break area count
    const onBreak = presentIds.filter((id) => (assignmentsByStaffId[id]?.areaId ?? "free") === "break").length;

    // area counts (include free/break)
    const counts: Record<string, number> = {};
    for (const id of presentIds) {
      const areaId = assignmentsByStaffId[id]?.areaId ?? "free";
      counts[areaId] = (counts[areaId] ?? 0) + 1;
    }

    const areaName = (areaId: string, fallback: string) =>
      areasById[areaId]?.name ?? fallback;

    return {
      date,
      totalPresent,
      breakRate: pct(breakUsed, breakTotal),
      onBreak,
      counts,
      areaName,
    };
  }, [areasById, staffById, assignmentsByStaffId, shiftsByStaffId, date]);

  if (!areasById || !staffById || !assignmentsByStaffId || !shiftsByStaffId) {
    return <div className="rounded-xl border bg-white p-4 text-sm text-zinc-600">読み込み中…</div>;
  }
  if (!computed) return null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "総出勤人数", value: `${computed.totalPresent}名` },
          { label: "休憩消化率", value: computed.breakRate },
          { label: "休憩中人数", value: `${computed.onBreak}名` },
          { label: "手薄時間", value: "-" }, // タイムバー側で実装（フェーズ7）
        ].map((k) => (
          <div key={k.label} className="rounded-xl border bg-white p-4">
            <div className="text-sm text-zinc-600">{k.label}</div>
            <div className="mt-1 text-2xl font-semibold">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium">エリア別人数（{computed.date}）</div>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border bg-zinc-50 p-3">
            <div className="grid grid-cols-6 gap-3">
              {topRow.map((slot) => {
                const c = computed.counts[slot.id] ?? 0;
                return (
                  <div key={`cell-${slot.id}`} className="col-span-1">
                    <div
                      className={[
                        "rounded-xl border p-3",
                        c > 0 ? "bg-orange-50 border-orange-200" : "bg-zinc-100 border-zinc-200",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{computed.areaName(slot.id, slot.fallbackName)}</div>
                        <div className="text-xs text-zinc-500">{c}名</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {midRow.map((slot) => {
                const c = computed.counts[slot.id] ?? 0;
                return (
                  <div key={`cell-${slot.id}`} className={spanClass(slot.span)}>
                    <div
                      className={[
                        "rounded-xl border p-3",
                        c > 0 ? "bg-orange-50 border-orange-200" : "bg-zinc-100 border-zinc-200",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{computed.areaName(slot.id, slot.fallbackName)}</div>
                        <div className="text-xs text-zinc-500">{c}名</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {(() => {
                const c = computed.counts[bottomRow.id] ?? 0;
                return (
                  <div className={spanClass(bottomRow.span)}>
                    <div
                      className={[
                        "rounded-xl border p-3",
                        c > 0 ? "bg-orange-50 border-orange-200" : "bg-zinc-100 border-zinc-200",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{computed.areaName(bottomRow.id, bottomRow.fallbackName)}</div>
                        <div className="text-xs text-zinc-500">{c}名</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="space-y-3">
            {[
              { id: "free", fallbackName: "フリー" },
              { id: "break", fallbackName: "休憩" },
            ].map((slot) => {
              const c = computed.counts[slot.id] ?? 0;
              return (
                <div key={`side-${slot.id}`} className="rounded-xl border bg-white p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{computed.areaName(slot.id, slot.fallbackName)}</div>
                    <div className="text-xs text-zinc-500">{c}名</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

