"use client";

import type { Area as AreaDoc } from "@/lib/firebase/schema";
import type { Assignment, Staff } from "@/lib/firebase/schema";
import { buildDisplayName } from "@/lib/staff/displayName";
import { ensureAnonymousAuth } from "@/lib/firebase/client";
import { assignmentDocRef, dayStateDocRef } from "@/lib/firebase/refs";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

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

type MapperGridProps = {
  mode: "viewer" | "admin";
  tenantId: string;
  date: string;
  areasById?: Record<string, AreaDoc> | null;
  staffById: Record<string, Staff>;
  assignmentsByStaffId: Record<string, Assignment>;
  editLocked: boolean;
};

function StaffChip({ staff }: { staff: Staff }) {
  const name = buildDisplayName(staff);
  return (
    <div className="rounded-lg border bg-white px-2 py-1 text-center text-xs">
      <div className="font-medium leading-4">{name}</div>
    </div>
  );
}

function areaNameFrom(areasById: Record<string, AreaDoc> | null | undefined, slot: AreaSlot) {
  return areasById?.[slot.id]?.name ?? slot.fallbackName;
}

function DraggableStaff({
  staffId,
  staff,
  enabled,
}: {
  staffId: string;
  staff: Staff;
  enabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: staffId,
      disabled: !enabled,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        enabled ? "cursor-grab active:cursor-grabbing touch-none" : "",
        isDragging ? "opacity-40" : "",
      ].join(" ")}
      {...attributes}
      {...listeners}
    >
      <StaffChip staff={staff} />
    </div>
  );
}

