import { NextFunction, Request, Response } from "express";

import { ErrorCodes } from "../../core/constants/error-codes";
import { fail, success } from "../../core/http/response";
import { AdminAuthenticatedRequest } from "../../middlewares/require-admin-auth";

import { previewOrderSplitForAdmin, runManualOrderSplitForAdmin } from "./admin-order-split.service";
import {
  getOrderDetailForAdmin,
  listOrdersForAdmin,
  listOrdersForAdminByMerchant,
  listOrdersForAdminByModel
} from "./admin-order.service";
import { getAdminPlatformBilling } from "./admin-platform-billing.service";
import { getAdminPlatformLedger } from "./admin-platform-ledger.service";
import {
  getAdminBrokerIncomeStats,
  getAdminMerchantExpenseStats,
  getAdminModelIncomeStats
} from "./admin-user-finance-stats.service";
import {
  getAdminDashboardStats,
  getModelBasicDetailForAdmin,
  getMerchantBasicDetailForAdmin,
  getBrokerBasicDetailForAdmin,
  listBoundMerchantsForBrokerAdmin,
  listUsersForAdminByRole,
  reviewModelContentForAdmin,
  reviewModelProfileAuditForAdmin,
  setModelAgentUserForAdmin,
  setModelAccountStatusForAdmin,
  setBrokerAccountStatusForAdmin,
  setModelLevelOverrideForAdmin,
  setModelPlatformFeaturedForAdmin,
  setModelPhotosDisabledForAdmin,
  setModelActivatedForAdmin,
  setModelSortOrderForAdmin,
  setMerchantBrokerForAdmin
} from "./admin.service";
import {
  AdminModelAgentBody,
  AdminModelAccountStatusBody,
  AdminBrokerAccountStatusBody,
  AdminModelFeaturedBody,
  AdminModelLevelBody,
  AdminModelPhotosDisabledBody,
  AdminModelActivatedBody,
  AdminModelSortOrderBody,
  AdminMerchantBrokerBody,
  AdminModelContentReviewBody,
  AdminModelProfileAuditBody,
  AdminPlatformLedgerQuery,
  AdminUserIdParam,
  AdminUserListQuery,
  AdminUsersByRoleQuery
} from "./admin.types";

