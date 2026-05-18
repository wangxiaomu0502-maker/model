import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/constants/error-codes";
import { findUserProfileById } from "../user/user.repository";
import {
  ensureMerchantProfile,
  findMerchantProfileByUserId,
  updateMerchantCity
} from "./merchant.repository";

async function ensureMerchantRole(userId: number): Promise<void> {
  const user = await findUserProfileById(userId);
  if (!user) {
    throw new AppError("user not found", 404, ErrorCodes.NOT_FOUND);
  }
  if (Number(user.role) !== 2) {
    throw new AppError("only merchant can access", 403, ErrorCodes.FORBIDDEN);
  }
}

export async function getMerchantBasicInfo(userId: number): Promise<{ city: string }> {
  await ensureMerchantRole(userId);
  await ensureMerchantProfile(userId);
  const profile = await findMerchantProfileByUserId(userId);
  return {
    city: profile?.city || ""
  };
}

export async function saveMerchantBasicInfo(userId: number, city: string): Promise<void> {
  await ensureMerchantRole(userId);
  await ensureMerchantProfile(userId);
  await updateMerchantCity(userId, city);
}

