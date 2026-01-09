import type { TimelineSlot } from "@/lib/timeline/slots";

export type UnderstaffedRange = { start: string; end: string };

export function computeUnderstaffedRanges(args: {
  slots: TimelineSlot[];
  counts: number[];
  threshold: number;
}): UnderstaffedRange[] {
  const { slots, counts, threshold } = args;
  if (threshold <= 0) return [];
  const ranges: UnderstaffedRange[] = [];

  let startIdx: number | null = null;
  // counts length should equal slots length. The last slot (19:00) is just a label.
  const lastIntervalIdx = Math.min(counts.length, slots.length) - 2;
  for (let i = 0; i <= lastIntervalIdx; i++) {
    const c = counts[i] ?? 0;
    const isLow = c < threshold;
    if (isLow && startIdx == null) startIdx = i;
    if (!isLow && startIdx != null) {
      ranges.push({ start: slots[startIdx]!.label, end: slots[i]!.label });
      startIdx = null;
    }
  }
  if (startIdx != null) {
    const endLabel = slots[lastIntervalIdx + 1]?.label ?? slots[slots.length - 1]!.label;
    ranges.push({ start: slots[startIdx]!.label, end: endLabel });
  }
  return ranges;
}

export function formatUnderstaffedLabel(ranges: UnderstaffedRange[], maxParts = 2): string {
  if (!ranges.length) return "なし";
  return ranges
    .slice(0, maxParts)
    .map((r) => `${r.start}〜${r.end}`)
    .join(" / ");
}

