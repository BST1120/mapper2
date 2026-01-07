import ExcelJS from "exceljs";

export type ParsedRoster = {
  headerDates: string[]; // YYYY-MM-DD or ""
  rows: Array<{
    name: string;
    cells: string[]; // normalized text per date column
  }>;
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

export async function parseRosterXlsx(file: File): Promise<ParsedRoster> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Excelのシートが見つかりません。");

  const headerRow = ws.getRow(1);
  const headerDates: string[] = [];
  const maxCol = headerRow.cellCount;
  // col 1 is names; start from col 2
  for (let c = 2; c <= maxCol; c++) {
    headerDates.push(normalizeHeaderToDate(headerRow.getCell(c).value));
  }

  const rows: ParsedRoster["rows"] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = normalizeCell(row.getCell(1).value);
    if (!name) continue;
    const cells: string[] = [];
    for (let c = 2; c <= maxCol; c++) {
      cells.push(normalizeCell(row.getCell(c).value));
    }
    rows.push({ name, cells });
  }

  return { headerDates, rows };
}

