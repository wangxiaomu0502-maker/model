function formatMoneyYuan(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

function normalizeTrend(trend7d) {
  const arr = Array.isArray(trend7d) ? trend7d : [];
  const nums = arr.map((x) => Number(x.income) || 0);
  const maxIncome = nums.length === 0 ? 0 : Math.max(...nums);
  const denom = maxIncome > 0 ? maxIncome : 1;
  return arr.map((item) => {
    const income = Number(item.income) || 0;
    const rawPct = Math.round((income / denom) * 100);
    const barPct = income <= 0 ? 6 : Math.max(12, rawPct);
    const dk = String(item.date || "");
    return {
      date: dk,
      label: dk.length >= 10 ? dk.slice(5, 10) : dk,
      incomeText: formatMoneyYuan(income),
      barPct
    };
  });
}

function requestWithAuth(url, method, data) {
  const app = getApp();
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBaseUrl}${url}`,
      method,
      data,
      header: {
        "content-type": "application/json",
        Authorization: `Bearer ${app.globalData.token || ""}`
      },
      success: (res) => resolve(res.data),
      fail: reject
    });
  });
}

module.exports = { formatMoneyYuan, normalizeTrend, requestWithAuth };
