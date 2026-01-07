"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Timestamp, serverTimestamp, writeBatch } from "firebase/firestore";

import { dateAtLocal } from "@/lib/date/localTime";
import { formatDateYYYYMMDD } from "@/lib/date/today";
import { colToNumber, numberToCol } from "@/lib/excel/columns";
import { parseRosterXlsx, type ParsedRoster } from "@/lib/excel/importRoster";
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

function normalizeName(s: string) {
  return s.replace(/\s+/g, "").replace(/　+/g, "").trim();
}

function parseTimeRange(raw: string): { start: string; end: string } | null {
  const s = raw.trim();
  const m = s.match(
    /^(\d{1,2})(?::(\d{2}))?\s*[-~〜]\s*(\d{1,2})(?::(\d{2}))?$/,
  );
  if (!m) return null;
  const sh = String(Number(m[1])).padStart(2, "0");
  const sm = String(Number(m[2] ?? "0")).padStart(2, "0");
  const eh = String(Number(m[3])).padStart(2, "0");
  const em = String(Number(m[4] ?? "0")).padStart(2, "0");
  return { start: `${sh}:${sm}`, end: `${eh}:${em}` };
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
      return {
        start: staff.fixedStart ?? "09:00",
        end: staff.fixedEnd ?? "18:00",
      };
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

function parseCode(raw: string, staff: Staff) {
  const v = raw.trim();
  if (!v) return { kind: "empty" as const };
  const upper = v.toUpperCase();
  if (["A", "B", "C", "D", "E", "F"].includes(upper))
    return { kind: "af" as const, code: upper as Shift["workType"] };
  if (["-", "休", "休み", "OFF"].includes(upper)) return { kind: "empty" as const };

  const time = parseTimeRange(v);
  if (time) return { kind: "time" as const, time };

  // For fixed-shift staff, allow common "worked" marks.
  if (staff.workTypeDefault === "fixed" && ["出", "〇", "○", "◯", "P"].includes(upper)) {
    return { kind: "fixed" as const };
  }

  return { kind: "unknown" as const, value: raw };
}

type RowPreview = {
  excelName: string;
  staffId?: string;
  status: "ok" | "needs_select" | "unmatched";
};

function chunkBatches<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function AdminImportClient() {
  const params = useParams<{ tenant: string; editKey: string }>();
  const tenantId = params.tenant;
  const { staffById } = useStaff(tenantId);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedRoster | null>(null);

  // Range/config (defaults)
  const [headerRow, setHeaderRow] = useState(7);
  const [nameCol, setNameCol] = useState("B");
  const [dateStartCol, setDateStartCol] = useState("C");
  const [dateEndCol, setDateEndCol] = useState("");
  const [dataStartRow, setDataStartRow] = useState(8);
  const [dataEndRow, setDataEndRow] = useState("");
  const [monthHint, setMonthHint] = useState(() =>
    formatDateYYYYMMDD(new Date()).slice(0, 7),
  ); // YYYY-MM

  const [mode, setMode] = useState<"single" | "range">("range");
  const [singleDate, setSingleDate] = useState(formatDateYYYYMMDD(new Date()));

  // manual mapping selections (excelName -> staffId)
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const staffIndex = useMemo(() => {
    if (!staffById) return null;
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
    return { fullIndex, lastIndex };
  }, [staffById]);

  const detectedDates = useMemo(() => {
    if (!parsed) return [];
    return parsed.header
      .filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date))
      .map((h) => h.date);
  }, [parsed]);

  const selectedDateCols = useMemo(() => {
    if (!parsed) return [];
    if (mode === "single") {
      return parsed.header.filter((h) => h.date === singleDate);
    }
    // range: all detected dates in the selected column span
    return parsed.header.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date));
  }, [parsed, mode, singleDate]);

  const rangeLabel = useMemo(() => {
    if (!parsed) return "";
    const ds = selectedDateCols.map((h) => h.date).filter(Boolean).sort();
    if (!ds.length) return "";
    return `${ds[0]} 〜 ${ds[ds.length - 1]}`;
  }, [parsed, selectedDateCols]);

  const previewRows = useMemo<RowPreview[] | null>(() => {
    if (!parsed || !staffById || !staffIndex) return null;

    return parsed.rows.map((r) => {
      const excelName = r.name;
      const norm = normalizeName(excelName);
      const explicit = nameMap[excelName];
      if (explicit) return { excelName, staffId: explicit, status: "ok" };

      const full = staffIndex.fullIndex[norm];
      if (full?.length === 1) return { excelName, staffId: full[0]!, status: "ok" };
      if (full?.length && full.length > 1)
        return { excelName, status: "needs_select" };

      const last = staffIndex.lastIndex[norm];
      if (last?.length === 1) return { excelName, staffId: last[0]!, status: "ok" };
      if (last?.length && last.length > 1)
        return { excelName, status: "needs_select" };

      return { excelName, status: "unmatched" };
    });
  }, [parsed, staffById, staffIndex, nameMap]);

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border bg-zinc-50 p-3">
          <div className="text-sm font-medium">範囲指定</div>
          <div className="mt-2 grid gap-2 text-sm">
            <label className="grid gap-1">
              <span className="text-xs text-zinc-600">日付の行（例: 7）</span>
              <input
                className="rounded-lg border px-2 py-1"
                type="number"
                value={headerRow}
                onChange={(e) => setHeaderRow(Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-zinc-600">氏名の列（例: B）</span>
              <input
                className="rounded-lg border px-2 py-1"
                value={nameCol}
                onChange={(e) => setNameCol(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1">
                <span className="text-xs text-zinc-600">日付開始列（例: C）</span>
                <input
                  className="rounded-lg border px-2 py-1"
                  value={dateStartCol}
                  onChange={(e) => setDateStartCol(e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-zinc-600">日付終了列（例: AG）</span>
                <input
                  className="rounded-lg border px-2 py-1"
                  value={dateEndCol}
                  onChange={(e) => setDateEndCol(e.target.value)}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1">
                <span className="text-xs text-zinc-600">データ開始行（例: 8）</span>
                <input
                  className="rounded-lg border px-2 py-1"
                  type="number"
                  value={dataStartRow}
                  onChange={(e) => setDataStartRow(Number(e.target.value))}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-zinc-600">データ終了行（空=最後まで）</span>
                <input
                  className="rounded-lg border px-2 py-1"
                  value={dataEndRow}
                  onChange={(e) => setDataEndRow(e.target.value)}
                />
              </label>
            </div>
            <label className="grid gap-1">
              <span className="text-xs text-zinc-600">月ヒント（YYYY-MM）</span>
              <input
                className="rounded-lg border px-2 py-1"
                value={monthHint}
                onChange={(e) => setMonthHint(e.target.value)}
              />
              <span className="text-xs text-zinc-500">
                見出しが「1」「2」…だけの時にこの月で補完します。
              </span>
            </label>
          </div>
        </div>

        <div className="rounded-xl border bg-zinc-50 p-3 lg:col-span-2">
          <div className="text-sm font-medium">取込ファイル</div>
          <div className="mt-2 grid gap-2">
            <input
              className="rounded-lg border px-3 py-2"
              type="file"
              accept=".xlsx"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBusy(true);
                setStatus("");
                setFileName(f.name);
                setParsed(null);
                try {
                  const opts = {
                    headerRow,
                    nameCol: colToNumber(nameCol),
                    dateStartCol: colToNumber(dateStartCol),
                    dateEndCol: dateEndCol ? colToNumber(dateEndCol) : undefined,
                    dataStartRow,
                    dataEndRow: dataEndRow ? Number(dataEndRow) : undefined,
                    monthHint: monthHint?.trim() || undefined,
                  };
                  if (!opts.nameCol || !opts.dateStartCol) {
                    throw new Error("列指定が不正です（A〜Zの形式で入力してください）。");
                  }
                  const res = await parseRosterXlsx(f, opts);
                  setParsed(res);
                  setNameMap({});
                } catch (err: unknown) {
                  setStatus(err instanceof Error ? err.message : "Excelの読み取りに失敗しました。");
                } finally {
                  setBusy(false);
                }
              }}
            />
            {fileName ? (
              <div className="text-sm text-zinc-600">
                ファイル: <span className="font-medium">{fileName}</span>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={mode === "range"}
                  onChange={() => setMode("range")}
                />
                ひと月分（検出できた日付列すべて）
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={mode === "single"}
                  onChange={() => setMode("single")}
                />
                1日だけ
              </label>
              {mode === "single" ? (
                <input
                  className="rounded-lg border px-2 py-1"
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                />
              ) : null}
              {parsed ? (
                <span className="text-xs text-zinc-500">
                  検出日数: {detectedDates.length}
                </span>
              ) : null}
            </div>
          </div>

          {parsed ? (
            <div className="mt-3 rounded-lg bg-white p-3 text-sm text-zinc-600">
              <div>
                見出し列: {numberToCol(colToNumber(dateStartCol))}〜
                {dateEndCol ? dateEndCol.toUpperCase() : "（自動）"}
              </div>
              <div className="mt-1">
                検出できた日付の例:{" "}
                <span className="font-medium">
                  {detectedDates.slice(0, 5).join(", ") || "（なし）"}
                </span>
              </div>
              {mode === "range" && rangeLabel ? (
                <div className="mt-1">
                  取込対象範囲: <span className="font-medium">{rangeLabel}</span>
                </div>
              ) : null}
              {mode === "single" && selectedDateCols.length === 0 ? (
                <div className="mt-1 text-red-600">
                  {singleDate} の列が見つかりません。
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {previewRows && staffById ? (
        <div className="mt-4">
          <div className="text-sm font-medium">氏名の紐づけ（必要な分だけ）</div>
          <div className="mt-2 overflow-auto rounded-xl border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  <th className="p-2 text-left">Excel氏名</th>
                  <th className="p-2 text-left">職員（Firestore）</th>
                  <th className="p-2 text-left">状態</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 60).map((r) => {
                  const needsSelect = r.status !== "ok";
                  const excelName = r.excelName;
                  return (
                    <tr key={excelName} className="border-t">
                      <td className="p-2">{excelName}</td>
                      <td className="p-2">
                        <select
                          className="w-full rounded-lg border px-2 py-1"
                          value={nameMap[excelName] ?? r.staffId ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setNameMap((prev) => ({ ...prev, [excelName]: v }));
                          }}
                        >
                          <option value="">（未選択）</option>
                          {Object.entries(staffById)
                            .map(([id, s]) => ({ id, label: buildDisplayName(s) }))
                            .sort((a, b) => a.label.localeCompare(b.label, "ja"))
                            .map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="p-2">
                        {needsSelect ? (
                          <span className="text-amber-700">選択推奨</span>
                        ) : (
                          <span className="text-emerald-700">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            表示は先頭60行です（必要な行だけ選択すればOK）。
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={busy || !parsed || !staffById || selectedDateCols.length === 0}
          onClick={async () => {
            if (!parsed || !staffById || !staffIndex) return;
            setBusy(true);
            setStatus("");
            try {
              await ensureAnonymousAuth();

              // Build staffId resolver
              const resolveStaffId = (excelName: string): string | null => {
                if (nameMap[excelName]) return nameMap[excelName]!;
                const norm = normalizeName(excelName);
                const full = staffIndex.fullIndex[norm];
                if (full?.length === 1) return full[0]!;
                const last = staffIndex.lastIndex[norm];
                if (last?.length === 1) return last[0]!;
                return null;
              };

              // Count per date for audit log
              const countByDate: Record<string, number> = {};

              // Prepare all write operations (we will batch/commit in chunks)
              const ops: Array<{
                date: string;
                apply: (batch: ReturnType<typeof writeBatch>) => void;
              }> = [];

              for (const row of parsed.rows) {
                const staffId = resolveStaffId(row.name);
                if (!staffId) continue;
                const staff = staffById[staffId];
                if (!staff) continue;

                for (const h of selectedDateCols) {
                  const dateStr = h.date;
                  const raw = row.cellsByCol[h.col] ?? "";
                  const code = parseCode(raw, staff);
                  if (code.kind === "empty") continue;
                  if (code.kind === "unknown") continue;

                  let start: string;
                  let end: string;
                  let workType: Shift["workType"];

                  if (code.kind === "af") {
                    workType = code.code;
                    const t = workTypeToTimes(workType, staff);
                    start = t.start;
                    end = t.end;
                  } else if (code.kind === "time") {
                    workType = "fixed";
                    start = code.time.start;
                    end = code.time.end;
                  } else {
                    // fixed mark
                    workType = "fixed";
                    const t = workTypeToTimes("fixed", staff);
                    start = t.start;
                    end = t.end;
                  }

                  const shift: Shift = {
                    startAt: Timestamp.fromDate(dateAtLocal(dateStr, start)) as unknown,
                    endAt: Timestamp.fromDate(dateAtLocal(dateStr, end)) as unknown,
                    workType,
                    breakSlots: breakSlotsFor(staff),
                    source: "excel",
                  };

                  ops.push({
                    date: dateStr,
                    apply: (batch) => {
                      batch.set(shiftDocRef(tenantId, dateStr, staffId), shift, { merge: true });
                      batch.set(
                        assignmentDocRef(tenantId, dateStr, staffId),
                        { areaId: "free", version: 1, updatedAt: serverTimestamp() as unknown },
                        { merge: true },
                      );
                    },
                  });

                  countByDate[dateStr] = (countByDate[dateStr] ?? 0) + 1;
                }
              }

              // Firestore batch limit is 500; keep margin (each op writes 2 docs)
              const chunks = chunkBatches(ops, 200); // 200 ops => 400 writes
              for (const chunk of chunks) {
                const batch = writeBatch(tenantDocRef(tenantId).firestore);
                for (const op of chunk) op.apply(batch);
                await batch.commit();
              }

              // audit log per date
              const { addDoc } = await import("firebase/firestore");
              for (const [d, c] of Object.entries(countByDate)) {
                await addDoc(auditLogsColRef(tenantId, d), {
                  timestamp: serverTimestamp() as unknown,
                  type: "import",
                  importedCount: c,
                });
              }

              setStatus(
                mode === "single"
                  ? `取込しました（${countByDate[singleDate] ?? 0}件 / ${singleDate}）。`
                  : `取込しました（${Object.values(countByDate).reduce((a, b) => a + b, 0)}件 / ${Object.keys(countByDate).length}日）。`,
              );
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

      <div className="mt-3 text-xs text-zinc-500">
        注意: 既存のシフトは <code>merge</code> 更新します（同じ日・同じ職員は上書き）。
      </div>
    </div>
  );
}

