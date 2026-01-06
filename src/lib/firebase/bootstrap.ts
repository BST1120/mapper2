"use client";

import { writeBatch, serverTimestamp, getDoc } from "firebase/firestore";

import { DEFAULT_AREAS } from "@/lib/defaults/areas";
import { ensureAnonymousAuth } from "@/lib/firebase/client";
import { areaDocRef, tenantDocRef } from "@/lib/firebase/refs";
import type { Tenant } from "@/lib/firebase/schema";

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

