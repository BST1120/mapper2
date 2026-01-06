"use client";

import type { Area as AreaDoc } from "@/lib/firebase/schema";

type AreaSlot = { id: string; fallbackName: string; span?: number };

const topRow: AreaSlot[] = [
  { id: "saru", fallbackName: "さる" },
  { id: "hebi", fallbackName: "へび" },
  { id: "lunch", fallbackName: "ランチ" },
  { id: "usagi", fallbackName: "うさぎ" },
  { id: "tora", fallbackName: "とら" },
  { id: "nezumi", fallbackName: "ねずみ" },
];

const midRow: AreaSlot[] = [
  { id: "yard_older", fallbackName: "以上児園庭", span: 2 },
  { id: "office", fallbackName: "事務室", span: 2 },
  { id: "yard_younger", fallbackName: "未満児園庭", span: 2 },
];

const bottomRow: AreaSlot = { id: "yard", fallbackName: "園庭（広い）", span: 6 };

function spanClass(span: number | undefined) {
  switch (span) {
    case 1:
      return "col-span-1";
    case 2:
      return "col-span-2";
    case 3:
      return "col-span-3";
    case 4:
      return "col-span-4";
    case 5:
      return "col-span-5";
    case 6:
    default:
      return "col-span-6";
  }
}

function AreaCard({
  area,
  areasById,
}: {
  area: AreaSlot;
  areasById?: Record<string, AreaDoc> | null;
}) {
  const name = areasById?.[area.id]?.name ?? area.fallbackName;
  return (
    <section className="rounded-xl border bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">{name}</div>
        <div className="text-xs text-zinc-500">0名</div>
      </div>
      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2">
        {/* placeholder for staff icons (grid aligned) */}
        <div className="rounded-lg border border-dashed p-2 text-center text-xs text-zinc-500">
          ここに職員
        </div>
      </div>
    </section>
  );
}

function SidePanel({ title }: { title: string }) {
  return (
    <section className="rounded-xl border bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-zinc-500">0名</div>
      </div>
      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2">
        <div className="rounded-lg border border-dashed p-2 text-center text-xs text-zinc-500">
          ここに職員
        </div>
      </div>
    </section>
  );
}

export function MapperGrid({
  areasById,
}: {
  areasById?: Record<string, AreaDoc> | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* main grid */}
      <div className="rounded-2xl border bg-zinc-50 p-3">
        <div className="grid grid-cols-6 gap-3">
          {topRow.map((a) => (
            <div key={a.id} className="col-span-1">
              <AreaCard area={a} areasById={areasById} />
            </div>
          ))}

          {midRow.map((a) => (
            <div key={a.id} className={spanClass(a.span)}>
              <AreaCard area={a} areasById={areasById} />
            </div>
          ))}

          <div className={spanClass(bottomRow.span)}>
            <AreaCard area={bottomRow} areasById={areasById} />
          </div>
        </div>
      </div>

      {/* right side */}
      <div className="space-y-3">
        <SidePanel title="フリー" />
        <SidePanel title="休憩" />
      </div>
    </div>
  );
}

