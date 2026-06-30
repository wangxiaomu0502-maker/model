const DEFAULT_MESSAGE = "系统维护中，请稍后再试";

function requestPlatformMaintenanceStatus(apiBaseUrl) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${apiBaseUrl}/api/system-settings/platform-maintenance`,
      method: "GET",
      success: (res) => {
        const data = res.data || {};
        if (!data.ok) {
          reject(new Error(data.message || "维护状态获取失败"));
          return;
        }
        resolve({
          maintenanceEnabled: data.maintenanceEnabled === true,
          maintenanceMessage: String(data.maintenanceMessage || DEFAULT_MESSAGE).trim() || DEFAULT_MESSAGE
        });
      },
      fail: (err) => reject(err)
    });
  });
}

module.exports = {
  DEFAULT_MESSAGE,
  requestPlatformMaintenanceStatus
};
