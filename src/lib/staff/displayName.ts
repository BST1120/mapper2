import type { Staff } from "@/lib/firebase/schema";

export function normalizeInitial(value: string): string {
  const trimmed = value.trim().toUpperCase();
  return trimmed.slice(0, 1).replace(/[^A-Z]/g, "");
}

export function buildDisplayName(staff: Pick<Staff, "lastName" | "firstInitial">) {
  const initial = normalizeInitial(staff.firstInitial);
  return initial ? `${staff.lastName}${initial}` : staff.lastName;
}

