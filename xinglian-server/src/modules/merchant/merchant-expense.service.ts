import {
  enumerateClosedYmd,
  rangeUtc,
  shanghaiAddDays,
  shanghaiMondayWeekContaining,
  shanghaiMonthNextFirstYmd,
  shanghaiMonthStartYmd,
  shanghaiTodayYmd
} from "../model/shanghai-calendar";
import {
  merchantAllTimePaidExpenseSum,
  merchantExpenseGroupedByPaidCnDay,
  merchantPaidExpenseSum,
  merchantPaidOrderCount,
  merchantUnpaidPayableSum
} from "./merchant-expense.repository";

export type MerchantExpensePeriod = {
  orderCount: number;
  expenseYuan: number;
};

export async function getMerchantExpenseDashboard(merchantUserId: number): Promise<{
  today: MerchantExpensePeriod;
  week: MerchantExpensePeriod;
  month: MerchantExpensePeriod;
  allTimeExpenseYuan: number;
  unpaidPayableYuan: number;
  trend7d: Array<{ date: string; expense: number }>;
}> {
  const todayKey = shanghaiTodayYmd();
  const tomorrowKey = shanghaiAddDays(todayKey, 1);
  const weekStart = shanghaiMondayWeekContaining(todayKey);
  const nextWeekStart = shanghaiAddDays(weekStart, 7);
  const monthStart = shanghaiMonthStartYmd(todayKey);
  const nextMonthStart = shanghaiMonthNextFirstYmd(monthStart);

  const todayR = rangeUtc(todayKey, tomorrowKey);
  const weekR = rangeUtc(weekStart, nextWeekStart);
  const monthR = rangeUtc(monthStart, nextMonthStart);

  const trendStartKey = shanghaiAddDays(todayKey, -6);
  const trendR = rangeUtc(trendStartKey, tomorrowKey);

  async function period(start: Date, endExclusive: Date): Promise<MerchantExpensePeriod> {
    const [orderCount, expenseYuan] = await Promise.all([
      merchantPaidOrderCount(merchantUserId, start, endExclusive),
      merchantPaidExpenseSum(merchantUserId, start, endExclusive)
    ]);
    return {
      orderCount,
      expenseYuan: Number(expenseYuan.toFixed(2))
    };
  }

  const [today, week, month, allTimeExpenseYuan, unpaidPayableYuan, trendRows] = await Promise.all([
    period(todayR.start, todayR.endExclusive),
    period(weekR.start, weekR.endExclusive),
    period(monthR.start, monthR.endExclusive),
    merchantAllTimePaidExpenseSum(merchantUserId),
    merchantUnpaidPayableSum(merchantUserId),
    merchantExpenseGroupedByPaidCnDay(merchantUserId, trendR.start, trendR.endExclusive)
  ]);

  const map = new Map<string, number>();
  for (const row of trendRows) {
    map.set(row.date, row.expense);
  }
  const keys = enumerateClosedYmd(trendStartKey, todayKey);
  const trend7d = keys.map((date) => ({
    date,
    expense: Number((map.get(date) ?? 0).toFixed(2))
  }));

  return {
    today,
    week,
    month,
    allTimeExpenseYuan: Number(allTimeExpenseYuan.toFixed(2)),
    unpaidPayableYuan: Number(unpaidPayableYuan.toFixed(2)),
    trend7d
  };
}
