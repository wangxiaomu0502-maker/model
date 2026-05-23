import fs from "node:fs";

import { env } from "../../../config/env";
import { AppError } from "../../../core/errors/app-error";
import { ErrorCodes } from "../../../core/constants/error-codes";
import { appendPaymentOperationLogSafe } from "../../../modules/pay/payment-log.repository";
import {
  buildMiniProgramPaySign,
  buildWechatPayAuthorization,
  decryptWechatPayResource,
  randomNonceStr,
  verifyWechatPayNotifySignature
} from "./wechat-pay.crypto";

const WECHAT_PAY_API_HOST = "https://api.mch.weixin.qq.com";

type JsapiPrepayResponse = {
  prepay_id?: string;
};

type WechatRefundResponse = {
  refund_id?: string;
  out_refund_no?: string;
  status?: string;
  code?: string;
  message?: string;
};

type WechatRefundQueryResponse = WechatRefundResponse & {
  amount?: {
    refund?: number;
    total?: number;
    currency?: string;
  };
};

type WechatOrderQueryResponse = {
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  amount?: {
    total?: number;
    payer_total?: number;
    currency?: string;
  };
  code?: string;
  message?: string;
};

function readPem(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    throw new AppError(`无法读取证书/密钥文件: ${filePath}`, 500, ErrorCodes.INTERNAL_ERROR);
  }
}

function loadWechatPayPublicKeyPem(pay: {
  publicKeyPath: string;
  publicKeyPem?: string;
}): string {
  const inline = pay.publicKeyPem?.trim();
  if (inline && inline.includes("BEGIN")) {
    return inline;
  }
  return readPem(pay.publicKeyPath);
}

function getPayConfig() {
  const pay = env.wechatPay;
  if (!pay?.enabled) {
    throw new AppError("微信支付未配置", 503, ErrorCodes.INTERNAL_ERROR);
  }
  return pay;
}

