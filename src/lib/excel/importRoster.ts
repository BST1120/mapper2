import ExcelJS from "exceljs";

export type ParsedRoster = {
  header: Array<{
    col: number; // 1-based
    raw: string;
    date: string; // YYYY-MM-DD or ""
  }>;
  rows: Array<{
    row: number; // 1-based
    name: string;
    cellsByCol: Record<number, string>;
  }>;
};

export type ParseRosterOptions = {
  sheetIndex?: number; // default 0
  headerRow: number; // e.g. 1 or 7
  nameCol: number; // e.g. 1 (A) or 2 (B)
  dateStartCol: number; // e.g. 2 (B)
  dateEndCol?: number; // inclusive; if omitted, uses headerRow.cellCount
  dataStartRow: number; // e.g. 2 or 8
  dataEndRow?: number; // inclusive; if omitted, uses ws.rowCount
  /**
   * 見出しセルが「1」「2」…のような日付（1-31）だけの時に、YYYY-MMを補完してYYYY-MM-DDにする
   * 例: "2026-01"
   */
  monthHint?: string;
};

function formatYYYYMMDD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return formatYYYYMMDD(v);
  // ExcelJS cell can be { text: string } etc
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyV = v as any;
  if (typeof anyV?.text === "string") return anyV.text.trim();
  if (typeof anyV?.result === "string") return anyV.result.trim();
  return String(v).trim();
}

function normalizeHeaderToDate(v: unknown): string {
  if (v instanceof Date) return formatYYYYMMDD(v);
  const s = normalizeCell(v);
  if (!s) return "";
  // Try parse common formats: YYYY/MM/DD, YYYY-MM-DD, M/D, etc
  const m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (!Number.isNaN(dt.getTime())) return formatYYYYMMDD(dt);
  }
  return s; // fallback
}

function inferDateFromDayNumber(raw: string, monthHint?: string) {
  if (!monthHint) return "";
  const m = raw.trim().match(/^(\d{1,2})$/);
  if (!m) return "";
  const day = Number(m[1]);
  if (day < 1 || day > 31) return "";
  const ym = monthHint.match(/^(\d{4})-(\d{2})$/);
  if (!ym) return "";
  const y = Number(ym[1]);
  const mo = Number(ym[2]);
  const dt = new Date(y, mo - 1, day);
  if (Number.isNaN(dt.getTime())) return "";
  // Guard month rollover (e.g., 2026-02-31)
  if (dt.getMonth() !== mo - 1) return "";
  return formatYYYYMMDD(dt);
}

export async function parseRosterXlsx(
  file: File,
  opts: ParseRosterOptions,
): Promise<ParsedRoster> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const ws = wb.worksheets[opts.sheetIndex ?? 0];
  if (!ws) throw new Error("Excelのシートが見つかりません。");

  const headerRow = ws.getRow(opts.headerRow);
  const maxCol = opts.dateEndCol ?? headerRow.cellCount;

  const header: ParsedRoster["header"] = [];
  for (let c = opts.dateStartCol; c <= maxCol; c++) {
    const raw = normalizeCell(headerRow.getCell(c).value);
    const dt = normalizeHeaderToDate(headerRow.getCell(c).value);
    const date = dt && /^\d{4}-\d{2}-\d{2}$/.test(dt) ? dt : inferDateFromDayNumber(raw, opts.monthHint);
    header.push({ col: c, raw, date });
  }

  const rows: ParsedRoster["rows"] = [];
  const endRow = opts.dataEndRow ?? ws.rowCount;
  for (let r = opts.dataStartRow; r <= endRow; r++) {
    const row = ws.getRow(r);
    const name = normalizeCell(row.getCell(opts.nameCol).value);
    if (!name) continue;

    const cellsByCol: Record<number, string> = {};
    for (const h of header) {
      cellsByCol[h.col] = normalizeCell(row.getCell(h.col).value);
    }
    rows.push({ row: r, name, cellsByCol });
  }

  return { header, rows };
}