function DroppableArea({
  areaId,
  title,
  count,
  disabled,
  children,
}: {
  areaId: string;
  title: string;
  count: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: areaId, disabled });
  return (
    <section
      ref={setNodeRef}
      className={[
        "rounded-xl border bg-white p-3",
        isOver && !disabled ? "ring-2 ring-emerald-400" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-zinc-500">{count}名</div>
      </div>
      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2">
        {children}
      </div>
    </section>
  );
}

export function MapperGrid({
  mode,
  tenantId,
  date,
  areasById,
  staffById,
  assignmentsByStaffId,
  editLocked,
}: MapperGridProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const staffByAreaId = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [staffId] of Object.entries(staffById)) {
      const a = assignmentsByStaffId[staffId];
      const areaId = a?.areaId ?? "free";
      map[areaId] ??= [];
      map[areaId].push(staffId);
    }
    // stable display
    for (const areaId of Object.keys(map)) {
      map[areaId].sort((a, b) => {
        const sa = staffById[a]!;
        const sb = staffById[b]!;
        const da = buildDisplayName(sa);
        const dbn = buildDisplayName(sb);
        return da.localeCompare(dbn, "ja");
      });
    }
    return map;
  }, [assignmentsByStaffId, staffById]);

  const canEdit = mode === "admin" && !editLocked;

  async function moveStaff(staffId: string, toAreaId: string) {
    await ensureAnonymousAuth();
    setBanner(null);
    const expectedVersion = assignmentsByStaffId[staffId]?.version ?? 0;
    const ref = assignmentDocRef(tenantId, date, staffId);

    try {
      await runTransaction(ref.firestore, async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists() ? (snap.data() as Assignment) : null;
        const currentVersion = current?.version ?? 0;
        if (snap.exists() && currentVersion !== expectedVersion) {
          throw new Error("CONFLICT");
        }
        const nextVersion = currentVersion + 1;
        if (!snap.exists()) {
          tx.set(ref, {
            areaId: toAreaId,
            version: nextVersion,
            updatedAt: serverTimestamp() as unknown,
          });
        } else {
          tx.update(ref, {
            areaId: toAreaId,
            version: nextVersion,
            updatedAt: serverTimestamp() as unknown,
          });
        }
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "CONFLICT") {
        setBanner("競合: 他の端末が先に同じ職員を動かしました。最新の配置に更新しました。");
      } else {
        setBanner(e instanceof Error ? e.message : "移動に失敗しました。");
      }
    }
  }

  async function toggleLock(next: boolean) {
    await ensureAnonymousAuth();
    const ref = dayStateDocRef(tenantId, date);
    // Ensure doc exists
    await setDoc(ref, { editLocked: next }, { merge: true });
    await updateDoc(ref, {
      editLocked: next,
      lockedAt: serverTimestamp() as unknown,
    });
  }

  return (
    <div className="space-y-3">
      {mode === "admin" ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-zinc-600">
            状態:{" "}
            {editLocked ? (
              <span className="font-medium text-amber-700">ロック中（編集不可）</span>
            ) : (
              <span className="font-medium text-emerald-700">編集可</span>
            )}
          </div>
          <button
            className="rounded-full border bg-white px-3 py-1 text-sm hover:bg-zinc-50"
            onClick={() => toggleLock(!editLocked)}
          >
            {editLocked ? "ロック解除" : "ロックする"}
          </button>
          <div className="text-xs text-zinc-500">日付: {date}</div>
        </div>
      ) : (
        <div className="text-xs text-zinc-500">日付: {date}</div>
      )}

      {banner ? (
        <div className="rounded-xl border bg-amber-50 p-3 text-sm text-amber-900">
          {banner}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* main grid */}
        <div className="rounded-2xl border bg-zinc-50 p-3">
          <DndContext
            sensors={sensors}
            onDragStart={(e: DragStartEvent) => {
              setActiveStaffId(String(e.active.id));
            }}
            onDragEnd={async (e: DragEndEvent) => {
              setActiveStaffId(null);
              if (!canEdit) return;
              const staffId = String(e.active.id);
              const overId = e.over?.id ? String(e.over.id) : null;
              if (!overId) return;
              await moveStaff(staffId, overId);
            }}
          >
            <div className="grid grid-cols-6 gap-3">
              {topRow.map((slot) => (
                <div key={slot.id} className="col-span-1">
                  <DroppableArea
                    areaId={slot.id}
                    title={areaNameFrom(areasById ?? null, slot)}
                    count={(staffByAreaId[slot.id] ?? []).length}
                    disabled={!canEdit}
                  >
                    {(staffByAreaId[slot.id] ?? []).map((staffId) => (
                      <DraggableStaff
                        key={staffId}
                        staffId={staffId}
                        staff={staffById[staffId]!}
                        enabled={canEdit}
                      />
                    ))}
                  </DroppableArea>
                </div>
              ))}

              {midRow.map((slot) => (
                <div key={slot.id} className={spanClass(slot.span)}>
                  <DroppableArea
                    areaId={slot.id}
                    title={areaNameFrom(areasById ?? null, slot)}
                    count={(staffByAreaId[slot.id] ?? []).length}
                    disabled={!canEdit}
                  >
                    {(staffByAreaId[slot.id] ?? []).map((staffId) => (
                      <DraggableStaff
                        key={staffId}
                        staffId={staffId}
                        staff={staffById[staffId]!}
                        enabled={canEdit}
                      />
                    ))}
                  </DroppableArea>
                </div>
              ))}

              <div className={spanClass(bottomRow.span)}>
                <DroppableArea
                  areaId={bottomRow.id}
                  title={areaNameFrom(areasById ?? null, bottomRow)}
                  count={(staffByAreaId[bottomRow.id] ?? []).length}
                  disabled={!canEdit}
                >
                  {(staffByAreaId[bottomRow.id] ?? []).map((staffId) => (
                    <DraggableStaff
                      key={staffId}
                      staffId={staffId}
                      staff={staffById[staffId]!}
                      enabled={canEdit}
                    />
                  ))}
                </DroppableArea>
              </div>
            </div>

            <DragOverlay>
              {activeStaffId ? (
                <div className="opacity-90">
                  <StaffChip staff={staffById[activeStaffId]!} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* right side */}
        <div className="space-y-3">
          <DroppableArea
            areaId="free"
            title="フリー"
            count={(staffByAreaId["free"] ?? []).length}
            disabled={!canEdit}
          >
            {(staffByAreaId["free"] ?? []).map((staffId) => (
              <DraggableStaff
                key={staffId}
                staffId={staffId}
                staff={staffById[staffId]!}
                enabled={canEdit}
              />
            ))}
          </DroppableArea>

          <DroppableArea
            areaId="break"
            title="休憩"
            count={(staffByAreaId["break"] ?? []).length}
            disabled={!canEdit}
          >
            {(staffByAreaId["break"] ?? []).map((staffId) => (
              <DraggableStaff
                key={staffId}
                staffId={staffId}
                staff={staffById[staffId]!}
                enabled={canEdit}
              />
            ))}
          </DroppableArea>
        </div>
      </div>
    </div>
  );
}

export function MapperGridSkeleton() {
  return (
    <div className="rounded-2xl border bg-zinc-50 p-3 text-sm text-zinc-600">
      読み込み中…
    </div>
  );
}

