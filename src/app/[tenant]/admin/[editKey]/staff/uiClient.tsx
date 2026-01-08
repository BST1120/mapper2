"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { serverTimestamp, setDoc } from "firebase/firestore";

import { staffDocRef } from "@/lib/firebase/refs";
import { useShiftTypes, useStaff } from "@/lib/firebase/hooks";
import { buildDisplayName, normalizeInitial } from "@/lib/staff/displayName";
import type { Staff } from "@/lib/firebase/schema";

export function AdminStaffClient() {
  const params = useParams<{ tenant: string; editKey: string }>();
  const tenantId = params.tenant;

  const { staffById, error: staffError } = useStaff(tenantId);
  const { shiftTypesByCode, error: stError } = useShiftTypes(tenantId);
  const error = staffError || stError;

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [firstInitial, setFirstInitial] = useState("");
  const [breakPattern, setBreakPattern] = useState<Staff["breakPattern"]>("30_30");
  const [shiftCodeDefault, setShiftCodeDefault] = useState("C");
  const [shiftMode, setShiftMode] = useState<NonNullable<Staff["shiftMode"]>>("variable");
  const [showOnMapper, setShowOnMapper] = useState(true);
  const [showOnTimeline, setShowOnTimeline] = useState(true);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const shiftCodes = useMemo(() => {
    if (!shiftTypesByCode) return [];
    return Object.values(shiftTypesByCode)
      .sort((a, b) => a.order - b.order)
      .map((s) => s.code);
  }, [shiftTypesByCode]);

  const list = useMemo(() => {
    if (!staffById) return null;
    return Object.entries(staffById)
      .map(([id, s]) => ({ id, staff: s }))
      .sort((a, b) =>
        buildDisplayName(a.staff).localeCompare(buildDisplayName(b.staff), "ja"),
      );
  }, [staffById]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!list || !shiftTypesByCode)
    return <div className="rounded-xl border bg-white p-4 text-sm text-zinc-600">読み込み中…</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium">新規追加</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-xs text-zinc-600">苗字</span>
            <input className="rounded-lg border px-3 py-2" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-zinc-600">名前</span>
            <input className="rounded-lg border px-3 py-2" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-zinc-600">名の頭文字（ローマ字1文字）</span>
            <input className="rounded-lg border px-3 py-2" value={firstInitial} onChange={(e) => setFirstInitial(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-zinc-600">休憩パターン</span>
            <select className="rounded-lg border px-3 py-2" value={breakPattern} onChange={(e) => setBreakPattern(e.target.value as Staff["breakPattern"])}>
              <option value="15_30">15+30</option>
              <option value="30_30">30+30</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-zinc-600">勤務形態コード</span>
            <select className="rounded-lg border px-3 py-2" value={shiftCodeDefault} onChange={(e) => setShiftCodeDefault(e.target.value)}>
              {shiftCodes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-zinc-600">勤務モード</span>
            <select
              className="rounded-lg border px-3 py-2"
              value={shiftMode}
              onChange={(e) => setShiftMode(e.target.value as NonNullable<Staff["shiftMode"]>)}
            >
              <option value="variable">正職（Excelコードで可変）</option>
              <option value="fixed">固定（毎回同じ）</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={showOnMapper} onChange={(e) => setShowOnMapper(e.target.checked)} />
            マッパーに表示
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={showOnTimeline} onChange={(e) => setShowOnTimeline(e.target.checked)} />
            タイムバーに表示
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={busy || !lastName.trim()}
            onClick={async () => {
              setBusy(true);
              setStatus("");
              try {
                const init = normalizeInitial(firstInitial);
                const docId = `${lastName.trim()}_${init || "X"}_${Date.now()}`;
                const staff: Staff = {
                  lastName: lastName.trim(),
                  firstName: firstName.trim(),
                  firstInitial: init || "X",
                  active: true,
                  breakPattern,
                  shiftMode,
                  shiftCodeDefault,
                  showOnMapper,
                  showOnTimeline,
                  createdAt: serverTimestamp() as unknown,
                  updatedAt: serverTimestamp() as unknown,
                };
                await setDoc(staffDocRef(tenantId, docId), staff);
                setStatus("追加しました。");
                setLastName("");
                setFirstName("");
                setFirstInitial("");
              } catch (e: unknown) {
                setStatus(e instanceof Error ? e.message : "追加に失敗しました。");
              } finally {
                setBusy(false);
              }
            }}
          >
            追加
          </button>
          {status ? <span className="text-sm text-zinc-700">{status}</span> : null}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium">一覧</div>
        <div className="mt-2 overflow-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                <th className="p-2 text-left">表示名</th>
                <th className="p-2 text-left">勤務モード</th>
                <th className="p-2 text-left">勤務形態</th>
                <th className="p-2 text-left">休憩</th>
                <th className="p-2 text-left">表示</th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ id, staff }) => (
                <tr key={id} className="border-t">
                  <td className="p-2 font-medium">{buildDisplayName(staff)}</td>
                  <td className="p-2">
                    <select
                      className="rounded-lg border px-2 py-1"
                      value={staff.shiftMode ?? "variable"}
                      onChange={async (e) => {
                        const next = e.target.value as NonNullable<Staff["shiftMode"]>;
                        await setDoc(
                          staffDocRef(tenantId, id),
                          { shiftMode: next, updatedAt: serverTimestamp() as unknown },
                          { merge: true },
                        );
                      }}
                    >
                      <option value="variable">正職（可変）</option>
                      <option value="fixed">固定</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      className="rounded-lg border px-2 py-1"
                      value={staff.shiftCodeDefault || staff.workTypeDefault || "C"}
                      onChange={async (e) => {
                        const next = e.target.value;
                        await setDoc(
                          staffDocRef(tenantId, id),
                          { shiftCodeDefault: next, updatedAt: serverTimestamp() as unknown },
                          { merge: true },
                        );
                      }}
                    >
                      {shiftCodes.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      className="rounded-lg border px-2 py-1"
                      value={staff.breakPattern}
                      onChange={async (e) => {
                        const next = e.target.value as Staff["breakPattern"];
                        await setDoc(
                          staffDocRef(tenantId, id),
                          { breakPattern: next, updatedAt: serverTimestamp() as unknown },
                          { merge: true },
                        );
                      }}
                    >
                      <option value="15_30">15+30</option>
                      <option value="30_30">30+30</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <label className="mr-3 inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={staff.showOnMapper !== false}
                        onChange={async (e) => {
                          await setDoc(
                            staffDocRef(tenantId, id),
                            { showOnMapper: e.target.checked, updatedAt: serverTimestamp() as unknown },
                            { merge: true },
                          );
                        }}
                      />
                      マッパー
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={staff.showOnTimeline !== false}
                        onChange={async (e) => {
                          await setDoc(
                            staffDocRef(tenantId, id),
                            { showOnTimeline: e.target.checked, updatedAt: serverTimestamp() as unknown },
                            { merge: true },
                          );
                        }}
                      />
                      タイムバー
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          ※ 勤務形態マスタが未作成だと選択肢が出ません（設定→「勤務形態マスタを作成/更新」）。
        </div>
      </div>
    </div>
  );
}