export async function adminDashboardStatsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const stats = await getAdminDashboardStats();
    success(res, stats as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

/** 管理端探活，便于与 /api/health 区分环境 */
export function adminHealthController(_req: Request, res: Response): void {
  success(res, {
    scope: "admin",
    message: "admin api ok"
  });
}

export async function adminListOrdersController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const q = req.query as unknown as AdminUserListQuery;
    const data = await listOrdersForAdmin(q.page, q.pageSize);
    success(res, data as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminPlatformBillingController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const q = req.query as unknown as AdminUserListQuery;
    const data = await getAdminPlatformBilling(q.page, q.pageSize);
    success(res, data as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminPlatformLedgerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const q = req.query as unknown as AdminPlatformLedgerQuery;
    const data = await getAdminPlatformLedger(q.page, q.pageSize, {
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      keyword: q.keyword,
      settleStatus: q.settleStatus
    });
    success(res, data as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminGetOrderDetailController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { orderId } = req.params as unknown as { orderId: string };
    const detail = await getOrderDetailForAdmin(Number(orderId));
    if (!detail) {
      fail(req, res, 404, { code: ErrorCodes.NOT_FOUND, message: "order not found" });
      return;
    }
    success(res, { order: detail } as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminGetOrderSplitPreviewController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { orderId } = req.params as unknown as { orderId: string };
    const preview = await previewOrderSplitForAdmin(Number(orderId));
    success(res, { preview } as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminPostOrderSplitController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { orderId } = req.params as unknown as { orderId: string };
    const detail = await runManualOrderSplitForAdmin(Number(orderId), adminAuth.adminUserId);
    success(res, { order: detail } as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminListUsersWithRoleQueryController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const q = req.query as unknown as AdminUsersByRoleQuery;
    const data = await listUsersForAdminByRole(q.page, q.pageSize, q.role, {
      profileAuditStatus: q.profileAuditStatus,
      modelLevel: q.modelLevel
    });
    return success(res, data as Record<string, unknown>);
  } catch (error) {
    return next(error);
  }
}

export function createAdminListUsersByRoleController(role: number) {
  return async function adminListUsersByRoleController(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
      if (!adminAuth?.adminUserId) {
        fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
        return;
      }
      const q = req.query as unknown as AdminUserListQuery;
      const data = await listUsersForAdminByRole(q.page, q.pageSize, role, {
        profileAuditStatus: q.profileAuditStatus,
        modelLevel: q.modelLevel
      });
      success(res, data as Record<string, unknown>);
    } catch (error) {
      next(error);
    }
  };
}

export async function adminGetModelDetailController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const basicInfo = await getModelBasicDetailForAdmin(userId);
    success(res, { basicInfo });
  } catch (error) {
    next(error);
  }
}

export async function adminListModelOrdersController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const q = req.query as unknown as AdminUserListQuery;
    const data = await listOrdersForAdminByModel(userId, q.page, q.pageSize);
    success(res, data as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminGetMerchantDetailController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const basicInfo = await getMerchantBasicDetailForAdmin(userId);
    success(res, { basicInfo });
  } catch (error) {
    next(error);
  }
}

export async function adminGetMerchantExpenseStatsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const data = await getAdminMerchantExpenseStats(userId);
    success(res, data as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminGetModelIncomeStatsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const data = await getAdminModelIncomeStats(userId);
    success(res, data as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminListMerchantOrdersController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const q = req.query as unknown as AdminUserListQuery;
    const data = await listOrdersForAdminByMerchant(userId, q.page, q.pageSize);
    success(res, data as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminGetBrokerDetailController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const basicInfo = await getBrokerBasicDetailForAdmin(userId);
    success(res, { basicInfo });
  } catch (error) {
    next(error);
  }
}

export async function adminGetBrokerIncomeStatsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const data = await getAdminBrokerIncomeStats(userId);
    success(res, data as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminListBrokerBoundMerchantsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const q = req.query as unknown as AdminUserListQuery;
    const data = await listBoundMerchantsForBrokerAdmin(userId, q.page, q.pageSize);
    success(res, data as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminSetModelAgentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const body = req.body as AdminModelAgentBody;
    const result = await setModelAgentUserForAdmin(userId, body.agentUserId);
    success(res, result as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminSetModelFeaturedController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const body = req.body as AdminModelFeaturedBody;
    const result = await setModelPlatformFeaturedForAdmin(userId, body.isPlatformFeatured);
    success(res, result as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminSetModelPhotosDisabledController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const body = req.body as AdminModelPhotosDisabledBody;
    const result = await setModelPhotosDisabledForAdmin(userId, body.photosDisabled);
    success(res, result as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminSetModelActivatedController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const body = req.body as AdminModelActivatedBody;
    const result = await setModelActivatedForAdmin(userId, body.isActivated);
    success(res, result as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminSetModelAccountStatusController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const body = req.body as AdminModelAccountStatusBody;
    const result = await setModelAccountStatusForAdmin(userId, body.status as 1 | 2);
    success(res, result as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminSetBrokerAccountStatusController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const body = req.body as AdminBrokerAccountStatusBody;
    const result = await setBrokerAccountStatusForAdmin(userId, body.status as 1 | 2);
    success(res, result as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminSetModelLevelController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const body = req.body as AdminModelLevelBody;
    const result = await setModelLevelOverrideForAdmin(userId, body.modelLevelOverride);
    success(res, result as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminSetModelSortOrderController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const body = req.body as AdminModelSortOrderBody;
    const result = await setModelSortOrderForAdmin(userId, body.sortOrder);
    success(res, result as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminSetMerchantBrokerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const body = req.body as AdminMerchantBrokerBody;
    const result = await setMerchantBrokerForAdmin(userId, body.brokerUserId);
    success(res, result as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminReviewModelProfileAuditController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const body = req.body as AdminModelProfileAuditBody;
    const result = await reviewModelProfileAuditForAdmin(userId, body.decision, body.rejectReason);
    success(res, result as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}

export async function adminReviewModelContentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminAuth = (req as AdminAuthenticatedRequest).adminAuth;
    if (!adminAuth?.adminUserId) {
      fail(req, res, 401, { code: ErrorCodes.UNAUTHORIZED, message: "unauthorized" });
      return;
    }
    const { userId } = req.params as unknown as AdminUserIdParam;
    const body = req.body as AdminModelContentReviewBody;
    const result = await reviewModelContentForAdmin(
      userId,
      body.section,
      body.decision,
      body.rejectReason,
      body.photoIds
    );
    success(res, result as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
}
