"use client";

import { useEffect, useMemo, useState } from "react";
import { limit, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";

import {
  areasColRef,
  assignmentsColRef,
  auditLogsColRef,
  dayStateDocRef,
  shiftTypesColRef,
  shiftsColRef,
  staffColRef,
  tenantDocRef,
} from "@/lib/firebase/refs";
import type {
  Area,
  Assignment,
  AuditLog,
  DayState,
  Shift,
  ShiftType,
  Staff,
  Tenant,
} from "@/lib/firebase/schema";

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

export function useTenant(tenantId: string) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ref = tenantDocRef(tenantId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setTenant((snap.data() as Tenant) ?? null);
      },
      (e) => setError(e instanceof Error ? e.message : "Failed to load tenant"),
    );
    return () => unsub();
  }, [tenantId]);

  return { tenant, error };
}

export function useStaff(tenantId: string) {
  const [staffById, setStaffById] = useState<Record<string, Staff> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useMemo(() => {
    const col = staffColRef(tenantId);
    return query(col, orderBy("lastName", "asc"));
  }, [tenantId]);

  useEffect(() => {
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: Record<string, Staff> = {};
        snap.forEach((d) => {
          next[d.id] = d.data() as Staff;
        });
        setStaffById(next);
      },
      (e) => setError(e instanceof Error ? e.message : "Failed to load staff"),
    );
    return () => unsub();
  }, [q]);

  return { staffById, error };
}

export function useAssignments(tenantId: string, date: string) {
  const [assignmentsByStaffId, setAssignmentsByStaffId] = useState<
    Record<string, Assignment> | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const q = useMemo(() => {
    const col = assignmentsColRef(tenantId, date);
    // Avoid orderBy on optional fields (would error if missing on some docs).
    return query(col);
  }, [tenantId, date]);

  useEffect(() => {
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: Record<string, Assignment> = {};
        snap.forEach((d) => {
          next[d.id] = d.data() as Assignment;
        });
        setAssignmentsByStaffId(next);
      },
      (e) =>
        setError(e instanceof Error ? e.message : "Failed to load assignments"),
    );
    return () => unsub();
  }, [q]);

  return { assignmentsByStaffId, error };
}

export function useDayState(tenantId: string, date: string) {
  const [state, setState] = useState<DayState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ref = dayStateDocRef(tenantId, date);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          // Create default state doc (unlocked) for convenience.
          setDoc(ref, { editLocked: false } satisfies DayState, {
            merge: true,
          });
          setState({ editLocked: false });
          return;
        }
        setState((snap.data() as DayState) ?? { editLocked: false });
      },
      (e) =>
        setError(e instanceof Error ? e.message : "Failed to load day state"),
    );
    return () => unsub();
  }, [tenantId, date]);

  return { state, error };
}

export function useShifts(tenantId: string, date: string) {
  const [shiftsByStaffId, setShiftsByStaffId] = useState<Record<string, Shift> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useMemo(() => {
    const col = shiftsColRef(tenantId, date);
    return query(col);
  }, [tenantId, date]);

  useEffect(() => {
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: Record<string, Shift> = {};
        snap.forEach((d) => {
          next[d.id] = d.data() as Shift;
        });
        setShiftsByStaffId(next);
      },
      (e) => setError(e instanceof Error ? e.message : "Failed to load shifts"),
    );
    return () => unsub();
  }, [q]);

  return { shiftsByStaffId, error };
}

export function useShiftTypes(tenantId: string) {
  const [shiftTypesByCode, setShiftTypesByCode] = useState<Record<string, ShiftType> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useMemo(() => query(shiftTypesColRef(tenantId), orderBy("order", "asc")), [tenantId]);

  useEffect(() => {
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: Record<string, ShiftType> = {};
        snap.forEach((d) => {
          next[d.id] = d.data() as ShiftType;
        });
        setShiftTypesByCode(next);
      },
      (e) =>
        setError(e instanceof Error ? e.message : "Failed to load shift types"),
    );
    return () => unsub();
  }, [q]);

  return { shiftTypesByCode, error };
}

export function useAuditLogs(tenantId: string, date: string, limitCount = 200) {
  const [logs, setLogs] = useState<Array<{ id: string; log: AuditLog }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useMemo(() => {
    const col = auditLogsColRef(tenantId, date);
    // timestamp is always set by our writers; order descending for newest-first.
    return query(col, orderBy("timestamp", "desc"), limit(limitCount));
  }, [tenantId, date, limitCount]);

  useEffect(() => {
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: Array<{ id: string; log: AuditLog }> = [];
        snap.forEach((d) => next.push({ id: d.id, log: d.data() as AuditLog }));
        setLogs(next);
      },
      (e) => setError(e instanceof Error ? e.message : "Failed to load audit logs"),
    );
    return () => unsub();
  }, [q]);

  return { logs, error };
}

