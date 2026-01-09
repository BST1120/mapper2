"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { deleteDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";

import { formatDateYYYYMMDD } from "@/lib/date/today";
import { bootstrapTenantAndAreas, seedSampleStaff } from "@/lib/firebase/bootstrap";
import { DEFAULT_SHIFT_TYPES } from "@/lib/defaults/shiftTypes";
import { shiftTypeDocRef, tenantDocRef } from "@/lib/firebase/refs";
import { useShiftTypes } from "@/lib/firebase/hooks";
import type { ShiftType } from "@/lib/firebase/schema";
import { ensureAnonymousAuth } from "@/lib/firebase/client";

function isHHMM(v: string) {
  return /^\d{2}:\d{2}$/.test(v);
}

export function AdminSettingsClient() {
  const params = useParams<{ tenant: string; editKey: string }>();
  const tenantId = params.tenant;
  const date = formatDateYYYYMMDD(new Date());
  const { shiftTypesByCode } = useShiftTypes(tenantId);

  const [tenantName, setTenantName] = useState("iwara");
  const [minStaff, setMinStaff] = useState<number>(0);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const shiftTypesList = useMemo(() => {
    if (!shiftTypesByCode) return null;
    return Object.values(shiftTypesByCode).sort((a, b) => a.order - b.order);
  }, [shiftTypesByCode]);

  const nextOrder = useMemo(() => {
    if (!shiftTypesList?.length) return 10;
    return Math.max(...shiftTypesList.map((s) => s.order ?? 0)) + 10;
  }, [shiftTypesList]);

  const [newCode, setNewCode] = useState("H2");
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("17:00");
  const [newOrder, setNewOrder] = useState<number>(10);

  // Update suggested order when list changes (best-effort)
  useMemo(() => {
    setNewOrder((prev) => (prev ? prev : nextOrder));
  }, [nextOrder]);

  const hint = useMemo(
    () =>
      `この操作は Firestore に tenants/${tenantId} と areas を作成します。`,
    [tenantId],
  );

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm text-zinc-600">{hint}</div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-medium">園名（tenant name）</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">手薄しきい値（最低人数）</span>
          <input
            className="rounded-lg border px-3 py-2"
            type="number"
            value={minStaff}
            onChange={(e) => setMinStaff(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={busy || !tenantName.trim()}
          onClick={async () => {
            setBusy(true);
            setStatus("");
            try {
              const res = await bootstrapTenantAndAreas({
                tenantId,
                tenantName: tenantName.trim(),
                minStaffThreshold: minStaff,
              });
              setStatus(
                res.created
                  ? "初期データを作成しました。"
                  : "既に作成済みのため変更しませんでした。",
              );
            } catch (e: unknown) {
              setStatus(e instanceof Error ? e.message : "Failed to bootstrap.");
            } finally {
              setBusy(false);
            }
          }}
        >
          初期データ作成（テナント＋エリア）
        </button>

        {status ? (
          <span className="text-sm text-zinc-700">{status}</span>
        ) : null}
      </div>

      <div className="mt-6 border-t pt-4">
        <div className="text-sm font-medium">勤務形態マスタ</div>
        <div className="mt-1 text-sm text-zinc-600">
          A〜M / G1等の勤務形態と開始・終了時刻をアプリ内マスタ（Firestore）に作成します。
        </div>
        <div className="mt-3">
          <button
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setStatus("");
              try {
                const store = tenantDocRef(tenantId).firestore;
                const batch = writeBatch(store);
                for (const st of DEFAULT_SHIFT_TYPES) {
                  batch.set(shiftTypeDocRef(tenantId, st.code), st, { merge: true });
                }
                await batch.commit();
                setStatus(`勤務形態マスタを作成/更新しました（${DEFAULT_SHIFT_TYPES.length}件）。`);
              } catch (e: unknown) {
                setStatus(e instanceof Error ? e.message : "Failed to seed shift types.");
              } finally {
                setBusy(false);
              }
            }}
          >
            勤務形態マスタを作成/更新
          </button>
        </div>

        <div className="mt-4 rounded-xl border bg-white p-3">
          <div className="text-sm font-medium">勤務形態の編集（追加/変更/削除）</div>
          <div className="mt-1 text-xs text-zinc-600">
            Excelのコード（例: <strong>H</strong> / <strong>H1</strong>）に対応する勤務時間はここで管理できます。
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <label className="grid gap-1">
              <span className="text-xs text-zinc-600">コード</span>
              <input
                className="rounded-lg border px-2 py-1"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-zinc-600">開始（HH:MM）</span>
              <input
                className="rounded-lg border px-2 py-1"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-zinc-600">終了（HH:MM）</span>
              <input
                className="rounded-lg border px-2 py-1"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-zinc-600">並び順</span>
              <input
                className="rounded-lg border px-2 py-1"
                type="number"
                value={newOrder}
                onChange={(e) => setNewOrder(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={busy || !newCode.trim() || !isHHMM(newStart) || !isHHMM(newEnd)}
              onClick={async () => {
                setBusy(true);
                setStatus("");
                try {
                  await ensureAnonymousAuth();
                  const st: ShiftType = {
                    code: newCode.trim(),
                    start: newStart.trim(),
                    end: newEnd.trim(),
                    order: Number.isFinite(newOrder) ? newOrder : nextOrder,
                  };
                  await setDoc(shiftTypeDocRef(tenantId, st.code), st, { merge: true });
                  setStatus(`勤務形態を追加/更新しました: ${st.code}`);
                } catch (e: unknown) {
                  setStatus(e instanceof Error ? e.message : "Failed to save shift type.");
                } finally {
                  setBusy(false);
                }
              }}
              type="button"
            >
              追加/更新
            </button>
            <span className="text-xs text-zinc-500">
              ※開始/終了は <code>09:00</code> の形式で入力してください。推奨順: {nextOrder}
            </span>
          </div>

          <div className="mt-4 overflow-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  <th className="p-2 text-left">コード</th>
                  <th className="p-2 text-left">開始</th>
                  <th className="p-2 text-left">終了</th>
                  <th className="p-2 text-left">順</th>
                  <th className="p-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {(shiftTypesList ?? []).map((st) => (
                  <tr key={st.code} className="border-t">
                    <td className="p-2 font-medium">{st.code}</td>
                    <td className="p-2">
                      <input
                        className="w-24 rounded-lg border px-2 py-1"
                        defaultValue={st.start}
                        onBlur={async (e) => {
                          const v = e.target.value.trim();
                          if (!isHHMM(v)) return;
                          await updateDoc(shiftTypeDocRef(tenantId, st.code), { start: v });
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="w-24 rounded-lg border px-2 py-1"
                        defaultValue={st.end}
                        onBlur={async (e) => {
                          const v = e.target.value.trim();
                          if (!isHHMM(v)) return;
                          await updateDoc(shiftTypeDocRef(tenantId, st.code), { end: v });
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="w-20 rounded-lg border px-2 py-1"
                        type="number"
                        defaultValue={st.order}
                        onBlur={async (e) => {
                          const v = Number(e.target.value);
                          if (!Number.isFinite(v)) return;
                          await updateDoc(shiftTypeDocRef(tenantId, st.code), { order: v });
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <button
                        className="rounded-lg border bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                        disabled={busy}
                        onClick={async () => {
                          const ok = window.confirm(
                            `${st.code} を削除しますか？\n\n※このコードを使っているシフトがあると、取込や当日変更でエラーになる可能性があります。`,
                          );
                          if (!ok) return;
                          setBusy(true);
                          setStatus("");
                          try {
                            await ensureAnonymousAuth();
                            await deleteDoc(shiftTypeDocRef(tenantId, st.code));
                            setStatus(`勤務形態を削除しました: ${st.code}`);
                          } catch (e: unknown) {
                            setStatus(e instanceof Error ? e.message : "Failed to delete shift type.");
                          } finally {
                            setBusy(false);
                          }
                        }}
                        type="button"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
                {(shiftTypesList ?? []).length === 0 ? (
                  <tr>
                    <td className="p-3 text-sm text-zinc-600" colSpan={5}>
                      勤務形態マスタがありません。上の「勤務形態マスタを作成/更新」を押してください。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t pt-4">
        <div className="text-sm font-medium">開発用: サンプル職員</div>
        <div className="mt-1 text-sm text-zinc-600">
          マッパーのD&D動作確認用に、サンプル職員を追加します（当日: {date}）。
        </div>
        <div className="mt-3">
          <button
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setStatus("");
              try {
                const res = await seedSampleStaff({ tenantId, date });
                setStatus(`サンプル職員を追加しました（${res.created}名）。`);
              } catch (e: unknown) {
                setStatus(e instanceof Error ? e.message : "Failed to seed staff.");
              } finally {
                setBusy(false);
              }
            }}
          >
            サンプル職員を追加
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        注意：秘密URL方式のため、このURLを知っている人は編集機能にアクセスできます。URLは管理者のみで共有してください。
      </div>
    </div>
  );
}

