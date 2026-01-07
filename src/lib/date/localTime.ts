export function dateAtLocal(dateYYYYMMDD: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((s) => Number(s));
  const d = new Date(`${dateYYYYMMDD}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

