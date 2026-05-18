import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../../config/env";
import { ErrorCodes } from "../../core/constants/error-codes";
import { AppError } from "../../core/errors/app-error";

import { findAdminUserByUsername } from "./admin-auth.repository";

export async function loginAdmin(username: string, password: string): Promise<{
  token: string;
  admin: {
    id: number;
    username: string;
    displayName: string | null;
  };
}> {
  const row = await findAdminUserByUsername(username);
  const invalidMsg = "账号或密码错误";

  if (!row || row.status !== 1) {
    throw new AppError(invalidMsg, 401, ErrorCodes.UNAUTHORIZED);
  }

  const match = await bcrypt.compare(password, row.password_hash);
  if (!match) {
    throw new AppError(invalidMsg, 401, ErrorCodes.UNAUTHORIZED);
  }

  const token = jwt.sign(
    {
      scope: "admin",
      adminUserId: row.id
    },
    env.jwt.secret,
    {
      expiresIn: env.jwt.expiresIn as jwt.SignOptions["expiresIn"]
    }
  );

  return {
    token,
    admin: {
      id: row.id,
      username: row.username,
      displayName: row.display_name
    }
  };
}
