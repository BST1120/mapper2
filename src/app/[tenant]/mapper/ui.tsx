"use client";

import type { Area as AreaDoc } from "@/lib/firebase/schema";
import type { Assignment, Shift, Staff } from "@/lib/firebase/schema";
import { buildDisplayName } from "@/lib/staff/displayName";
import { ensureAnonymousAuth } from "@/lib/firebase/client";
import {
  assignmentDocRef,
  auditLogsColRef,
  dayStateDocRef,
  shiftDocRef,
} from "@/lib/firebase/refs";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import {
  addDoc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

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
  shiftsByStaffId: Record<string, Shift>;
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
  chipClassName,
  badge,
  onClick,
}: {
  staffId: string;
  staff: Staff;
  enabled: boolean;
  chipClassName?: string;
  badge?: string | null;
  onClick?: () => void;
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
      <div onClick={onClick} className="select-none">
        <div className={["relative", chipClassName ?? ""].join(" ")}>
          <StaffChip staff={staff} />
          {badge ? (
            <div className="absolute -top-2 -right-2 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {badge}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DroppableArea({
  areaId,
  title,
  count,
  countLabel,
  disabled,
  children,
  size = "md",
}: {
  areaId: string;
  title: string;
  count: number;
  countLabel?: string;
  disabled: boolean;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const { setNodeRef, isOver } = useDroppable({ id: areaId, disabled });

  const bodyHeightClass = (() => {
    switch (size) {
      case "sm":
        return "max-h-20"; // ~80px
      case "md":
        return "max-h-28"; // ~112px
      case "lg":
        return "max-h-36"; // ~144px
      case "xl":
        return "max-h-52"; // ~208px
      default:
        return "max-h-28";
    }
  })();

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
        <div className="text-xs text-zinc-500">{countLabel ?? `${count}名`}</div>
      </div>
      <div
        className={[
          "mt-2 grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2",
          bodyHeightClass,
          "overflow-auto overscroll-contain pr-1",
        ].join(" ")}
      >
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
  shiftsByStaffId,
  editLocked,
}: MapperGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // iPad/Safari向け
    useSensor(TouchSensor, {
      // long-pressが苦手な場合が多いので「一定距離動かす」で開始
      activationConstraint: { distance: 8 },
    }),
  );
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [showAbsent, setShowAbsent] = useState(false);

  const staffByAreaId = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [staffId] of Object.entries(staffById)) {
      const shift = shiftsByStaffId[staffId];
      // その日シフトが無い職員は表示しない（当日出勤者のみ）
      if (!shift) continue;
      if (shift.absent && !showAbsent) continue;
      const staff = staffById[staffId];
      if (staff?.showOnMapper === false) continue;
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
  }, [assignmentsByStaffId, staffById, shiftsByStaffId, showAbsent]);

  const canEdit = mode === "admin" && !editLocked;
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  function getBreakBadge(staffId: string): string | null {
    const shift = shiftsByStaffId[staffId];
    if (!shift?.breakSlots?.length) return null;
    const remaining = shift.breakSlots.filter((s) => !s.used).length;
    return `休${remaining}`;
  }

  function isAbsent(staffId: string): boolean {
    return Boolean(shiftsByStaffId[staffId]?.absent);
  }

  function getChipBadge(staffId: string): string | null {
    if (isAbsent(staffId)) return "欠";
    return getBreakBadge(staffId);
  }

  function countLabelFor(areaId: string) {
    const ids = staffByAreaId[areaId] ?? [];
    const absent = ids.filter((id) => isAbsent(id)).length;
    const present = ids.length - absent;
    return absent > 0 ? `${present}名(+欠${absent})` : `${present}名`;
  }

  function isShiftEnded(staffId: string): boolean {
    const shift = shiftsByStaffId[staffId];
    const endAt = shift?.endAt as unknown as Timestamp | undefined;
    if (!endAt?.toDate) return false;
    return Date.now() > endAt.toDate().getTime();
  }

  function getShiftTimeLabel(staffId: string): string | null {
    const shift = shiftsByStaffId[staffId];
    const s = shift?.startAt as unknown as Timestamp | undefined;
    const e = shift?.endAt as unknown as Timestamp | undefined;
    if (!s?.toDate || !e?.toDate) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    const sd = s.toDate();
    const ed = e.toDate();
    return `${pad(sd.getHours())}:${pad(sd.getMinutes())}〜${pad(ed.getHours())}:${pad(ed.getMinutes())}`;
  }

  async function setAbsent(staffId: string, absent: boolean) {
    if (!canEdit) return;
    await ensureAnonymousAuth();
    setBanner(null);

    const ref = shiftDocRef(tenantId, date, staffId);
    await setDoc(ref, { absent }, { merge: true });

    if (absent) {
      // 欠勤にする場合は、配置をフリーへ戻す（MVP）
      await moveStaff(staffId, "free");
    }
  }

  async function startNextBreak(staffId: string) {
    if (!canEdit) return;
    await ensureAnonymousAuth();
    setBanner(null);

    const shiftRef = shiftDocRef(tenantId, date, staffId);
    const shiftSnap = await getDoc(shiftRef);
    if (!shiftSnap.exists()) {
      setBanner("勤務データがありません（shifts）。");
      return;
    }
    const shift = shiftSnap.data() as Shift;
    const endAt = shift.endAt as unknown as Timestamp;
    const endMs = endAt?.toDate?.().getTime?.();
    if (!endMs) {
      setBanner("勤務終了時刻が不正です。");
      return;
    }
    const now = Date.now();
    if (now > endMs - 30 * 60 * 1000) {
      setBanner("退勤30分前以降は休憩を開始できません。");
      return;
    }

    const slots = shift.breakSlots ?? [];
    const idx = slots.findIndex((s) => !s.used);
    if (idx === -1) {
      setBanner("休憩枠が残っていません。");
      return;
    }
    const minutes = slots[idx]!.minutes;

    // Update shift slot + move to break area (best-effort conflict handling)
    await runTransaction(shiftRef.firestore, async (tx) => {
      const snap = await tx.get(shiftRef);
      const cur = snap.data() as Shift | undefined;
      if (!cur) throw new Error("SHIFT_MISSING");
      const nextSlots = [...(cur.breakSlots ?? [])];
      const i = nextSlots.findIndex((s) => !s.used);
      if (i === -1) throw new Error("NO_SLOT");
      nextSlots[i] = {
        ...nextSlots[i]!,
        used: true,
        startedAt: serverTimestamp() as unknown,
      };
      tx.update(shiftRef, { breakSlots: nextSlots });
    });

    // Move to break area using existing move logic (will add audit log)
    await moveStaff(staffId, "break");
    void addDoc(auditLogsColRef(tenantId, date), {
      timestamp: serverTimestamp() as unknown,
      type: "break_start",
      staffId,
      minutes,
    });
  }

  async function endBreak(staffId: string) {
    if (!canEdit) return;
    await ensureAnonymousAuth();
    setBanner(null);

    const shiftRef = shiftDocRef(tenantId, date, staffId);
    try {
      await runTransaction(shiftRef.firestore, async (tx) => {
        const snap = await tx.get(shiftRef);
        const cur = snap.data() as Shift | undefined;
        if (!cur) throw new Error("SHIFT_MISSING");
        const slots = [...(cur.breakSlots ?? [])];
        const idx = slots.findIndex((s) => s.used && !s.endedAt);
        if (idx === -1) return; // nothing to end
        slots[idx] = { ...slots[idx]!, endedAt: serverTimestamp() as unknown };
        tx.update(shiftRef, { breakSlots: slots });
      });
    } catch (e: unknown) {
      setBanner(e instanceof Error ? e.message : "休憩終了に失敗しました。");
      return;
    }

    // Move back to free (MVP)
    await moveStaff(staffId, "free");
    void addDoc(auditLogsColRef(tenantId, date), {
      timestamp: serverTimestamp() as unknown,
      type: "break_end",
      staffId,
    });
  }

  async function moveStaff(staffId: string, toAreaId: string) {
    await ensureAnonymousAuth();
    setBanner(null);
    const expectedVersion = assignmentsByStaffId[staffId]?.version ?? 0;
    const ref = assignmentDocRef(tenantId, date, staffId);
    const fromAreaId = assignmentsByStaffId[staffId]?.areaId ?? "free";

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

      // Best-effort audit log (no need to block UI)
      void addDoc(auditLogsColRef(tenantId, date), {
        timestamp: serverTimestamp() as unknown,
        type: "move",
        staffId,
        fromAreaId,
        toAreaId,
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

    void addDoc(auditLogsColRef(tenantId, date), {
      timestamp: serverTimestamp() as unknown,
      type: next ? "lock" : "unlock",
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
          <label className="ml-2 inline-flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={showAbsent}
              onChange={(e) => setShowAbsent(e.target.checked)}
            />
            欠勤/休みも表示
          </label>
          {selectedStaffId ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="text-sm text-zinc-600">
                選択:{" "}
                <span className="font-medium">
                  {buildDisplayName(staffById[selectedStaffId]!)}
                </span>
                <span className="ml-2 text-xs text-zinc-500">
                  {getShiftTimeLabel(selectedStaffId) ?? "（勤務未設定）"}
                  {isAbsent(selectedStaffId)
                    ? "・欠勤"
                    : isShiftEnded(selectedStaffId)
                      ? "・勤務終了"
                      : "・勤務中"}
                </span>
              </div>
              <div className="text-xs text-zinc-500">
                D&Dできない時: ロック解除＋少し動かしてドラッグ（iPadは指を動かす）
              </div>
              <button
                className="rounded-full border bg-white px-3 py-1 text-sm hover:bg-zinc-50 disabled:opacity-50"
                disabled={!canEdit}
                onClick={() => void startNextBreak(selectedStaffId)}
              >
                休憩開始（次枠）
              </button>
              <button
                className="rounded-full border bg-white px-3 py-1 text-sm hover:bg-zinc-50 disabled:opacity-50"
                disabled={!canEdit}
                onClick={() => void endBreak(selectedStaffId)}
              >
                休憩終了
              </button>
              <button
                className="rounded-full border bg-white px-3 py-1 text-sm hover:bg-zinc-50 disabled:opacity-50"
                disabled={!canEdit}
                onClick={() => void setAbsent(selectedStaffId, !isAbsent(selectedStaffId))}
              >
                {isAbsent(selectedStaffId) ? "欠勤解除" : "欠勤にする"}
              </button>
              <button
                className="rounded-full border bg-white px-3 py-1 text-sm hover:bg-zinc-50"
                onClick={() => setSelectedStaffId(null)}
              >
                選択解除
              </button>
            </div>
          ) : null}
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
                    countLabel={countLabelFor(slot.id)}
                    disabled={!canEdit}
                    size="sm"
                  >
                    {(staffByAreaId[slot.id] ?? []).map((staffId) => (
                      <DraggableStaff
                        key={staffId}
                        staffId={staffId}
                        staff={staffById[staffId]!}
                        enabled={canEdit && !isAbsent(staffId)}
                        badge={getChipBadge(staffId)}
                        chipClassName={[
                          isShiftEnded(staffId) ? "opacity-40 grayscale" : "",
                          isAbsent(staffId) ? "opacity-40 grayscale" : "",
                        ].join(" ")}
                        onClick={() => canEdit && setSelectedStaffId(staffId)}
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
                    countLabel={countLabelFor(slot.id)}
                    disabled={!canEdit}
                    size="md"
                  >
                    {(staffByAreaId[slot.id] ?? []).map((staffId) => (
                      <DraggableStaff
                        key={staffId}
                        staffId={staffId}
                        staff={staffById[staffId]!}
                        enabled={canEdit && !isAbsent(staffId)}
                        badge={getChipBadge(staffId)}
                        chipClassName={[
                          isShiftEnded(staffId) ? "opacity-40 grayscale" : "",
                          isAbsent(staffId) ? "opacity-40 grayscale" : "",
                        ].join(" ")}
                        onClick={() => canEdit && setSelectedStaffId(staffId)}
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
                  countLabel={countLabelFor(bottomRow.id)}
                  disabled={!canEdit}
                  size="lg"
                >
                  {(staffByAreaId[bottomRow.id] ?? []).map((staffId) => (
                    <DraggableStaff
                      key={staffId}
                      staffId={staffId}
                      staff={staffById[staffId]!}
                      enabled={canEdit && !isAbsent(staffId)}
                      badge={getChipBadge(staffId)}
                      chipClassName={[
                        isShiftEnded(staffId) ? "opacity-40 grayscale" : "",
                        isAbsent(staffId) ? "opacity-40 grayscale" : "",
                      ].join(" ")}
                      onClick={() => canEdit && setSelectedStaffId(staffId)}
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
            countLabel={countLabelFor("free")}
            disabled={!canEdit}
            size="xl"
          >
            {(staffByAreaId["free"] ?? []).map((staffId) => (
              <DraggableStaff
                key={staffId}
                staffId={staffId}
                staff={staffById[staffId]!}
                enabled={canEdit && !isAbsent(staffId)}
                badge={getChipBadge(staffId)}
                chipClassName={[
                  isShiftEnded(staffId) ? "opacity-40 grayscale" : "",
                  isAbsent(staffId) ? "opacity-40 grayscale" : "",
                ].join(" ")}
                onClick={() => canEdit && setSelectedStaffId(staffId)}
              />
            ))}
          </DroppableArea>

          <DroppableArea
            areaId="break"
            title="休憩"
            count={(staffByAreaId["break"] ?? []).length}
            countLabel={countLabelFor("break")}
            disabled={!canEdit}
            size="xl"
          >
            {(staffByAreaId["break"] ?? []).map((staffId) => (
              <DraggableStaff
                key={staffId}
                staffId={staffId}
                staff={staffById[staffId]!}
                enabled={canEdit && !isAbsent(staffId)}
                badge={getChipBadge(staffId)}
                chipClassName={[
                  isShiftEnded(staffId) ? "opacity-40 grayscale" : "",
                  isAbsent(staffId) ? "opacity-40 grayscale" : "",
                ].join(" ")}
                onClick={() => canEdit && setSelectedStaffId(staffId)}
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

