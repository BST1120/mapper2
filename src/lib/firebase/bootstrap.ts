"use client";

import { writeBatch, serverTimestamp, getDoc } from "firebase/firestore";

import { DEFAULT_AREAS } from "@/lib/defaults/areas";
import { ensureAnonymousAuth } from "@/lib/firebase/client";
import { areaDocRef, assignmentDocRef, staffDocRef, tenantDocRef } from "@/lib/firebase/refs";
import type { Staff, Tenant } from "@/lib/firebase/schema";

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
  await batch.commit();

  return { created: true as const };
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
        workTypeDefault: "E",
      },
    },
  ];

  const batch = writeBatch(tenantDocRef(args.tenantId).firestore);
  for (const s of samples) {
    batch.set(staffDocRef(args.tenantId, s.id), {
      ...s.staff,
      createdAt: serverTimestamp() as unknown,
      updatedAt: serverTimestamp() as unknown,
    });
    batch.set(assignmentDocRef(args.tenantId, args.date, s.id), {
      areaId: "free",
      version: 1,
      updatedAt: serverTimestamp() as unknown,
    });
  }
  await batch.commit();
  return { created: samples.length };
}

