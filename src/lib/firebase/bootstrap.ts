"use client";

import { getDoc, Timestamp, serverTimestamp, writeBatch } from "firebase/firestore";

import { DEFAULT_AREAS } from "@/lib/defaults/areas";
import { DEFAULT_SHIFT_TYPES } from "@/lib/defaults/shiftTypes";
import { dateAtLocal } from "@/lib/date/localTime";
import { ensureAnonymousAuth } from "@/lib/firebase/client";
import {
  areaDocRef,
  assignmentDocRef,
  shiftDocRef,
  shiftTypeDocRef,
  staffDocRef,
  tenantDocRef,
} from "@/lib/firebase/refs";
import type { Shift, Staff, Tenant } from "@/lib/firebase/schema";

export async function bootstrapTenantAndAreas(args: {
  tenantId: string;
  tenantName: string;
  minStaffThreshold?: number;
}) {
  await ensureAnonymousAuth();

  const tRef = tenantDocRef(args.tenantId);
  const tSnap = await getDoc(tRef);
  if (tSnap.exists()) {
    return { created: false as const };
  }

  const tenant: Tenant = {
    name: args.tenantName,
    timezone: "Asia/Tokyo",
    minStaffThreshold: args.minStaffThreshold ?? 0,
    createdAt: serverTimestamp() as unknown,
    updatedAt: serverTimestamp() as unknown,
  };

  const batch = writeBatch(tRef.firestore);
  batch.set(tRef, tenant);
  for (const seed of DEFAULT_AREAS) {
    batch.set(areaDocRef(args.tenantId, seed.areaId), seed.area);
  }
  for (const st of DEFAULT_SHIFT_TYPES) {
    batch.set(shiftTypeDocRef(args.tenantId, st.code), st);
  }
  await batch.commit();

  return { created: true as const };
}

function codeToTimes(code: string, staff: Staff) {
  const found = DEFAULT_SHIFT_TYPES.find((s) => s.code === code);
  if (found) return { start: found.start, end: found.end };
  // fallback to fixed time or a sane default
  return { start: staff.fixedStart ?? "09:00", end: staff.fixedEnd ?? "18:00" };
}

function breakSlotsFor(staff: Staff): Shift["breakSlots"] {
  if (staff.breakPattern === "15_30") {
    return [
      { minutes: 15, used: false },
      { minutes: 30, used: false },
    ];
  }
  return [
    { minutes: 30, used: false },
    { minutes: 30, used: false },
  ];
}

export async function seedSampleStaff(args: { tenantId: string; date: string }) {
  await ensureAnonymousAuth();

  const samples: Array<{ id: string; staff: Staff }> = [
    {
      id: "sato_t",
      staff: {
        lastName: "佐藤",
        firstName: "太郎",
        firstInitial: "T",
        active: true,
        breakPattern: "30_30",
        shiftCodeDefault: "C",
        workTypeDefault: "C",
      },
    },
    {
      id: "sato_h",
      staff: {
        lastName: "佐藤",
        firstName: "花子",
        firstInitial: "H",
        active: true,
        breakPattern: "15_30",
        shiftCodeDefault: "D",
        workTypeDefault: "D",
      },
    },
    {
      id: "suzuki_m",
      staff: {
        lastName: "鈴木",
        firstName: "美咲",
        firstInitial: "M",
        active: true,
        breakPattern: "30_30",
        shiftCodeDefault: "B",
        workTypeDefault: "B",
      },
    },
    {
      id: "tanaka_k",
      staff: {
        lastName: "田中",
        firstName: "健",
        firstInitial: "K",
        active: true,
        breakPattern: "15_30",
        shiftCodeDefault: "E",
        workTypeDefault: "E",
      },
    },
  ];

  const batch = writeBatch(tenantDocRef(args.tenantId).firestore);
  for (const s of samples) {
    batch.set(staffDocRef(args.tenantId, s.id), {
      ...s.staff,
      createdAt: Timestamp.now() as unknown,
      updatedAt: Timestamp.now() as unknown,
    });
    batch.set(assignmentDocRef(args.tenantId, args.date, s.id), {
      areaId: "free",
      version: 1,
      updatedAt: Timestamp.now() as unknown,
    });

    const code = s.staff.shiftCodeDefault || s.staff.workTypeDefault || "C";
    const times = codeToTimes(code, s.staff);
    const shift: Shift = {
      startAt: Timestamp.fromDate(dateAtLocal(args.date, times.start)) as unknown,
      endAt: Timestamp.fromDate(dateAtLocal(args.date, times.end)) as unknown,
      workType: code,
      breakSlots: breakSlotsFor(s.staff),
      source: "seed",
    };
    batch.set(shiftDocRef(args.tenantId, args.date, s.id), shift);
  }
  await batch.commit();
  return { created: samples.length };
}

