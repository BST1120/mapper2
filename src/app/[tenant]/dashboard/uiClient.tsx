"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { formatDateYYYYMMDD } from "@/lib/date/today";
import { useAreas, useAssignments, useShifts, useStaff } from "@/lib/firebase/hooks";
import { buildDisplayName } from "@/lib/staff/displayName";

function pct(used: number, total: number) {
  if (total <= 0) return "-";
  return `${Math.round((used / total) * 100)}%`;
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

    // Sort areas by configured order; always show free/break at end.
    const orderedAreas = Object.entries(areasById)
      .map(([id, a]) => ({ id, name: a.name, order: a.order, type: a.type }))
      .sort((a, b) => a.order - b.order);

    const rows = [
      ...orderedAreas.map((a) => ({
        id: a.id,
        name: a.name,
        count: counts[a.id] ?? 0,
      })),
      { id: "free", name: "フリー", count: counts["free"] ?? 0 },
      { id: "break", name: "休憩", count: counts["break"] ?? 0 },
    ];

    return {
      date,
      totalPresent,
      breakRate: pct(breakUsed, breakTotal),
      onBreak,
      rows,
      presentNames: presentIds
        .map((id) => staffById[id])
        .filter(Boolean)
        .map((s) => buildDisplayName(s!)),
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
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {computed.rows.map((r) => (
            <div key={r.id} className="rounded-lg border bg-zinc-50 px-3 py-2">
              <div className="text-sm text-zinc-700">{r.name}</div>
              <div className="text-xl font-semibold">{r.count}名</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

