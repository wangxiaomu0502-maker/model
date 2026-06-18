/** 注册身份 → 须签署的 contract_kind（与后端一致） */
const ROLE_TO_KIND = {
  1: "broker_model",
  2: "platform_merchant",
  3: "platform_broker"
};

const KIND_TYPE_LABEL = {
  broker_model: "平台与模特",
  platform_merchant: "平台协议",
  platform_broker: "合作协议"
};

const PENDING_REGISTRATION_KEY = "pendingRegistration";
const MODEL_REGISTRATION_CODE_KEY = "modelRegistrationCode";

function contractKindForRole(role) {
  return ROLE_TO_KIND[Number(role)] || "";
}

module.exports = {
  ROLE_TO_KIND,
  KIND_TYPE_LABEL,
  PENDING_REGISTRATION_KEY,
  MODEL_REGISTRATION_CODE_KEY,
  contractKindForRole
};
