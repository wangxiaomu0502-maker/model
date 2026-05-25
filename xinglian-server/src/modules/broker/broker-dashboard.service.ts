import type { SplitRulesRow } from "../admin/split-rules.repository";
import {
  findSplitRulesById,
  insertDefaultSplitRulesRow,
  fallbackSplitRulesRowForEstimate
} from "../admin/split-rules.repository";
import {
  brokerTotalBrokerIncomeByCnDay,
  countLockedUsersByReferrer,
  findUnsplitPaidCompletedOrdersForBroker,
  sumBrokerIncome
} from "./broker-dashboard.repository";
import {
  enumerateClosedYmd,
  rangeUtc,
  shanghaiAddDays,
  shanghaiMondayWeekContaining,
  shanghaiMonthNextFirstYmd,
  shanghaiMonthStartYmd,
  shanghaiTodayYmd
} from "../model/shanghai-calendar";
import { computeOrderSplit } from "../split/settlement-calculator";

const SPLIT_RULES_ID = 1;

/** 按当前规则估算本单经纪人分成（仅商户绑定经纪人） */
export function estimateBrokerIncomeYuanForOrder(
  brokerUserId: number,
  order: {
    payableAmountYuan: number;
    brokerUserId: number | null;
    agentUserId: number | null;
  },
  rules: SplitRulesRow
): number {
  const p = order.payableAmountYuan;
  if (!Number.isFinite(p) || p <= 0) return 0;
  if (order.brokerUserId !== brokerUserId) return 0;

  const computed = computeOrderSplit({
    payableAmountYuan: p,
    modelShareBp: Number(rules.model_share_bp),
    platformShareOfFeeBp: Number(rules.platform_share_of_fee_bp),
    agentShareOfFeeBp: Number(rules.agent_share_of_fee_bp),
    brokerShareOfFeeBp: Number(rules.broker_share_of_fee_bp)
  });
  return computed.brokerIncomeYuan;
}

export type BrokerIncomePeriod = {
  brokerIncomeYuan: number;
  totalYuan: number;
  pendingSettlementYuan: number;
};

export async function computeBrokerLifetimePendingCommissionYuan(
  brokerUserId: number
): Promise<number> {
  await insertDefaultSplitRulesRow();
  const splitRules = await findSplitRulesById(SPLIT_RULES_ID);
  const rulesForEstimate = splitRules ?? fallbackSplitRulesRowForEstimate();
  const unsplitRows = await findUnsplitPaidCompletedOrdersForBroker(brokerUserId);
  if (unsplitRows.length === 0) return 0;
  let sumPending = 0;
  for (const row of unsplitRows) {
    sumPending += estimateBrokerIncomeYuanForOrder(brokerUserId, row, rulesForEstimate);
  }
  return Number(sumPending.toFixed(2));
}

async function periodIncome(
  brokerUserId: number,
  start: Date,
  endExclusive: Date,
  unsplitCommissionEst: number
): Promise<BrokerIncomePeriod> {
  const brokerIncomeYuan = Number(
    (await sumBrokerIncome(brokerUserId, start, endExclusive)).toFixed(2)
  );
  return {
    brokerIncomeYuan,
    totalYuan: brokerIncomeYuan,
    pendingSettlementYuan: unsplitCommissionEst
  };
}

export async function getBrokerDashboard(brokerUserId: number): Promise<{
  lockedMerchantCount: number;
  today: BrokerIncomePeriod;
  week: BrokerIncomePeriod;
  month: BrokerIncomePeriod;
  trend7d: Array<{ date: string; income: number }>;
}> {
  const lockedMerchantCount = await countLockedUsersByReferrer(brokerUserId, 2);

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

  const unsplitCommissionEst = await computeBrokerLifetimePendingCommissionYuan(brokerUserId);

  const [today, week, month, trendRows] = await Promise.all([
    periodIncome(brokerUserId, todayR.start, todayR.endExclusive, unsplitCommissionEst),
    periodIncome(brokerUserId, weekR.start, weekR.endExclusive, unsplitCommissionEst),
    periodIncome(brokerUserId, monthR.start, monthR.endExclusive, unsplitCommissionEst),
    brokerTotalBrokerIncomeByCnDay(brokerUserId, trendR.start, trendR.endExclusive)
  ]);

  const map = new Map<string, number>();
  for (const row of trendRows) {
    map.set(row.date, row.income);
  }

  const keys = enumerateClosedYmd(trendStartKey, todayKey);
  const trend7d = keys.map((date) => ({
    date,
    income: Number((map.get(date) ?? 0).toFixed(2))
  }));

  return {
    lockedMerchantCount,
    today,
    week,
    month,
    trend7d
  };
}
