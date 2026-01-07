"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Timestamp, serverTimestamp, writeBatch } from "firebase/firestore";

import { formatDateYYYYMMDD } from "@/lib/date/today";
import { dateAtLocal } from "@/lib/date/localTime";
import { parseRosterXlsx } from "@/lib/excel/importRoster";
import { ensureAnonymousAuth } from "@/lib/firebase/client";
import {
  assignmentDocRef,
  auditLogsColRef,
  shiftDocRef,
  tenantDocRef,
} from "@/lib/firebase/refs";
import type { Shift, Staff } from "@/lib/firebase/schema";
import { buildDisplayName } from "@/lib/staff/displayName";
import { useStaff } from "@/lib/firebase/hooks";

type Match =
  | { kind: "matched"; staffId: string }
  | { kind: "ambiguous"; candidates: string[]; chosen?: string }
  | { kind: "unmatched" };

function normalizeName(s: string) {
  return s.replace(/\s+/g, "").replace(/　+/g, "").trim();
}

function workTypeToTimes(workType: Staff["workTypeDefault"], staff: Staff) {
  switch (workType) {
    case "A":
      return { start: "07:00", end: "16:00" };
    case "B":
      return { start: "07:30", end: "16:30" };
    case "C":
      return { start: "08:00", end: "17:00" };
    case "D":
      return { start: "08:30", end: "17:30" };
    case "E":
      return { start: "09:00", end: "18:00" };
    case "F":
      return { start: "10:00", end: "19:00" };
    case "fixed":
    default:
      return { start: staff.fixedStart ?? "09:00", end: staff.fixedEnd ?? "18:00" };
  }
}

function breakSlotsFor(staff: Staff): Shift["breakSlots"] {
  if (staff.breakPattern === "15_30") {
    return [
      { minutes: 15, used: false },
      { minutes: 30, used: false },
    ];
  }
  return [
    { minutes: 30, used: false },
    { minutes: 30, used: false },
  ];
}

function parseCode(raw: string) {
  const v = raw.trim().toUpperCase();
  if (!v) return { kind: "empty" as const };
  if (["A", "B", "C", "D", "E", "F"].includes(v)) return { kind: "af" as const, code: v as Shift["workType"] };
  // common off markers
  if (["-", "休", "休み", "OFF"].includes(v)) return { kind: "empty" as const };
  return { kind: "unknown" as const, value: raw };
}

