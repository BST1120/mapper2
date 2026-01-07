import type { ShiftType } from "@/lib/firebase/schema";

export const DEFAULT_SHIFT_TYPES: ShiftType[] = [
  { code: "A", start: "07:00", end: "16:00", order: 10 },
  { code: "B", start: "07:30", end: "16:30", order: 20 },
  { code: "C", start: "08:00", end: "17:00", order: 30 },
  { code: "D", start: "08:30", end: "17:30", order: 40 },
  { code: "E", start: "09:00", end: "18:00", order: 50 },
  { code: "F", start: "10:00", end: "19:00", order: 60 },
  { code: "G", start: "08:30", end: "16:45", order: 70 },
  { code: "H", start: "08:45", end: "17:45", order: 80 },
  { code: "I", start: "09:15", end: "16:00", order: 90 },
  { code: "J", start: "12:45", end: "18:30", order: 100 },
  { code: "K", start: "09:00", end: "15:45", order: 110 },
  { code: "L", start: "15:00", end: "18:00", order: 120 },
  { code: "M", start: "08:30", end: "15:15", order: 130 },
  { code: "G1", start: "09:15", end: "16:30", order: 140 },
  { code: "H1", start: "09:00", end: "17:00", order: 150 },
  { code: "I1", start: "09:15", end: "15:00", order: 160 },
  { code: "K1", start: "10:00", end: "14:30", order: 170 },
  { code: "L1", start: "14:00", end: "18:00", order: 180 },
  { code: "D1", start: "08:30", end: "17:00", order: 190 }
];

