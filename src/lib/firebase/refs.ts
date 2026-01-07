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

export function staffColRef(tenantId: string) {
  return collection(getFirestoreDb(), "tenants", tenantId, "staff");
}

export function staffDocRef(tenantId: string, staffId: string) {
  return doc(getFirestoreDb(), "tenants", tenantId, "staff", staffId);
}

export function dayStateDocRef(tenantId: string, date: string) {
  return doc(getFirestoreDb(), "tenants", tenantId, "days", date, "state");
}

export function assignmentsColRef(tenantId: string, date: string) {
  return collection(getFirestoreDb(), "tenants", tenantId, "days", date, "assignments");
}

export function assignmentDocRef(tenantId: string, date: string, staffId: string) {
  return doc(getFirestoreDb(), "tenants", tenantId, "days", date, "assignments", staffId);
}

