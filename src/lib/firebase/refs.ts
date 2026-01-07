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
  // Firestore paths must alternate collection/doc segments.
  // We store day state at: tenants/{tenantId}/days/{date}/meta/state
  return doc(getFirestoreDb(), "tenants", tenantId, "days", date, "meta", "state");
}

export function assignmentsColRef(tenantId: string, date: string) {
  return collection(getFirestoreDb(), "tenants", tenantId, "days", date, "assignments");
}

export function assignmentDocRef(tenantId: string, date: string, staffId: string) {
  return doc(getFirestoreDb(), "tenants", tenantId, "days", date, "assignments", staffId);
}

export function auditLogsColRef(tenantId: string, date: string) {
  return collection(getFirestoreDb(), "tenants", tenantId, "days", date, "auditLogs");
}

export function shiftsColRef(tenantId: string, date: string) {
  return collection(getFirestoreDb(), "tenants", tenantId, "days", date, "shifts");
}

export function shiftDocRef(tenantId: string, date: string, staffId: string) {
  return doc(getFirestoreDb(), "tenants", tenantId, "days", date, "shifts", staffId);
}

export function shiftTypesColRef(tenantId: string) {
  return collection(getFirestoreDb(), "tenants", tenantId, "shiftTypes");
}

export function shiftTypeDocRef(tenantId: string, code: string) {
  return doc(getFirestoreDb(), "tenants", tenantId, "shiftTypes", code);
}

