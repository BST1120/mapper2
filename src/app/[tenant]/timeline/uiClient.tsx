"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Timestamp } from "firebase/firestore";

import { formatDateYYYYMMDD } from "@/lib/date/today";
import { dateAtLocal } from "@/lib/date/localTime";
import { useAssignments, useAuditLogs, useShifts, useStaff, useTenant } from "@/lib/firebase/hooks";
import { buildDisplayName } from "@/lib/staff/displayName";
import { makeTimelineSlots } from "@/lib/timeline/slots";
import { computeUnderstaffedRanges } from "@/lib/timeline/understaffed";
import { buildStaffAreaTimelines } from "@/lib/timeline/areaTimeline";

type Slot = { t: Date; label: string };

function makeSlots(date: string): Slot[] {
  return makeTimelineSlots(date);
}

function toMs(ts: unknown): number | null {
  const t = ts as Timestamp | undefined;
  if (!t?.toDate) return null;
  return t.toDate().getTime();
}

export function TimelineClient() {
  const params = useParams<{ tenant: string }>();
  const sp = useSearchParams();
  const tenantId = params.tenant;
  const date =
    sp.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(sp.get("date")!)
      ? sp.get("date")!
      : formatDateYYYYMMDD(new Date());

  const { staffById, error: staffError } = useStaff(tenantId);
  const { shiftsByStaffId, error: shiftsError } = useShifts(tenantId, date);
  const { assignmentsByStaffId, error: assnError } = useAssignments(tenantId, date);
  const { logs, error: logsError } = useAuditLogs(tenantId, date, 1000);
  const { tenant, error: tenantError } = useTenant(tenantId);
  const error = staffError || shiftsError || assnError || logsError || tenantError;

  const slots = useMemo(() => makeSlots(date), [date]);
  const todayStr = formatDateYYYYMMDD(new Date());
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    if (date !== todayStr) {
      return;
    }
    // Set via callbacks (avoid setState directly in effect body).
    const t0 = window.setTimeout(() => setNowMs(Date.now()), 0);
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(id);
    };
  }, [date, todayStr]);

  const nowSlotIdx = useMemo(() => {
    if (date !== todayStr) return null;
    if (nowMs == null) return null;
    const start = dateAtLocal(date, "07:00").getTime();
    const end = dateAtLocal(date, "19:00").getTime();
    if (nowMs < start || nowMs > end) return null;
    // find last slot <= now (ignore last label slot for marker)
    let idx = 0;
    for (let i = 0; i < slots.length - 1; i++) {
      if (slots[i]!.t.getTime() <= nowMs) idx = i;
      else break;
    }
    return idx;
  }, [date, todayStr, slots, nowMs]);

  const rows = useMemo(() => {
    if (!staffById || !shiftsByStaffId) return null;
    const list = Object.entries(staffById)
      .map(([id, s]) => {
        const shift = shiftsByStaffId[id];
        return { id, staff: s, shift };
      })
      .filter((x) => x.staff.active)
      .filter((x) => x.staff.showOnTimeline !== false);
    list.sort((a, b) =>
      buildDisplayName(a.staff).localeCompare(buildDisplayName(b.staff), "ja"),
    );
    return list;
  }, [staffById, shiftsByStaffId]);

  const areaTimelines = useMemo(() => {
    if (!rows || !assignmentsByStaffId) return null;
    const staffIds = rows.map((r) => r.id);
    return buildStaffAreaTimelines({ staffIds, assignmentsByStaffId, logs });
  }, [rows, assignmentsByStaffId, logs]);

  const counts = useMemo(() => {
    if (!rows || !assignmentsByStaffId || !areaTimelines) return null;
    const arr: number[] = [];
    const trackers = rows.map((r) => {
      const tl = areaTimelines[r.id]!;
      return {
        id: r.id,
        shift: r.shift,
        areaId: tl.initialAreaId,
        moves: tl.moves,
        moveIdx: 0,
      };
    });
    for (let i = 0; i < slots.length; i++) {
      const tMs = slots[i]!.t.getTime();
      let c = 0;
      for (const tr of trackers) {
        // advance area timeline up to this slot
        while (tr.moveIdx < tr.moves.length && tr.moves[tr.moveIdx]!.ms <= tMs) {
          tr.areaId = tr.moves[tr.moveIdx]!.toAreaId;
          tr.moveIdx += 1;
        }
        // 事務室の職員は「その時間帯だけ」現場人数から除外
        if (tr.areaId === "office") continue;
        const sh = tr.shift;
        if (!sh || sh.absent) continue;
        const sMs = toMs(sh.startAt);
        const eMs = toMs(sh.endAt);
        if (sMs == null || eMs == null) continue;
        if (tMs >= sMs && tMs < eMs) c += 1;
      }
      arr.push(c);
    }
    return arr;
  }, [rows, slots, assignmentsByStaffId, areaTimelines]);

  const threshold = tenant?.minStaffThreshold ?? 0;
  const understaffed = useMemo(() => {
    if (!counts) return [];
    return computeUnderstaffedRanges({ slots, counts, threshold });
  }, [counts, slots, threshold]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!rows || !counts || !assignmentsByStaffId || !areaTimelines)
    return <div className="rounded-xl border bg-white p-4 text-sm text-zinc-600">読み込み中…</div>;

  const max = Math.max(...counts, 1);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium">人数推移（勤務中）</div>
        <div className="mt-1 text-xs text-zinc-600">
          手薄しきい値:{" "}
          <span className="font-medium">{threshold > 0 ? `${threshold}名` : "（未設定）"}</span>
          {threshold > 0 && understaffed.length > 0 ? (
            <span className="ml-2 text-red-700">
              手薄: {understaffed.map((r) => `${r.start}〜${r.end}`).slice(0, 2).join(" / ")}
              {understaffed.length > 2 ? " …" : ""}
            </span>
          ) : null}
        </div>
        <div className="mt-2 overflow-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[160px_1fr] gap-3">
              <div className="text-xs text-zinc-500">時間</div>
              <div className="grid grid-cols-[repeat(49,minmax(12px,1fr))] items-end gap-1">
                {counts.map((c, i) => (
                  <div
                    key={slots[i]!.label}
                    title={`${slots[i]!.label} ${c}名`}
                    className={[
                      "rounded",
                      threshold > 0 && c < threshold ? "bg-red-300" : "bg-zinc-200",
                    ].join(" ")}
                    style={{ height: `${Math.max(2, Math.round((c / max) * 40))}px` }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-[160px_1fr] gap-3">
              <div />
              <div className="grid grid-cols-[repeat(49,minmax(12px,1fr))] gap-1 text-[10px] text-zinc-500">
                {slots.map((s, i) => (
                  <div key={s.label} className="flex flex-col items-center">
                    <div>{s.label.endsWith(":00") ? s.label : ""}</div>
                    {nowSlotIdx === i ? (
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-600" title="現在時刻" />
                    ) : (
                      <div className="mt-0.5 h-2 w-2" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium">職員別</div>
        <div className="mt-2 overflow-auto">
          <div className="min-w-[900px]">
            {rows.map((r) => {
              const name = buildDisplayName(r.staff);
              const sh = r.shift;
              const sMs = sh ? toMs(sh.startAt) : null;
              const eMs = sh ? toMs(sh.endAt) : null;
              const dayStart = dateAtLocal(date, "07:00").getTime();
              const dayEnd = dateAtLocal(date, "19:00").getTime();
              const left =
                sMs != null ? Math.max(0, Math.round(((sMs - dayStart) / (dayEnd - dayStart)) * 100)) : 0;
              const right =
                eMs != null ? Math.max(0, Math.round(((eMs - dayStart) / (dayEnd - dayStart)) * 100)) : 0;
              const width = Math.max(0, right - left);

              return (
                <div key={r.id} className="grid grid-cols-[160px_1fr] items-center gap-3 border-t py-2 first:border-t-0">
                  <div className="text-sm">
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-zinc-500">
                      {sh ? (sh.absent ? "欠勤" : `${sh.workType}`) : "未設定"}
                    </div>
                  </div>
                  <div className="relative h-6 rounded bg-zinc-100">
                    {sh && !sh.absent && sMs != null && eMs != null ? (
                      <div
                        className="absolute top-0 h-6 rounded bg-emerald-300"
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${name} ${sh.workType}`}
                      />
                    ) : null}
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

