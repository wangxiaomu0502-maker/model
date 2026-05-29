import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import {
  generateUnlimitedWxacode,
  generateWechatUrlLink,
  WECHAT_URL_LINK_MAX_EXPIRE_DAYS
} from "../../integrations/wechat/client";
import { findUserProfileById } from "../user/user.repository";

const BROKER_PROMO_LOADING_PATH = "/pages/loading/loading";
const BROKER_QUERY_KEY = "brokerUserNo";

export type BrokerPromoUrlLinkPayload = {
  urlLink: string;
  expireDays: number;
  maxExpireDays: number;
  userNo: string;
  miniProgramPath: string;
};

export async function createBrokerPromoUrlLink(
  userId: number,
  role: number
): Promise<BrokerPromoUrlLinkPayload> {
  if (Number(role) !== 3 && Number(role) !== 4) {
    throw new AppError("仅经纪人或代理人可生成推广链接", 403, ErrorCodes.FORBIDDEN);
  }

  const user = await findUserProfileById(userId);
  if (!user) {
    throw new AppError("用户不存在", 404, ErrorCodes.NOT_FOUND);
  }

  const userNo = String(user.user_no || "").trim();
  if (!userNo) {
    throw new AppError("用户编号缺失，无法生成推广链接", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const query = `${BROKER_QUERY_KEY}=${encodeURIComponent(userNo)}`;
  const { urlLink, expireDays } = await generateWechatUrlLink({
    path: BROKER_PROMO_LOADING_PATH,
    query,
    expireDays: WECHAT_URL_LINK_MAX_EXPIRE_DAYS
  });

  return {
    urlLink,
    expireDays,
    maxExpireDays: WECHAT_URL_LINK_MAX_EXPIRE_DAYS,
    userNo,
    miniProgramPath: `pages/loading/loading?${BROKER_QUERY_KEY}=${userNo}`
  };
}

export async function createBrokerPromoWxacode(userId: number, role: number): Promise<{
  buffer: Buffer;
  userNo: string;
  scene: string;
}> {
  if (Number(role) !== 3 && Number(role) !== 4) {
    throw new AppError("仅经纪人或代理人可生成推广二维码", 403, ErrorCodes.FORBIDDEN);
  }

  const user = await findUserProfileById(userId);
  if (!user) {
    throw new AppError("用户不存在", 404, ErrorCodes.NOT_FOUND);
  }

  const userNo = String(user.user_no || "").trim();
  if (!userNo) {
    throw new AppError("用户编号缺失，无法生成推广二维码", 400, ErrorCodes.VALIDATION_ERROR);
  }

  // scene 最长 32 字符：直接传 user_no，避免 key=value 在部分端解析不一致
  const scene = userNo;
  const buffer = await generateUnlimitedWxacode({
    page: BROKER_PROMO_LOADING_PATH,
    scene
  });

  return { buffer, userNo, scene };
}
