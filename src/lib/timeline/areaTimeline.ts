import type { Timestamp } from "firebase/firestore";

import type { Assignment, AuditLog } from "@/lib/firebase/schema";

function toMs(ts: unknown): number | null {
  const t = ts as Timestamp | undefined;
  if (!t?.toDate) return null;
  return t.toDate().getTime();
}

export type AreaMove = { ms: number; toAreaId: string; fromAreaId?: string };

export type StaffAreaTimeline = {
  initialAreaId: string;
  moves: AreaMove[]; // sorted asc by ms
};

export function buildStaffAreaTimelines(args: {
  staffIds: string[];
  assignmentsByStaffId: Record<string, Assignment> | null | undefined;
  logs: Array<{ id: string; log: AuditLog }> | null | undefined;
}): Record<string, StaffAreaTimeline> {
  const { staffIds, assignmentsByStaffId, logs } = args;
  const byStaff: Record<string, AreaMove[]> = {};

  for (const staffId of staffIds) byStaff[staffId] = [];

  for (const item of logs ?? []) {
    const log = item.log;
    if (log.type !== "move") continue;
    if (!log.staffId) continue;
    if (!(log.staffId in byStaff)) continue;
    if (!log.toAreaId) continue;
    const ms = toMs(log.timestamp);
    if (ms == null) continue;
    byStaff[log.staffId]!.push({ ms, toAreaId: log.toAreaId, fromAreaId: log.fromAreaId });
  }

  const out: Record<string, StaffAreaTimeline> = {};
  for (const staffId of staffIds) {
    const moves = (byStaff[staffId] ?? []).sort((a, b) => a.ms - b.ms);
    const currentArea = assignmentsByStaffId?.[staffId]?.areaId ?? "free";
    const initialAreaId = moves.length > 0 && moves[0]!.fromAreaId ? moves[0]!.fromAreaId! : currentArea;
    out[staffId] = { initialAreaId, moves };
  }
  return out;
}

