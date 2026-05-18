const { syncPendingAcceptOrderBadge } = require("../../utils/pending-accept-order-badge.js");

Page({
  /** 服务端 role 可能短暂为 0（同步延迟），本地已有选了身份时用存储兜底，避免菜单被清空 */
  mergeStoredRole(serverRole) {
    const s = Number(serverRole);
    const sr = Number(wx.getStorageSync("selectedRole") || 0);
    const serverOk = Number.isFinite(s) && s >= 1 && s <= 5 ? s : 0;
    const savedOk = Number.isFinite(sr) && sr >= 1 && sr <= 5 ? sr : 0;
    return serverOk !== 0 ? serverOk : savedOk;
  },

  displayUserInfo(app, fallback) {
    const base = {
      nickName: fallback.nickName,
      avatarUrl: fallback.avatarUrl
    };
    const g = app.globalData.userInfo;
    if (!g || typeof g !== "object") return base;
    const nick = g.nickName != null ? String(g.nickName) : "";
    const av = g.avatarUrl != null ? String(g.avatarUrl) : "";
    if (!nick && !av) return base;
    return {
      nickName: nick || fallback.nickName,
      avatarUrl: av || fallback.avatarUrl
    };
  },

  /** 热重载或未再走 onLaunch 时 globalData.role 可能为 0，需与本地 selectedRole 对齐 */
  resolveEffectiveRole(app) {
    const rawSaved = wx.getStorageSync("selectedRole");
    let saved = Number(rawSaved);
    if (!Number.isFinite(saved) || saved < 0 || saved > 5) saved = 0;

    let g = Number(app.globalData.role);
    if (!Number.isFinite(g) || g < 0 || g > 5) g = 0;

    if (app.globalData.token && saved >= 1 && saved <= 5 && g === 0) {
      app.globalData.role = saved;
      app.globalData.identity = this.getIdentityByRole(saved);
      g = saved;
    }

    const mem = Number(app.globalData.role);
    const roleMem = Number.isFinite(mem) && mem >= 0 && mem <= 5 ? mem : 0;
    if (roleMem !== 0) return roleMem;
    if (saved >= 1 && saved <= 5) return saved;
    return 0;
  },

  getIdentityByRole(role) {
    const map = {
      0: "游客",
      1: "模特",
      2: "商家",
      3: "经纪人",
      4: "代理人",
      5: "管理员"
    };
    return map[Number(role)] || "游客";
  },

  getHeaderSubtitleByRole(role) {
    const map = {
      1: "模特资料与平台审核进度",
      2: "商家资料与合作信息",
      3: "资源管理与协作信息",
      4: "账户与业务信息",
      5: "平台管理信息"
    };
    return map[Number(role)] || "个人资料与账户信息";
  },

  data: {
    userInfo: {
      nickName: "未登录用户",
      avatarUrl: "/assets/logo/logo.png"
    },
    identity: "",
    showAuditStatus: false,
    headerSubtitle: "个人资料与账户信息",
    profileAuditStatus: 0,
    profileAuditStatusText: "待提交",
    profileAuditRejectReason: "",
    menus: [],
    pendingModelAcceptOrderCount: 0,
    currentRole: 0,
    showProfileAuditSubmit: false,
    auditSubmitModalVisible: false,
    auditReadinessLoading: false,
    auditSubmitting: false,
    auditReadiness: null
  },

  fetchModelPendingAcceptOrderBadge() {
    const app = getApp();
    const token = app.globalData.token;
    const role = Number(this.resolveEffectiveRole(app));
    syncPendingAcceptOrderBadge({
      apiBaseUrl: app.globalData.apiBaseUrl,
      token,
      role,
      onMineMenuBadgeCount: (n, r) => {
        if (r === 1 || r === 2) this.setData({ pendingModelAcceptOrderCount: n });
        else this.setData({ pendingModelAcceptOrderCount: 0 });
      }
    });
  },

  preventModalBubble() {},

  onTapRejectReasonHint() {
    const reason = String(this.data.profileAuditRejectReason || "").trim();
    const content =
      reason ||
      "暂无文字说明。你可修改资料后重新提交审核，或联系平台客服咨询。";
    wx.showModal({
      title: "失败原因",
      content,
      showCancel: false,
      confirmText: "知道了"
    });
  },

  openAuditSubmitModal() {
    const app = getApp();
    if (!app.globalData.token) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    if (Number(app.globalData.role || 0) !== 1) {
      return;
    }
    this.setData({
      auditSubmitModalVisible: true,
      auditReadinessLoading: true,
      auditReadiness: null
    });
    this.fetchProfileAuditReadiness();
  },

  closeAuditSubmitModal() {
    this.setData({
      auditSubmitModalVisible: false,
      auditReadinessLoading: false,
      auditSubmitting: false
    });
  },

  fetchProfileAuditReadiness() {
    const app = getApp();
    const { apiBaseUrl, token } = app.globalData;
    if (!token) {
      this.setData({ auditReadinessLoading: false });
      return;
    }
    wx.request({
      url: `${apiBaseUrl}/api/models/profile-audit-readiness`,
      method: "GET",
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) {
          wx.showToast({
            title: body.message || "加载完成度失败",
            icon: "none"
          });
          this.setData({
            auditReadinessLoading: false,
            auditSubmitModalVisible: false,
            auditReadiness: null
          });
          return;
        }
        const items = Array.isArray(body.items) ? body.items : [];
        this.setData({
          auditReadinessLoading: false,
          auditReadiness: {
            items,
            allDone: Boolean(body.allDone),
            completedCount: Number(body.completedCount) || 0,
            totalCount: Number(body.totalCount) || 0,
            percent: Number(body.percent) || 0
          }
        });
      },
      fail: () => {
        wx.showToast({ title: "网络异常", icon: "none" });
        this.setData({
          auditReadinessLoading: false,
          auditSubmitModalVisible: false,
          auditReadiness: null
        });
      }
    });
  },

  onConfirmProfileAuditSubmit() {
    const app = getApp();
    const { apiBaseUrl, token } = app.globalData;
    const r = this.data.auditReadiness;
    if (!token || !r || !r.allDone || this.data.auditSubmitting) {
      if (!r || !r.allDone) {
        wx.showToast({ title: "请先完成必填项", icon: "none" });
      }
      return;
    }
    this.setData({ auditSubmitting: true });
    wx.request({
      url: `${apiBaseUrl}/api/models/profile-audit-submit`,
      method: "POST",
      header: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {},
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) {
          wx.showToast({
            title: body.message || "提交失败",
            icon: "none",
            duration: 2500
          });
          return;
        }
        wx.showToast({ title: "已提交审核", icon: "success" });
        this.setData({
          auditSubmitModalVisible: false,
          profileAuditStatus: 1,
          profileAuditStatusText: this.getProfileAuditStatusText(1),
          showProfileAuditSubmit: false
        });
        this.fetchCurrentUser();
      },
      fail: () => {
        wx.showToast({ title: "网络异常", icon: "none" });
      },
      complete: () => {
        this.setData({ auditSubmitting: false });
      }
    });
  },

  getProfileAuditStatusText(status) {
    const map = {
      0: "待提交",
      1: "审核中",
      2: "审核通过",
      3: "审核失败"
    };
    return map[Number(status)] || "未知";
  },

  fetchCurrentUser() {
    const app = getApp();
    if (!app.globalData.token) return;

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/users/me`,
      method: "GET",
      header: {
        Authorization: `Bearer ${app.globalData.token}`
      },
      success: (res) => {
        const status = res.statusCode;
        const body = res.data || {};
        const user = body.user;
        if (status !== 200 || !body.ok || !user) {
          wx.showToast({
            title: body.message || `资料加载失败(${status})`,
            icon: "none",
            duration: 2500
          });
          return;
        }

        const profileAuditStatus = Number(user.profileAuditStatus || 0);
        const profileAuditRejectReason =
          user.profileAuditRejectReason != null ? String(user.profileAuditRejectReason).trim() : "";
        app.globalData.userId = user.id;
        app.globalData.userNo = user.userNo || "";
        const mergedRole = this.mergeStoredRole(user.role);
        app.globalData.role = mergedRole;
        wx.setStorageSync("selectedRole", mergedRole);
        app.globalData.identity = this.getIdentityByRole(app.globalData.role);

        const avatarUrl = app.resolveAvatarUrl(
          user.avatarUrl,
          app.globalData.apiBaseUrl
        );

        const nickName =
          user.nickname ||
          (app.globalData.userInfo && app.globalData.userInfo.nickName) ||
          "用户";

        const userInfo = {
          nickName,
          avatarUrl
        };
        app.globalData.userInfo = userInfo;

        const roleNum = Number(app.globalData.role || 0);
        const showProfileAuditSubmit =
          roleNum === 1 && (profileAuditStatus === 0 || profileAuditStatus === 3);
        this.setData({
          userInfo,
          identity: app.globalData.identity,
          showAuditStatus: roleNum === 1,
          headerSubtitle: this.getHeaderSubtitleByRole(app.globalData.role),
          profileAuditStatus,
          profileAuditStatusText: this.getProfileAuditStatusText(profileAuditStatus),
          profileAuditRejectReason,
          showProfileAuditSubmit,
          currentRole: roleNum,
          menus: this.getMenusByRole(app.globalData.role)
        });
        this.fetchModelPendingAcceptOrderBadge();
      },
      fail: () => {
        wx.showToast({
          title: "网络异常，无法加载资料",
          icon: "none"
        });
      }
    });
  },

  onShow() {
    const app = getApp();
    const role = this.resolveEffectiveRole(app);
    const identity = this.getIdentityByRole(role);
    const fallbackUi = this.data.userInfo;
    const roleNum = Number(role);
    const st = Number(this.data.profileAuditStatus || 0);
    const showProfileAuditSubmit = roleNum === 1 && (st === 0 || st === 3);
    this.setData({
      userInfo: this.displayUserInfo(app, fallbackUi),
      identity,
      showAuditStatus: roleNum === 1,
      headerSubtitle: this.getHeaderSubtitleByRole(role),
      profileAuditStatus: this.data.profileAuditStatus,
      profileAuditStatusText: this.getProfileAuditStatusText(this.data.profileAuditStatus),
      showProfileAuditSubmit,
      currentRole: roleNum,
      menus: this.getMenusByRole(role)
    });
    wx.setNavigationBarTitle({ title: "我的" });
    this.fetchModelPendingAcceptOrderBadge();
    this.fetchCurrentUser();
  },

  getMenusByRole(role) {
    const r = Number(role);
    const contractItem = { name: "合同管理", icon: "同", menuKey: "contracts" };
    const settingsItem = { name: "设置", icon: "设", menuKey: "settings" };

    if (r === 1) {
      return [
        { name: "基础信息", icon: "基", menuKey: "basicInfo" },
        { name: "分类选择", icon: "类", menuKey: "categorySelect" },
        { name: "模卡管理", icon: "卡", menuKey: "modelCard" },
        { name: "作品集", icon: "集", menuKey: "portfolio" },
        { name: "服务价格", icon: "价", menuKey: "pricing" },
        { name: "接单设置", icon: "开", menuKey: "orderSettings" },
        { name: "档期日历", icon: "期", menuKey: "scheduleCalendar" },
        { name: "我的订单", icon: "单", menuKey: "myOrders" },
        { name: "收入明细", icon: "收", menuKey: "modelIncomeDetail" },
        contractItem,
        settingsItem
      ];
    }
    if (r === 2) {
      return [
        { name: "基本信息", icon: "基", menuKey: "merchantBasicInfo" },
        { name: "经纪人", icon: "经", menuKey: "brokerInfo" },
        { name: "我的订单", icon: "单", menuKey: "myOrders" },
        contractItem,
        settingsItem
      ];
    }
    if (r === 3) {
      return [
        { name: "我的二维码", icon: "码", menuKey: "brokerQrCode" },
        { name: "我的商家", icon: "商", menuKey: "brokerMyMerchants" },
        { name: "关联订单", icon: "单", menuKey: "brokerOrders" },
        { name: "收入明细", icon: "收", menuKey: "incomeDetail" },
        contractItem,
        settingsItem
      ];
    }
    if (r === 4) {
      return [
        { name: "关联订单", icon: "单", menuKey: "brokerOrders" },
        { name: "收入明细", icon: "收", menuKey: "agentIncomeDetail" },
        contractItem,
        settingsItem
      ];
    }
    return [];
  },

  onMenuTap(e) {
    const key = e.currentTarget.dataset.menuKey;
    if (key === "basicInfo") {
      wx.navigateTo({ url: "/pages/model-basic-info/model-basic-info" });
      return;
    }
    if (key === "categorySelect") {
      wx.navigateTo({ url: "/pages/model-category/model-category" });
      return;
    }
    if (key === "brokerInfo") {
      wx.navigateTo({ url: "/pages/broker-info/broker-info" });
      return;
    }
    if (key === "modelCard") {
      wx.navigateTo({ url: "/pages/model-card/model-card" });
      return;
    }
    if (key === "portfolio") {
      wx.navigateTo({ url: "/pages/model-portfolio/model-portfolio" });
      return;
    }
    if (key === "pricing") {
      wx.navigateTo({ url: "/pages/model-pricing/model-pricing" });
      return;
    }
    if (key === "scheduleCalendar") {
      wx.navigateTo({ url: "/pages/model-schedule/model-schedule" });
      return;
    }
    if (key === "orderSettings") {
      wx.navigateTo({ url: "/pages/model-order/model-order" });
      return;
    }
    if (key === "myOrders") {
      wx.navigateTo({ url: "/pages/order-list/order-list" });
      return;
    }
    if (key === "modelIncomeDetail") {
      wx.navigateTo({ url: "/pages/model-income-detail/model-income-detail" });
      return;
    }
    if (key === "incomeDetail") {
      wx.navigateTo({ url: "/pages/broker-income-detail/broker-income-detail" });
      return;
    }
    if (key === "brokerIncomeDetail") {
      wx.navigateTo({ url: "/pages/broker-income-detail/broker-income-detail" });
      return;
    }
    if (key === "agentIncomeDetail") {
      wx.navigateTo({ url: "/pages/broker-income-detail/broker-income-detail" });
      return;
    }
    if (key === "merchantBasicInfo") {
      wx.navigateTo({ url: "/pages/merchant-basic-info/merchant-basic-info" });
      return;
    }
    if (key === "settings") {
      wx.navigateTo({ url: "/pages/settings/settings" });
      return;
    }
    if (key === "contracts") {
      wx.navigateTo({ url: "/pages/contract-detail/contract-detail" });
      return;
    }
    if (key === "brokerQrCode") {
      wx.navigateTo({ url: "/pages/broker-qrcode/broker-qrcode" });
      return;
    }
    if (key === "brokerMyModels") {
      wx.navigateTo({ url: "/pages/broker-my-models/broker-my-models" });
      return;
    }
    if (key === "brokerMyMerchants") {
      wx.navigateTo({ url: "/pages/broker-my-merchants/broker-my-merchants" });
      return;
    }
    if (key === "brokerOrders") {
      wx.navigateTo({ url: "/pages/broker-order-list/broker-order-list" });
      return;
    }
    wx.showToast({
      title: "功能开发中",
      icon: "none"
    });
  },

  onAvatarTap() {
    const app = getApp();
    if (!app.globalData.token) {
      wx.showToast({
        title: "请先登录",
        icon: "none"
      });
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (pickRes) => {
        const file = pickRes.tempFiles && pickRes.tempFiles[0];
        if (!file || !file.tempFilePath) {
          wx.showToast({
            title: "未选择图片",
            icon: "none"
          });
          return;
        }

        wx.showLoading({ title: "上传中..." });
        wx.uploadFile({
          url: `${app.globalData.apiBaseUrl}/api/users/me/avatar`,
          filePath: file.tempFilePath,
          name: "file",
          header: {
            Authorization: `Bearer ${app.globalData.token}`
          },
          success: (uploadRes) => {
            const status = uploadRes.statusCode;
            let body = {};
            try {
              body = JSON.parse(uploadRes.data || "{}");
            } catch (_err) {
              body = {};
            }

            if (status !== 200 || !body.ok || !body.avatarUrl) {
              wx.showToast({
                title: body.message || `上传失败(${status})`,
                icon: "none"
              });
              return;
            }

            const avatarUrl = app.resolveAvatarUrl(
              body.avatarUrl,
              app.globalData.apiBaseUrl
            );
            const nextUserInfo = {
              ...(this.data.userInfo || {}),
              avatarUrl
            };
            app.globalData.userInfo = nextUserInfo;
            this.setData({ userInfo: nextUserInfo });
            wx.showToast({
              title: "头像已更新",
              icon: "success"
            });
          },
          fail: () => {
            wx.showToast({
              title: "网络异常，上传失败",
              icon: "none"
            });
          },
          complete: () => {
            wx.hideLoading();
          }
        });
      }
    });
  },

});
