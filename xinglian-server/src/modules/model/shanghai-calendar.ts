/** 业务日历统一按 Asia/Shanghai 日期边界（与订单展示口径一致） */

export function shanghaiTodayYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

export function shanghaiAddDays(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

/** Monday = 0 … Sunday = 6（中国内地一周从周一开始） */
export function shanghaiWeekdayMon0Sun6(ymd: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short"
  }).formatToParts(new Date(`${ymd}T12:00:00+08:00`));
  const short = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const key = short.slice(0, 3);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6
  };
  return map[key] ?? 0;
}

export function shanghaiMondayWeekContaining(ymd: string): string {
  const wd = shanghaiWeekdayMon0Sun6(ymd);
  return shanghaiAddDays(ymd, -wd);
}

export function shanghaiMonthStartYmd(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function shanghaiMonthNextFirstYmd(monthFirstYmd: string): string {
  const [y, m] = monthFirstYmd.split("-").map(Number);
  if (m === 12) return `${y + 1}-01-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export function rangeUtc(
  ymdStartInclusive: string,
  ymdEndExclusive: string
): { start: Date; endExclusive: Date } {
  return {
    start: new Date(`${ymdStartInclusive}T00:00:00+08:00`),
    endExclusive: new Date(`${ymdEndExclusive}T00:00:00+08:00`)
  };
}

/** 闭区间逐日枚举（含首尾），用于补齐趋势缺省 0 */
export function enumerateClosedYmd(startYmd: string, endYmd: string): string[] {
  const out: string[] = [];
  let cur = startYmd;
  while (true) {
    out.push(cur);
    if (cur === endYmd) break;
    cur = shanghaiAddDays(cur, 1);
  }
  return out;
}
