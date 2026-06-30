import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";
import { generateUnlimitedWxacode } from "../../integrations/wechat/client";
import { findUserProfileById } from "../user/user.repository";

const MODEL_PROMO_LOADING_PATH = "pages/loading/loading";
/** 与经纪人纯 userNo scene 区分，避免扫码进 loading 时被当成经纪人推广 */
const MODEL_SCENE_PREFIX = "md_";

export async function createModelPromoWxacode(userId: number, role: number): Promise<{
  buffer: Buffer;
  userNo: string;
  scene: string;
}> {
  if (Number(role) !== 1) {
    throw new AppError("仅模特可生成推广二维码", 403, ErrorCodes.FORBIDDEN);
  }

  const user = await findUserProfileById(userId);
  if (!user) {
    throw new AppError("用户不存在", 404, ErrorCodes.NOT_FOUND);
  }

  const userNo = String(user.user_no || "").trim();
  if (!userNo) {
    throw new AppError("用户编号缺失，无法生成推广二维码", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const scene = `${MODEL_SCENE_PREFIX}${userNo}`;
  if (scene.length > 32) {
    throw new AppError("用户编号过长，无法生成推广二维码", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const buffer = await generateUnlimitedWxacode({
    page: MODEL_PROMO_LOADING_PATH,
    scene
  });

  return { buffer, userNo, scene };
}