export function isWechatPayConfigured(): boolean {
  return Boolean(env.wechatPay?.enabled);
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

/** 创建 JSAPI 预支付并返回小程序调起参数 */
export async function createJsapiPrepay(params: {
  description: string;
  outTradeNo: string;
  totalFen: number;
  payerOpenid: string;
}): Promise<{
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: "RSA";
  paySign: string;
}> {
  const pay = getPayConfig();
  if (params.totalFen < 1) {
    throw new AppError("支付金额无效", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const privateKeyPem = readPem(pay.privateKeyPath);
  const urlPath = "/v3/pay/transactions/jsapi";
  const bodyObj = {
    appid: env.wechat.appId,
    mchid: pay.mchId,
    description: params.description.slice(0, 127),
    out_trade_no: params.outTradeNo,
    notify_url: pay.notifyUrl,
    amount: {
      total: params.totalFen,
      currency: "CNY"
    },
    payer: {
      openid: params.payerOpenid
    }
  };
  const body = JSON.stringify(bodyObj);
  appendPaymentOperationLogSafe({
    eventType: "wechat_prepay",
    orderNo: params.outTradeNo,
    direction: "request",
    requestJson: {
      outTradeNo: params.outTradeNo,
      totalFen: params.totalFen,
      description: bodyObj.description,
      payerOpenid: "***"
    }
  });
  const { authorization } = buildWechatPayAuthorization({
    mchId: pay.mchId,
    serialNo: pay.serialNo,
    privateKeyPem,
    method: "POST",
    urlPath,
    body
  });

  const response = await fetch(`${WECHAT_PAY_API_HOST}${urlPath}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Accept-Language": "zh-CN",
      "Content-Type": "application/json"
    },
    body
  });

  const result = await readJsonResponse<JsapiPrepayResponse & {
    code?: string;
    message?: string;
  }>(response);

  appendPaymentOperationLogSafe({
    eventType: "wechat_prepay",
    orderNo: params.outTradeNo,
    direction: "response",
    responseJson: {
      status: response.status,
      ok: response.ok,
      prepayId: result.prepay_id ? "***" : undefined,
      code: result.code,
      message: result.message
    },
    errorMessage: response.ok ? null : result.message || result.code || `HTTP ${response.status}`
  });

  if (!response.ok || !result.prepay_id) {
    const detail = result.message || result.code || `HTTP ${response.status}`;
    throw new AppError(`微信下单失败: ${detail}`, 502, ErrorCodes.UPSTREAM_ERROR);
  }

  const timeStamp = `${Math.floor(Date.now() / 1000)}`;
  const nonceStr = randomNonceStr(32);
  const pkg = `prepay_id=${result.prepay_id}`;
  const paySign = buildMiniProgramPaySign({
    appId: env.wechat.appId,
    timeStamp,
    nonceStr,
    package: pkg,
    privateKeyPem
  });

  return {
    timeStamp,
    nonceStr,
    package: pkg,
    signType: "RSA",
    paySign
  };
}

/** 发起微信支付原路退款。退款结果可能是 SUCCESS，也可能先返回 PROCESSING。 */
export async function createWechatRefund(params: {
  outTradeNo: string;
  transactionId?: string | null;
  outRefundNo: string;
  totalFen: number;
  refundFen: number;
  reason: string;
}): Promise<{
  refundId: string | null;
  outRefundNo: string;
  status: string;
}> {
  const pay = getPayConfig();
  if (params.totalFen < 1 || params.refundFen < 1 || params.refundFen > params.totalFen) {
    throw new AppError("退款金额无效", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const privateKeyPem = readPem(pay.privateKeyPath);
  const urlPath = "/v3/refund/domestic/refunds";
  const bodyObj = {
    transaction_id: params.transactionId || undefined,
    out_trade_no: params.transactionId ? undefined : params.outTradeNo,
    out_refund_no: params.outRefundNo,
    reason: params.reason.slice(0, 80),
    amount: {
      refund: params.refundFen,
      total: params.totalFen,
      currency: "CNY"
    }
  };
  const body = JSON.stringify(bodyObj);
  appendPaymentOperationLogSafe({
    eventType: "wechat_refund",
    orderNo: params.outTradeNo,
    refundNo: params.outRefundNo,
    direction: "request",
    requestJson: {
      outTradeNo: params.outTradeNo,
      transactionId: params.transactionId || null,
      outRefundNo: params.outRefundNo,
      refundFen: params.refundFen,
      totalFen: params.totalFen,
      reason: params.reason.slice(0, 80)
    }
  });
  const { authorization } = buildWechatPayAuthorization({
    mchId: pay.mchId,
    serialNo: pay.serialNo,
    privateKeyPem,
    method: "POST",
    urlPath,
    body
  });

  const response = await fetch(`${WECHAT_PAY_API_HOST}${urlPath}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Accept-Language": "zh-CN",
      "Content-Type": "application/json"
    },
    body
  });

  const result = await readJsonResponse<WechatRefundResponse>(response);
  appendPaymentOperationLogSafe({
    eventType: "wechat_refund",
    orderNo: params.outTradeNo,
    refundNo: params.outRefundNo,
    wechatRefundId: result.refund_id || null,
    refundStatus: result.status || null,
    direction: "response",
    responseJson: {
      status: response.status,
      ok: response.ok,
      refundId: result.refund_id,
      outRefundNo: result.out_refund_no,
      refundStatus: result.status,
      code: result.code,
      message: result.message
    },
    errorMessage: response.ok ? null : result.message || result.code || `HTTP ${response.status}`
  });
  if (!response.ok) {
    const detail = result.message || result.code || `HTTP ${response.status}`;
    throw new AppError(`微信退款失败: ${detail}`, 502, ErrorCodes.UPSTREAM_ERROR);
  }

  return {
    refundId: result.refund_id || null,
    outRefundNo: result.out_refund_no || params.outRefundNo,
    status: result.status || "PROCESSING"
  };
}

/** 查询退款单状态，用于 PROCESSING 后续补偿。 */
export async function queryWechatRefundByOutRefundNo(outRefundNo: string): Promise<{
  refundId: string | null;
  outRefundNo: string;
  status: string;
}> {
  const pay = getPayConfig();
  if (!outRefundNo) {
    throw new AppError("缺少商户退款单号，无法查询退款", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const privateKeyPem = readPem(pay.privateKeyPath);
  const encodedOutRefundNo = encodeURIComponent(outRefundNo);
  const urlPath = `/v3/refund/domestic/refunds/${encodedOutRefundNo}`;
  appendPaymentOperationLogSafe({
    eventType: "wechat_query_refund",
    refundNo: outRefundNo,
    direction: "request",
    requestJson: { outRefundNo }
  });
  const { authorization } = buildWechatPayAuthorization({
    mchId: pay.mchId,
    serialNo: pay.serialNo,
    privateKeyPem,
    method: "GET",
    urlPath,
    body: ""
  });

  const response = await fetch(`${WECHAT_PAY_API_HOST}${urlPath}`, {
    method: "GET",
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Accept-Language": "zh-CN"
    }
  });

  const result = await readJsonResponse<WechatRefundQueryResponse>(response);
  appendPaymentOperationLogSafe({
    eventType: "wechat_query_refund",
    refundNo: outRefundNo,
    wechatRefundId: result.refund_id || null,
    refundStatus: result.status || null,
    direction: "response",
    responseJson: {
      status: response.status,
      ok: response.ok,
      refundId: result.refund_id,
      outRefundNo: result.out_refund_no,
      refundStatus: result.status,
      amount: result.amount,
      code: result.code,
      message: result.message
    },
    errorMessage: response.ok ? null : result.message || result.code || `HTTP ${response.status}`
  });
  if (!response.ok) {
    const detail = result.message || result.code || `HTTP ${response.status}`;
    throw new AppError(`微信退款查单失败: ${detail}`, 502, ErrorCodes.UPSTREAM_ERROR);
  }

  return {
    refundId: result.refund_id || null,
    outRefundNo: result.out_refund_no || outRefundNo,
    status: result.status || "PROCESSING"
  };
}

/** 关闭未支付的微信支付订单；用于用户取消支付或未支付订单取消。 */
export async function closeWechatOrder(outTradeNo: string): Promise<void> {
  const pay = getPayConfig();
  if (!outTradeNo) {
    throw new AppError("缺少商户订单号，无法关单", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const privateKeyPem = readPem(pay.privateKeyPath);
  const encodedOutTradeNo = encodeURIComponent(outTradeNo);
  const urlPath = `/v3/pay/transactions/out-trade-no/${encodedOutTradeNo}/close`;
  const body = JSON.stringify({ mchid: pay.mchId });
  appendPaymentOperationLogSafe({
    eventType: "wechat_close_order",
    orderNo: outTradeNo,
    direction: "request",
    requestJson: { outTradeNo }
  });
  const { authorization } = buildWechatPayAuthorization({
    mchId: pay.mchId,
    serialNo: pay.serialNo,
    privateKeyPem,
    method: "POST",
    urlPath,
    body
  });

  const response = await fetch(`${WECHAT_PAY_API_HOST}${urlPath}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Accept-Language": "zh-CN",
      "Content-Type": "application/json"
    },
    body
  });

  const result = await readJsonResponse<{ code?: string; message?: string }>(response);
  appendPaymentOperationLogSafe({
    eventType: "wechat_close_order",
    orderNo: outTradeNo,
    direction: "response",
    responseJson: {
      status: response.status,
      ok: response.ok,
      code: result.code,
      message: result.message
    },
    errorMessage: response.status === 204 ? null : result.message || result.code || `HTTP ${response.status}`
  });
  if (response.status === 204) return;

  const acceptableCodes = new Set(["ORDERCLOSED", "ORDER_NOT_EXIST", "ORDERNOTEXIST", "RESOURCE_NOT_EXISTS"]);
  if (acceptableCodes.has(String(result.code || ""))) {
    return;
  }

  const detail = result.message || result.code || `HTTP ${response.status}`;
  throw new AppError(`微信关单失败: ${detail}`, 502, ErrorCodes.UPSTREAM_ERROR);
}

/** 主动查询微信支付订单，用于回调延迟/丢失时补偿本地状态。 */
export async function queryWechatOrderByOutTradeNo(outTradeNo: string): Promise<{
  outTradeNo: string;
  transactionId: string;
  tradeState: string;
  totalFen: number | null;
}> {
  const pay = getPayConfig();
  if (!outTradeNo) {
    throw new AppError("缺少商户订单号，无法查单", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const privateKeyPem = readPem(pay.privateKeyPath);
  const encodedOutTradeNo = encodeURIComponent(outTradeNo);
  const query = `mchid=${encodeURIComponent(pay.mchId)}`;
  const urlPath = `/v3/pay/transactions/out-trade-no/${encodedOutTradeNo}?${query}`;
  appendPaymentOperationLogSafe({
    eventType: "wechat_query_order",
    orderNo: outTradeNo,
    direction: "request",
    requestJson: { outTradeNo }
  });
  const { authorization } = buildWechatPayAuthorization({
    mchId: pay.mchId,
    serialNo: pay.serialNo,
    privateKeyPem,
    method: "GET",
    urlPath,
    body: ""
  });

  const response = await fetch(`${WECHAT_PAY_API_HOST}${urlPath}`, {
    method: "GET",
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Accept-Language": "zh-CN"
    }
  });

  const result = await readJsonResponse<WechatOrderQueryResponse>(response);
  appendPaymentOperationLogSafe({
    eventType: "wechat_query_order",
    orderNo: outTradeNo,
    wechatTransactionId: result.transaction_id || null,
    tradeState: result.trade_state || null,
    direction: "response",
    responseJson: {
      status: response.status,
      ok: response.ok,
      outTradeNo: result.out_trade_no,
      transactionId: result.transaction_id,
      tradeState: result.trade_state,
      amount: result.amount,
      code: result.code,
      message: result.message
    },
    errorMessage: response.ok ? null : result.message || result.code || `HTTP ${response.status}`
  });
  if (!response.ok) {
    const detail = result.message || result.code || `HTTP ${response.status}`;
    throw new AppError(`微信查单失败: ${detail}`, 502, ErrorCodes.UPSTREAM_ERROR);
  }

  return {
    outTradeNo: result.out_trade_no || outTradeNo,
    transactionId: result.transaction_id || "",
    tradeState: result.trade_state || "",
    totalFen: typeof result.amount?.total === "number" ? result.amount.total : null
  };
}

export function verifyAndDecryptPayNotify(params: {
  rawBody: string;
  timestamp: string;
  nonce: string;
  signature: string;
  serial: string;
}): {
  outTradeNo: string;
  transactionId: string;
  tradeState: string;
} {
  const pay = getPayConfig();
  if (params.serial !== pay.publicKeyId) {
    throw new AppError("回调证书序列号不匹配", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const publicKeyPem = loadWechatPayPublicKeyPem(pay);
  const ok = verifyWechatPayNotifySignature({
    timestamp: params.timestamp,
    nonce: params.nonce,
    body: params.rawBody,
    signature: params.signature,
    publicKeyPem
  });
  if (!ok) {
    throw new AppError("微信支付回调验签失败", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const envelope = JSON.parse(params.rawBody) as {
    resource?: {
      algorithm?: string;
      ciphertext?: string;
      nonce?: string;
      associated_data?: string;
    };
  };
  const resource = envelope.resource;
  if (!resource?.ciphertext || !resource.nonce) {
    throw new AppError("回调报文缺少 resource", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const plain = decryptWechatPayResource({
    apiV3Key: pay.apiV3Key,
    associatedData: resource.associated_data ?? "",
    nonce: resource.nonce,
    ciphertextB64: resource.ciphertext
  });

  const tx = JSON.parse(plain) as {
    out_trade_no?: string;
    transaction_id?: string;
    trade_state?: string;
  };

  return {
    outTradeNo: String(tx.out_trade_no || ""),
    transactionId: String(tx.transaction_id || ""),
    tradeState: String(tx.trade_state || "")
  };
}
