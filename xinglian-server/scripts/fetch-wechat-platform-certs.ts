/**
 * 尝试拉取微信平台证书（平台证书模式备用）。
 * 公钥模式下回调验签仍需 wechatpay_public.pem。
 */
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import {
  buildWechatPayAuthorization,
  decryptWechatPayResource
} from "../src/integrations/wechat/pay/wechat-pay.crypto";

dotenv.config();

const HOST = "https://api.mch.weixin.qq.com";
const urlPath = "/v3/certificates";

async function main(): Promise<void> {
  const mchId = process.env.WECHAT_PAY_MCH_ID;
  const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
  const serialNo = process.env.WECHAT_PAY_SERIAL_NO;
  const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH;
  if (!mchId || !apiV3Key || !serialNo || !privateKeyPath) {
    console.error("缺少 WECHAT_PAY_* 环境变量");
    process.exit(1);
  }

  const privateKeyPem = fs.readFileSync(path.resolve(privateKeyPath), "utf8");
  const { authorization } = buildWechatPayAuthorization({
    mchId,
    serialNo,
    privateKeyPem,
    method: "GET",
    urlPath,
    body: ""
  });

  const res = await fetch(`${HOST}${urlPath}`, {
    method: "GET",
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Accept-Language": "zh-CN"
    }
  });
  const json = (await res.json()) as {
    data?: Array<{
      serial_no?: string;
      effective_time?: string;
      expire_time?: string;
      encrypt_certificate?: {
        algorithm?: string;
        nonce?: string;
        associated_data?: string;
        ciphertext?: string;
      };
    }>;
    code?: string;
    message?: string;
  };

  if (!res.ok) {
    console.error("请求失败", res.status, json.message || json.code || json);
    process.exit(1);
  }

  const outDir = path.resolve(__dirname, "../certs");
  fs.mkdirSync(outDir, { recursive: true });

  for (const item of json.data || []) {
    const enc = item.encrypt_certificate;
    if (!enc?.ciphertext || !enc.nonce) continue;
    const pem = decryptWechatPayResource({
      apiV3Key,
      associatedData: enc.associated_data || "certificate",
      nonce: enc.nonce,
      ciphertextB64: enc.ciphertext
    });
    const serial = item.serial_no || "unknown";
    const outPath = path.join(outDir, `wechatpay_platform_${serial}.pem`);
    fs.writeFileSync(outPath, pem, "utf8");
    console.log("saved", outPath);
  }

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
