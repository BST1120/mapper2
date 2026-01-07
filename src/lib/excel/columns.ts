export function colToNumber(col: string): number {
  const s = col.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(s)) return NaN;
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    n = n * 26 + (s.charCodeAt(i) - 64);
  }
  return n;
}

export function numberToCol(n: number): string {
  let x = n;
  let out = "";
  while (x > 0) {
    const rem = (x - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    x = Math.floor((x - 1) / 26);
  }
  return out || "A";
}

