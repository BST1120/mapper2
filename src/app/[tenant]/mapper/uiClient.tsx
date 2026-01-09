"use client";

import { useParams } from "next/navigation";
import { useSearchParams } from "next/navigation";

import { MapperGrid } from "./ui";
import { formatDateYYYYMMDD } from "@/lib/date/today";
import { useAreas, useAssignments, useDayState, useShifts, useStaff } from "@/lib/firebase/hooks";

export function MapperPageClient({ fallback }: { fallback: React.ReactNode }) {
  const params = useParams<{ tenant: string }>();
  const tenantId = params.tenant;
  const sp = useSearchParams();
  const date = sp.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(sp.get("date")!)
    ? sp.get("date")!
    : formatDateYYYYMMDD(new Date());
  const { areasById, error: areasError } = useAreas(tenantId);
  const { staffById, error: staffError } = useStaff(tenantId);
  const { assignmentsByStaffId, error: assnError } = useAssignments(tenantId, date);
  const { state, error: stateError } = useDayState(tenantId, date);
  const { shiftsByStaffId, error: shiftsError } = useShifts(tenantId, date);

  const error = areasError || staffError || assnError || stateError || shiftsError;
  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!areasById || !staffById || !assignmentsByStaffId || !state || !shiftsByStaffId) return <>{fallback}</>;

  return (
    <MapperGrid
      mode="viewer"
      tenantId={tenantId}
      date={date}
      areasById={areasById}
      staffById={staffById}
      assignmentsByStaffId={assignmentsByStaffId}
      shiftsByStaffId={shiftsByStaffId}
      editLocked={state.editLocked}
      memo={state.memo ?? ""}
    />
  );
}

