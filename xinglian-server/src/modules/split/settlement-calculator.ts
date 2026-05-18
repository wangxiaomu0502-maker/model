/**
 * 订单分账 v2（单位：元输入，内部按「分」整数运算）
 *
 * P = 模特收入 + 服务费
 * 服务费 F 在 平台 / 代理人 / 经纪人 间按万分比分配。
 */

export type SplitComputationInput = {
  payableAmountYuan: number;
  /** 模特占应付 P 的万分比（与 platformFeeRateBp 之和宜为 10000） */
  modelShareBp: number;
  /** 服务费内：平台 / 代理人 / 经纪人 万分比，三者之和 = 10000 */
  platformShareOfFeeBp: number;
  agentShareOfFeeBp: number;
  brokerShareOfFeeBp: number;
};

export type SplitComputationResult = {
  modelIncomeYuan: number;
  platformFeeYuan: number;
  agentIncomeYuan: number;
  brokerIncomeYuan: number;
  serviceFeeCents: number;
  remainderToPlatformCents: number;
};

export type SplitParties = {
  brokerUserId: number | null;
  agentUserId: number | null;
};

export type FinalizedSplitAmounts = {
  modelIncomeYuan: number;
  platformFeeYuan: number;
  agentIncomeYuan: number;
  brokerIncomeYuan: number;
};

function yuanToCents(yuan: number): number {
  return Math.round(yuan * 100);
}

function centsToYuan(cents: number): number {
  return Math.round(cents) / 100;
}

function roundMoney2(yuan: number): number {
  return Math.round(yuan * 100) / 100;
}

/** 按规则比例拆分应付 P（不区分订单是否绑定经纪人/代理人） */
export function computeOrderSplit(input: SplitComputationInput): SplitComputationResult {
  const P = yuanToCents(input.payableAmountYuan);

  const modelCents = Math.floor((P * input.modelShareBp) / 10000);
  const F = P - modelCents;

  let platformCents = Math.floor((F * input.platformShareOfFeeBp) / 10000);
  const agentCents = Math.floor((F * input.agentShareOfFeeBp) / 10000);
  const brokerCents = Math.floor((F * input.brokerShareOfFeeBp) / 10000);
  const remainder = F - platformCents - agentCents - brokerCents;
  platformCents += remainder;

  return {
    modelIncomeYuan: centsToYuan(modelCents),
    platformFeeYuan: centsToYuan(platformCents),
    agentIncomeYuan: centsToYuan(agentCents),
    brokerIncomeYuan: centsToYuan(brokerCents),
    serviceFeeCents: F,
    remainderToPlatformCents: remainder
  };
}

/**
 * 按订单参与方落库/入账：未绑定经纪人或代理人时，对应服务费份额计入 platform_fee，分项为 0。
 */
export function finalizeSplitAmounts(
  nominal: SplitComputationResult,
  parties: SplitParties
): FinalizedSplitAmounts {
  let platformFeeYuan = nominal.platformFeeYuan;
  let brokerIncomeYuan = nominal.brokerIncomeYuan;
  let agentIncomeYuan = nominal.agentIncomeYuan;

  if (parties.brokerUserId == null) {
    platformFeeYuan = roundMoney2(platformFeeYuan + brokerIncomeYuan);
    brokerIncomeYuan = 0;
  }
  if (parties.agentUserId == null) {
    platformFeeYuan = roundMoney2(platformFeeYuan + agentIncomeYuan);
    agentIncomeYuan = 0;
  }

  return {
    modelIncomeYuan: nominal.modelIncomeYuan,
    platformFeeYuan,
    brokerIncomeYuan,
    agentIncomeYuan
  };
}

/** 计算并落库用金额（比例拆分 + 参与方） */
export function computeOrderSplitForParties(
  input: SplitComputationInput,
  parties: SplitParties
): FinalizedSplitAmounts {
  return finalizeSplitAmounts(computeOrderSplit(input), parties);
}
