export type Tenant = {
  name: string;
  timezone: "Asia/Tokyo";
  minStaffThreshold: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ShiftType = {
  code: string; // e.g. A, G1, D1
  start: string; // HH:MM
  end: string; // HH:MM
  order: number;
};

export type AreaType =
  | "room"
  | "outdoor"
  | "admin"
  | "free"
  | "break"
  | "other";

export type Area = {
  name: string;
  order: number;
  type: AreaType;
};

export type Assignment = {
  areaId: string;
  version: number;
  updatedAt?: unknown;
  updatedByUid?: string;
};

export type DayState = {
  editLocked: boolean;
  lockedAt?: unknown;
  lockedByUid?: string;
};

export type AuditLog = {
  timestamp: unknown;
  type: "move" | "lock" | "unlock" | "break_start" | "break_end" | "import";
  staffId?: string;
  fromAreaId?: string;
  toAreaId?: string;
  minutes?: number;
  importedCount?: number;
  uid?: string;
};

export type BreakSlot = {
  minutes: 15 | 30;
  used: boolean;
  startedAt?: unknown;
  endedAt?: unknown;
};

export type Shift = {
  startAt: unknown; // Firestore Timestamp
  endAt: unknown; // Firestore Timestamp
  workType: string; // ShiftType code (A, G1, etc). "fixed" is also allowed.
  breakSlots: BreakSlot[];
  absent?: boolean;
  source: "seed" | "excel" | "manual";
};

export type Staff = {
  lastName: string;
  firstName: string;
  /**
   * 苗字が重複した際の「名の頭文字（ローマ字1文字）」
   * 例: 太郎 -> T, 花子 -> H
   *
   * NOTE: 日本語の名前からローマ字頭文字を自動生成するのは難しいため、
   *       MVPでは入力項目として持たせる。
   */
  firstInitial: string;
  active: boolean;
  breakPattern: "15_30" | "30_30";
  /**
   * 既定の勤務形態コード（ShiftType.code）
   * 例: A, D1, K, L1 ...
   */
  shiftCodeDefault: string;
  /**
   * 旧フィールド（移行用）
   * NOTE: 新規実装では shiftCodeDefault を使用する。
   */
  workTypeDefault?: "A" | "B" | "C" | "D" | "E" | "F" | "fixed";
  fixedStart?: string; // "HH:MM"
  fixedEnd?: string; // "HH:MM"
  createdAt?: unknown;
  updatedAt?: unknown;
};

