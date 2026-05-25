import { RowDataPacket } from "mysql2";

export type WechatCode2SessionResponse = {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
};

export type WechatAccessTokenResponse = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

export type WechatPhoneResponse = {
  phone_info?: {
    phoneNumber: string;
    purePhoneNumber: string;
    countryCode: string;
  };
  errcode?: number;
  errmsg?: string;
};

export type ExistingUserRow = RowDataPacket & {
  id: number;
  openid: string;
};

export type LoginUserRow = RowDataPacket & {
  id: number;
  user_no: string;
  openid: string;
  role: number;
};

export type PlatformBindModelRow = RowDataPacket & {
  id: number;
  user_no: string;
  openid: string;
  role: number;
  unionid: string | null;
};

export const PLATFORM_MODEL_BIND_FAIL_MESSAGE =
  "平台暂未帮您绑定账号，请联系管理员";

export const identityRoleMap: Record<string, number> = {
  模特: 1,
  商家: 2,
  经纪人: 3,
  代理人: 4
};
