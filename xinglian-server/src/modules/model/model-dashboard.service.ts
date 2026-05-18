import type { SplitRulesRow } from "../admin/split-rules.repository";
import { findSplitRulesById, insertDefaultSplitRulesRow, fallbackSplitRulesRowForEstimate } from "../admin/split-rules.repository";
import {
  findModelInTransitOrdersForPendingEstimate,
  findUnsplitPaidCompletedOrdersForModel,
  modelIncomeGroupedByCompletedCnDay,
  modelOrderCount,
  modelSettledIncomeSum
} from "./model-dashboard.repository";
import {
  enumerateClosedYmd,
  rangeUtc,
  shanghaiAddDays,
  shanghaiMondayWeekContaining,
  shanghaiMonthNextFirstYmd,
  shanghaiMonthStartYmd,
  shanghaiTodayYmd
} from "./shanghai-calendar";
import { computeOrderSplit } from "../split/settlement-calculator";

const SPLIT_RULES_ID = 1;

function estimateModelIncomeYuanForOrder(
  order: {
    payableAmountYuan: number;
    brokerUserId: number | null;
    agentUserId: number | null;
  },
  rules: SplitRulesRow
): number {
  const p = order.payableAmountYuan;
  if (!Number.isFinite(p) || p <= 0) return 0;
  return computeOrderSplit({
    payableAmountYuan: p,
    modelShareBp: Number(rules.model_share_bp),
    platformShareOfFeeBp: Number(rules.platform_share_of_fee_bp),
    agentShareOfFeeBp: Number(rules.agent_share_of_fee_bp),
    brokerShareOfFeeBp: Number(rules.broker_share_of_fee_bp)
  }).modelIncomeYuan;
}

export type ModelDashboardPeriod = {
  orderCount: number;
  income: number;
  pendingSettlement: number;
};

/** 钱包用：全量待结算 = 在途(1～2) lifetime + 未完成分账 backlog 估算 */
export async function computeModelLifetimePendingSettlementYuan(modelUserId: number): Promise<number> {
  await insertDefaultSplitRulesRow();
  const splitRules = await findSplitRulesById(SPLIT_RULES_ID);
  const rulesForEstimate = splitRules ?? fallbackSplitRulesRowForEstimate();

  const [inTransitRows, unsplitRows] = await Promise.all([
    findModelInTransitOrdersForPendingEstimate(modelUserId, null, null),
    findUnsplitPaidCompletedOrdersForModel(modelUserId)
  ]);

  let inTransitLifetime = 0;
  for (const row of inTransitRows) {
    inTransitLifetime += estimateModelIncomeYuanForOrder(row, rulesForEstimate);
  }
  inTransitLifetime = Number(inTransitLifetime.toFixed(2));

  let unsplitModelEst = 0;
  if (unsplitRows.length > 0) {
    let acc = 0;
    for (const row of unsplitRows) {
      acc += estimateModelIncomeYuanForOrder(row, rulesForEstimate);
    }
    unsplitModelEst = Number(acc.toFixed(2));
  }

  return Number((inTransitLifetime + unsplitModelEst).toFixed(2));
}

async function periodMetrics(
  modelUserId: number,
  start: Date,
  endExclusive: Date,
  rulesForEstimate: SplitRulesRow,
  unsplitModelEst: number
): Promise<ModelDashboardPeriod> {
  const [orderCount, income, inTransitRows] = await Promise.all([
    modelOrderCount(modelUserId, start, endExclusive),
    modelSettledIncomeSum(modelUserId, start, endExclusive),
    findModelInTransitOrdersForPendingEstimate(modelUserId, start, endExclusive)
  ]);

  let inTransitSum = 0;
  for (const row of inTransitRows) {
    inTransitSum += estimateModelIncomeYuanForOrder(row, rulesForEstimate);
  }
  inTransitSum = Number(inTransitSum.toFixed(2));

  const pendingSettlement = Number((inTransitSum + unsplitModelEst).toFixed(2));

  return {
    orderCount,
    income: Number(income.toFixed(2)),
    pendingSettlement
  };
}

export async function getModelDashboard(modelUserId: number): Promise<{
  today: ModelDashboardPeriod;
  week: ModelDashboardPeriod;
  month: ModelDashboardPeriod;
  trend7d: Array<{ date: string; income: number }>;
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

  await insertDefaultSplitRulesRow();
  const splitRules = await findSplitRulesById(SPLIT_RULES_ID);
  const rulesForEstimate = splitRules ?? fallbackSplitRulesRowForEstimate();

  const unsplitRows = await findUnsplitPaidCompletedOrdersForModel(modelUserId);
  let unsplitModelEst = 0;
  if (unsplitRows.length > 0) {
    let acc = 0;
    for (const row of unsplitRows) {
      acc += estimateModelIncomeYuanForOrder(row, rulesForEstimate);
    }
    unsplitModelEst = Number(acc.toFixed(2));
  }

  const [
    today,
    week,
    month,
    trendRows
  ] = await Promise.all([
    periodMetrics(modelUserId, todayR.start, todayR.endExclusive, rulesForEstimate, unsplitModelEst),
    periodMetrics(modelUserId, weekR.start, weekR.endExclusive, rulesForEstimate, unsplitModelEst),
    periodMetrics(modelUserId, monthR.start, monthR.endExclusive, rulesForEstimate, unsplitModelEst),
    modelIncomeGroupedByCompletedCnDay(modelUserId, trendR.start, trendR.endExclusive)
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

  return { today, week, month, trend7d };
}
