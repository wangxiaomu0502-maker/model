import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";
import { getBrokerDashboard } from "../broker/broker-dashboard.service";
import { getModelDashboard } from "../model/model-dashboard.service";
import { modelOrderCount, modelSettledIncomeSum } from "../model/model-dashboard.repository";
import { getMerchantExpenseDashboard } from "../merchant/merchant-expense.service";
import { sumBrokerIncome } from "../broker/broker-dashboard.repository";
import { findUserBalance } from "../wallet/wallet.repository";

import { findUserRoleByIdForAdmin } from "./admin.repository";

const LIFETIME_START = new Date(0);
const LIFETIME_END = new Date("2099-01-01T00:00:00.000Z");

async function assertUserRole(userId: number, expectedRole: 1 | 2 | 3): Promise<void> {
  const role = await findUserRoleByIdForAdmin(userId);
  if (role == null) {
    throw new AppError("user not found", 404, ErrorCodes.NOT_FOUND);
  }
  if (role !== expectedRole) {
    throw new AppError("user role mismatch", 400, ErrorCodes.VALIDATION_ERROR);
  }
}

async function walletBalanceForAdmin(userId: number): Promise<{
  availableYuan: number;
  frozenYuan: number;
  ledgerTableReady: boolean;
}> {
  const bal = await findUserBalance(userId);
  if (bal == null) {
    return { availableYuan: 0, frozenYuan: 0, ledgerTableReady: false };
  }
  return {
    availableYuan: Number(bal.availableYuan.toFixed(2)),
    frozenYuan: Number(bal.frozenYuan.toFixed(2)),
    ledgerTableReady: true
  };
}

export async function getAdminMerchantExpenseStats(merchantUserId: number) {
  await assertUserRole(merchantUserId, 2);
  const stats = await getMerchantExpenseDashboard(merchantUserId);
  return { stats };
}

export async function getAdminModelIncomeStats(modelUserId: number) {
  await assertUserRole(modelUserId, 1);
  const [stats, wallet, allTimeIncomeYuan, lifetimeOrderCount] = await Promise.all([
    getModelDashboard(modelUserId),
    walletBalanceForAdmin(modelUserId),
    modelSettledIncomeSum(modelUserId, LIFETIME_START, LIFETIME_END).then((n) =>
      Number(n.toFixed(2))
    ),
    modelOrderCount(modelUserId, LIFETIME_START, LIFETIME_END)
  ]);
  return {
    stats,
    wallet,
    allTimeIncomeYuan,
    lifetimeOrderCount
  };
}

export async function getAdminBrokerIncomeStats(brokerUserId: number) {
  await assertUserRole(brokerUserId, 3);
  const [stats, wallet, brokerSum] = await Promise.all([
    getBrokerDashboard(brokerUserId),
    walletBalanceForAdmin(brokerUserId),
    sumBrokerIncome(brokerUserId, LIFETIME_START, LIFETIME_END)
  ]);
  const allTimeIncomeYuan = Number(brokerSum.toFixed(2));
  return {
    stats,
    wallet,
    allTimeIncomeYuan
  };
}
