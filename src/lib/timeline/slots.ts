import { dateAtLocal } from "@/lib/date/localTime";

export type TimelineSlot = { t: Date; label: string };

export function makeTimelineSlots(date: string): TimelineSlot[] {
  const out: TimelineSlot[] = [];
  for (let h = 7; h < 19; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      out.push({ t: dateAtLocal(date, `${hh}:${mm}`), label: `${hh}:${mm}` });
    }
  }
  out.push({ t: dateAtLocal(date, "19:00"), label: "19:00" });
  return out;
}

