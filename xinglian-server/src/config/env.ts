import dotenv from "dotenv";

dotenv.config();

function normalizedEnvValue(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

const port = Number(process.env.PORT ?? 3000);
const dbPort = Number(process.env.DB_PORT ?? 3306);
const dbConnectionLimit = Number(process.env.DB_CONNECTION_LIMIT ?? 10);
const wechatAppId = normalizedEnvValue(process.env.WECHAT_APP_ID);
const wechatAppSecret = normalizedEnvValue(process.env.WECHAT_APP_SECRET);
const jwtSecret = normalizedEnvValue(process.env.JWT_SECRET);
const jwtExpiresIn = normalizedEnvValue(process.env.JWT_EXPIRES_IN) ?? "7d";
const cosSecretId = normalizedEnvValue(process.env.TENCENT_SECRET_ID);
const cosSecretKey = normalizedEnvValue(process.env.TENCENT_SECRET_KEY);
const cosBucket = normalizedEnvValue(process.env.COS_BUCKET);
const cosRegion = normalizedEnvValue(process.env.COS_REGION);
const ocrRegion = normalizedEnvValue(process.env.OCR_REGION) ?? cosRegion;
const cosPublicBaseUrl =
  normalizedEnvValue(process.env.COS_PUBLIC_BASE_URL) ??
  (cosBucket && cosRegion
    ? `https://${cosBucket}.cos.${cosRegion}.myqcloud.com`
    : "");

if (Number.isNaN(port)) {
  throw new Error("PORT must be a valid number.");
}

if (Number.isNaN(dbPort)) {
  throw new Error("DB_PORT must be a valid number.");
}

if (Number.isNaN(dbConnectionLimit)) {
  throw new Error("DB_CONNECTION_LIMIT must be a valid number.");
}

if (!wechatAppId) {
  throw new Error("WECHAT_APP_ID is required.");
}

if (!wechatAppSecret) {
  throw new Error("WECHAT_APP_SECRET is required.");
}

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required.");
}

if (!cosSecretId) {
  throw new Error("TENCENT_SECRET_ID is required.");
}

if (!/^AKID[0-9A-Za-z]+$/.test(cosSecretId)) {
  throw new Error("TENCENT_SECRET_ID format invalid, must start with AKID.");
}

if (!cosSecretKey) {
  throw new Error("TENCENT_SECRET_KEY is required.");
}

if (!cosBucket) {
  throw new Error("COS_BUCKET is required.");
}

if (!cosRegion) {
  throw new Error("COS_REGION is required.");
}

if (!ocrRegion) {
  throw new Error("OCR_REGION is required.");
}

if (!cosPublicBaseUrl) {
  throw new Error("COS_PUBLIC_BASE_URL is required.");
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port,
  wechat: {
    appId: wechatAppId,
    appSecret: wechatAppSecret
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: jwtExpiresIn
  },
  cos: {
    secretId: cosSecretId,
    secretKey: cosSecretKey,
    bucket: cosBucket,
    region: cosRegion,
    publicBaseUrl: cosPublicBaseUrl
  },
  ocr: {
    region: ocrRegion
  },
  db: {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: dbPort,
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "xinglian",
    connectionLimit: dbConnectionLimit
  }
};
