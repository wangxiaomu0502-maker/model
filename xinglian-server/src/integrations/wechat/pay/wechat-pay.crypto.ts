import crypto from "node:crypto";

const AUTH_TAG_LEN = 16;

export function randomNonceStr(length = 32): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

export function signSha256Rsa(message: string, privateKeyPem: string): string {
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(message);
  sign.end();
  return sign.sign(privateKeyPem, "base64");
}

export function verifySha256Rsa(message: string, signatureB64: string, publicKeyPem: string): boolean {
  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(message);
  verify.end();
  return verify.verify(publicKeyPem, signatureB64, "base64");
}

/** 商户请求微信 API 的 Authorization 头 */
export function buildWechatPayAuthorization(params: {
  mchId: string;
  serialNo: string;
  privateKeyPem: string;
  method: string;
  urlPath: string;
  body: string;
}): { authorization: string; timestamp: string; nonce: string } {
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const nonce = randomNonceStr(32);
  const message = `${params.method}\n${params.urlPath}\n${timestamp}\n${nonce}\n${params.body}\n`;
  const signature = signSha256Rsa(message, params.privateKeyPem);
  const authorization =
    `WECHATPAY2-SHA256-RSA2048 mchid="${params.mchId}",` +
    `nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${params.serialNo}",signature="${signature}"`;
  return { authorization, timestamp, nonce };
}

/** 小程序调起支付 paySign */
export function buildMiniProgramPaySign(params: {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  privateKeyPem: string;
}): string {
  const message = `${params.appId}\n${params.timeStamp}\n${params.nonceStr}\n${params.package}\n`;
  return signSha256Rsa(message, params.privateKeyPem);
}

/** 验签微信支付回调（公钥模式） */
export function verifyWechatPayNotifySignature(params: {
  timestamp: string;
  nonce: string;
  body: string;
  signature: string;
  publicKeyPem: string;
}): boolean {
  const message = `${params.timestamp}\n${params.nonce}\n${params.body}\n`;
  return verifySha256Rsa(message, params.signature, params.publicKeyPem);
}

/** 解密 APIv3 回调 resource */
export function decryptWechatPayResource(params: {
  apiV3Key: string;
  associatedData: string;
  nonce: string;
  ciphertextB64: string;
}): string {
  const key = Buffer.from(params.apiV3Key, "utf8");
  if (key.length !== 32) {
    throw new Error("APIv3 key must be 32 bytes");
  }
  const buf = Buffer.from(params.ciphertextB64, "base64");
  if (buf.length <= AUTH_TAG_LEN) {
    throw new Error("invalid ciphertext");
  }
  const authTag = buf.subarray(buf.length - AUTH_TAG_LEN);
  const data = buf.subarray(0, buf.length - AUTH_TAG_LEN);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(params.nonce, "utf8"));
  decipher.setAuthTag(authTag);
  if (params.associatedData) {
    decipher.setAAD(Buffer.from(params.associatedData, "utf8"));
  }
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
