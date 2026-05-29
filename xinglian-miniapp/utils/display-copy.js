/** 审核展示用：将接口/合同模板中的「商家/商户/入驻」等措辞转为中性文案（不改业务逻辑） */
function sanitizeReviewCopy(text) {
  if (text == null || text === "") return text;
  return String(text)
    .replace(/商家/g, "客户")
    .replace(/商户/g, "客户")
    .replace(/入驻/g, "注册");
}

module.exports = {
  sanitizeReviewCopy
};