export function AdminImportClient() {
  const params = useParams<{ tenant: string; editKey: string }>();
  const tenantId = params.tenant;
  const { staffById } = useStaff(tenantId);

  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<Awaited<ReturnType<typeof parseRosterXlsx>> | null>(null);
  const [date, setDate] = useState<string>(formatDateYYYYMMDD(new Date()));
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const dateColIndex = useMemo(() => {
    if (!parsed) return -1;
    return parsed.headerDates.findIndex((d) => d === date);
  }, [parsed, date]);

  const extracted = useMemo(() => {
    if (!parsed || !staffById || dateColIndex < 0) return null;

    // build name indexes
    const fullIndex: Record<string, string[]> = {};
    const lastIndex: Record<string, string[]> = {};
    for (const [id, s] of Object.entries(staffById)) {
      const full = normalizeName(`${s.lastName}${s.firstName}`);
      fullIndex[full] ??= [];
      fullIndex[full].push(id);
      const ln = normalizeName(s.lastName);
      lastIndex[ln] ??= [];
      lastIndex[ln].push(id);
    }

    const rows = parsed.rows.map((r) => {
      const nameNorm = normalizeName(r.name);
      const cell = r.cells[dateColIndex] ?? "";

      let match: Match = { kind: "unmatched" };
      const full = fullIndex[nameNorm];
      if (full?.length === 1) match = { kind: "matched", staffId: full[0]! };
      else if (full?.length && full.length > 1) match = { kind: "ambiguous", candidates: full };
      else {
        const ln = lastIndex[nameNorm];
        if (ln?.length === 1) match = { kind: "matched", staffId: ln[0]! };
        else if (ln?.length && ln.length > 1) match = { kind: "ambiguous", candidates: ln };
      }

      return { excelName: r.name, codeRaw: cell, match };
    });

    return rows;
  }, [parsed, staffById, dateColIndex]);

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-medium">日付</span>
          <input
            className="rounded-lg border px-3 py-2"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">勤務表（.xlsx）</span>
          <input
            className="rounded-lg border px-3 py-2"
            type="file"
            accept=".xlsx"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              setStatus("");
              setFileName(f.name);
              try {
                const res = await parseRosterXlsx(f);
                setParsed(res);
              } catch (err: unknown) {
                setParsed(null);
                setStatus(err instanceof Error ? err.message : "Excelの読み取りに失敗しました。");
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>

      {parsed ? (
        <div className="mt-4 text-sm text-zinc-600">
          ファイル: <span className="font-medium">{fileName}</span>
          <div className="mt-1">
            1行目（日付見出し）から <span className="font-medium">{date}</span>{" "}
            の列を探します。
            {dateColIndex < 0 ? (
              <span className="ml-2 text-red-600">この日付の列が見つかりません。</span>
            ) : (
              <span className="ml-2 text-emerald-700">列を検出しました。</span>
            )}
          </div>
        </div>
      ) : null}

      {extracted ? (
        <div className="mt-4">
          <div className="text-sm font-medium">抽出プレビュー</div>
          <div className="mt-2 overflow-auto rounded-xl border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  <th className="p-2 text-left">Excel氏名</th>
                  <th className="p-2 text-left">勤務コード</th>
                  <th className="p-2 text-left">職員（Firestore）</th>
                  <th className="p-2 text-left">状態</th>
                </tr>
              </thead>
              <tbody>
                {extracted.slice(0, 50).map((r, idx) => {
                  const parsedCode = parseCode(r.codeRaw);
                  const match = r.match;
                  const statusText =
                    parsedCode.kind === "unknown"
                      ? `未知コード: ${r.codeRaw}`
                      : match.kind === "matched"
                        ? "OK"
                        : match.kind === "ambiguous"
                          ? "候補から選択が必要"
                          : "未一致";

                  const rowKey = `${r.excelName}-${idx}`;
                  return (
                    <tr key={rowKey} className="border-t">
                      <td className="p-2">{r.excelName}</td>
                      <td className="p-2">{r.codeRaw}</td>
                      <td className="p-2">
                        {match.kind === "matched" ? (
                          <span className="font-medium">
                            {buildDisplayName(staffById![match.staffId]!)}
                          </span>
                        ) : match.kind === "ambiguous" ? (
                          <select
                            className="w-full rounded-lg border px-2 py-1"
                            defaultValue=""
                            onChange={(e) => {
                              const v = e.target.value || undefined;
                              match.chosen = v;
                            }}
                          >
                            <option value="">選択してください</option>
                            {match.candidates.map((id) => (
                              <option key={id} value={id}>
                                {buildDisplayName(staffById![id]!)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="p-2">
                        {statusText === "OK" ? (
                          <span className="text-emerald-700">{statusText}</span>
                        ) : (
                          <span className="text-amber-700">{statusText}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            プレビューは先頭50行のみ表示します。
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={busy || !staffById || dateColIndex < 0}
              onClick={async () => {
                if (!parsed || !staffById) return;
                setBusy(true);
                setStatus("");
                try {
                  await ensureAnonymousAuth();

                  const batch = writeBatch(tenantDocRef(tenantId).firestore);
                  let importedCount = 0;

                  for (const r of extracted) {
                    const code = parseCode(r.codeRaw);
                    if (code.kind === "empty") continue;
                    if (code.kind === "unknown") continue;

                    let staffId: string | undefined;
                    if (r.match.kind === "matched") staffId = r.match.staffId;
                    if (r.match.kind === "ambiguous") staffId = r.match.chosen;
                    if (!staffId) continue;

                    const staff = staffById[staffId];
                    if (!staff) continue;

                    const workType = code.kind === "af" ? code.code : staff.workTypeDefault;
                    const times = workTypeToTimes(workType, staff);

                    const shift: Shift = {
                      startAt: Timestamp.fromDate(dateAtLocal(date, times.start)) as unknown,
                      endAt: Timestamp.fromDate(dateAtLocal(date, times.end)) as unknown,
                      workType,
                      breakSlots: breakSlotsFor(staff),
                      source: "excel",
                    };

                    batch.set(shiftDocRef(tenantId, date, staffId), shift, { merge: true });
                    // Ensure assignment exists (default free)
                    batch.set(
                      assignmentDocRef(tenantId, date, staffId),
                      { areaId: "free", version: 1, updatedAt: serverTimestamp() as unknown },
                      { merge: true },
                    );

                    importedCount += 1;
                  }

                  await batch.commit();
                  // audit log (best-effort)
                  void (async () => {
                    const { addDoc } = await import("firebase/firestore");
                    await addDoc(auditLogsColRef(tenantId, date), {
                      timestamp: serverTimestamp() as unknown,
                      type: "import",
                      importedCount,
                    });
                  })();

                  setStatus(`取込しました（${importedCount}件）。`);
                } catch (e: unknown) {
                  setStatus(e instanceof Error ? e.message : "取込に失敗しました。");
                } finally {
                  setBusy(false);
                }
              }}
            >
              取込を反映（shifts更新）
            </button>

            {status ? <span className="text-sm text-zinc-700">{status}</span> : null}
          </div>
        </div>
      ) : null}

      {!staffById ? (
        <div className="mt-4 text-sm text-zinc-600">職員マスタを読み込み中…</div>
      ) : null}
      {!parsed ? (
        <div className="mt-4 text-sm text-zinc-600">
          まず <code>.xlsx</code> を選択してください。
        </div>
      ) : null}
    </div>
  );
}

