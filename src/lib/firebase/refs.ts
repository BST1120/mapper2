import { collection, doc } from "firebase/firestore";

import { getFirestoreDb } from "@/lib/firebase/client";

export function tenantDocRef(tenantId: string) {
  return doc(getFirestoreDb(), "tenants", tenantId);
}

export function areasColRef(tenantId: string) {
  return collection(getFirestoreDb(), "tenants", tenantId, "areas");
}

export function areaDocRef(tenantId: string, areaId: string) {
  return doc(getFirestoreDb(), "tenants", tenantId, "areas", areaId);
}

