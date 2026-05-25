const { prepareImageForUpload } = require("../../utils/image-upload.js");

const ROLE_TO_KIND = {
  1: "broker_model",
  2: "platform_merchant",
  3: "platform_broker",
  4: "platform_agent"
};

const KIND_TYPE_LABEL = {
  broker_model: "平台与模特",
  platform_merchant: "平台协议",
  platform_broker: "合作协议",
  platform_agent: "平台协议"
};

function pickSignedAt(user, kind) {
  if (!user || !kind) return "";
  if (kind === "platform_broker") return user.contractPlatformBrokerSignedAt || "";
  if (kind === "platform_merchant") return user.contractPlatformMerchantSignedAt || "";
  if (kind === "broker_model") return user.contractBrokerModelSignedAt || "";
  if (kind === "platform_agent") return user.contractPlatformAgentSignedAt || "";
  return "";
}

/** iOS WKWebView 无法解析「2024-05-11 12:00:00」等无前缀 T 的串；纯日期也可能 UTC 偏移 */
function parseSignedAtDate(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  let d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;

  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?/
  );
  if (!m) return null;
  const Y = Number(m[1]);
  const Mo = Number(m[2]);
  const D = Number(m[3]);
  const h = m[4] !== undefined ? Number(m[4]) : 0;
  const min = m[5] !== undefined ? Number(m[5]) : 0;
  const sec = m[6] !== undefined ? Number(m[6]) : 0;
  d = new Date(Y, Mo - 1, D, h, min, sec);
  return Number.isNaN(d.getTime()) ? null : d;
}

Page({
  data: {
    loading: true,
    signing: false,
    contractKind: "",
    contractTypeLabel: "",
    title: "",
    partiesLine: "",
    contentHtml: "",
    signedAt: "",
    signedAtDisplay: "",
    isSigned: false,
    signerRealName: "",
    signatureModalVisible: false,
    signatureHasInk: false,
    signatureReady: false
  },

  formatCn(raw) {
    const d = parseSignedAtDate(raw);
    if (!d) return raw ? String(raw) : "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  },

  ensureRoleKind() {
    const app = getApp();
    if (!app.globalData.token) {
      wx.showToast({ title: "请先登录", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1200);
      return null;
    }
    const role = Number(app.globalData.role || 0);
    const kind = ROLE_TO_KIND[role];
    if (!kind) {
      wx.showToast({ title: "当前身份无需签署此类合同", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1200);
      return null;
    }
    return kind;
  },

  fetchTemplate(apiBase, kind) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${apiBase}/api/contracts/templates/${kind}`,
        method: "GET",
        success: (res) => {
          const d = res.data || {};
          if (res.statusCode === 200 && d && d.ok !== false && d.contentHtml != null) {
            resolve(d);
            return;
          }
          reject(new Error(d.message || "加载合同失败"));
        },
        fail: () => reject(new Error("网络错误"))
      });
    });
  },

  fetchMe(apiBase, token) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${apiBase}/api/users/me`,
        method: "GET",
        header: { Authorization: `Bearer ${token}` },
        success: (res) => {
          const d = res.data || {};
          if (res.statusCode === 200 && d && d.ok !== false && d.user) {
            resolve(d.user);
            return;
          }
          reject(new Error(d.message || "加载用户信息失败"));
        },
        fail: () => reject(new Error("网络错误"))
      });
    });
  },

  loadAll() {
    const kind = this.ensureRoleKind();
    if (!kind) {
      this.setData({ loading: false });
      return;
    }

    const app = getApp();
    const apiBase = app.globalData.apiBaseUrl;
    const token = app.globalData.token;

    this.setData({ loading: true, contractKind: kind });

    Promise.all([this.fetchTemplate(apiBase, kind), this.fetchMe(apiBase, token)])
      .then(([tpl, user]) => {
        const signedRaw = pickSignedAt(user, kind);
        const app = getApp();
        const pendingRn = app.OCR_PENDING_REAL_NAME || "待OCR核验";
        let signerRealName = String(user.realName || "").trim();
        if (!signerRealName || signerRealName === pendingRn) {
          signerRealName = String(user.nickname || "").trim() || "本人";
        }
        const html =
          typeof tpl.contentHtml === "string" && tpl.contentHtml.trim()
            ? tpl.contentHtml
            : "<p style=\"color:#94a3b8\">暂无正文</p>";

        this.setData({
          loading: false,
          contractTypeLabel: KIND_TYPE_LABEL[kind] || "电子合同",
          title: tpl.title || "合同",
          partiesLine: tpl.partiesLine || "",
          contentHtml: html,
          signedAt: signedRaw,
          isSigned: !!signedRaw,
          signerRealName,
          signedAtDisplay: signedRaw ? this.formatCn(signedRaw) : ""
        });
      })
      .catch((err) => {
        this.setData({ loading: false });
        wx.showToast({
          title: err.message || "加载失败",
          icon: "none"
        });
      });
  },

  onShow() {
    wx.setNavigationBarTitle({ title: "合同管理" });
    this.loadAll();
  },

  preventSigBubble() {},

  openSignatureModal() {
    const kind = this.data.contractKind;
    if (!kind || this.data.isSigned || this.data.signing) return;
    this._cleanupSigCanvas();
    this.setData(
      { signatureModalVisible: true, signatureHasInk: false, signatureReady: false },
      () => {
        wx.nextTick(() => {
          setTimeout(() => this.initSignatureCanvas(), 48);
        });
      }
    );
  },

  closeSignatureModal() {
    if (this.data.signing) return;
    this._cleanupSigCanvas();
    this.setData({ signatureModalVisible: false, signatureReady: false });
  },

  _cleanupSigCanvas() {
    this._sigCanvas = null;
    this._sigCtx = null;
    this._sigWidth = 0;
    this._sigHeight = 0;
    this._sigRect = null;
    this._sigDrawing = false;
  },

  initSignatureCanvas() {
    if (!this.data.signatureModalVisible) return;
    wx.createSelectorQuery()
      .select("#signatureCanvas")
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!this.data.signatureModalVisible) return;
        const hit = res && res[0];
        if (!hit || !hit.node) {
          wx.showToast({ title: "签名区域初始化失败", icon: "none" });
          return;
        }
        const canvas = hit.node;
        const ctx = canvas.getContext("2d");
        const dpr = wx.getSystemInfoSync().pixelRatio || 1;
        const width = hit.width;
        const height = hit.height;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        this._sigCanvas = canvas;
        this._sigCtx = ctx;
        this._sigWidth = width;
        this._sigHeight = height;
        wx.createSelectorQuery()
          .select("#signatureCanvas")
          .boundingClientRect((rect) => {
            if (rect) this._sigRect = rect;
          })
          .exec();
        this.setData({ signatureReady: true });
      });
  },

  touchToCanvasXY(e) {
    const r = this._sigRect;
    const t = e.touches && e.touches[0];
    if (!r || !t) return null;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  },

  onSigTouchStart(e) {
    if (!this._sigCtx) return;
    const begin = () => {
      const p = this.touchToCanvasXY(e);
      if (!p) return;
      this._sigDrawing = true;
      this._sigCtx.beginPath();
      this._sigCtx.moveTo(p.x, p.y);
    };
    if (this._sigRect && this._sigRect.width) {
      begin();
      return;
    }
    wx.createSelectorQuery()
      .select("#signatureCanvas")
      .boundingClientRect((rect) => {
        if (rect) this._sigRect = rect;
        begin();
      })
      .exec();
  },

  onSigTouchMove(e) {
    if (!this._sigDrawing || !this._sigCtx) return;
    const p = this.touchToCanvasXY(e);
    if (!p) return;
    this._sigCtx.lineTo(p.x, p.y);
    this._sigCtx.stroke();
    if (!this.data.signatureHasInk) this.setData({ signatureHasInk: true });
  },

  onSigTouchEnd() {
    this._sigDrawing = false;
  },

  clearSignature() {
    const ctx = this._sigCtx;
    const w = this._sigWidth;
    const h = this._sigHeight;
    if (!ctx || !w || !h) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    this.setData({ signatureHasInk: false });
  },

  confirmSignatureAndSign() {
    if (this.data.signing) return;
    if (!this.data.signatureHasInk) {
      wx.showToast({ title: "请先手写签名", icon: "none" });
      return;
    }
    this.submitContractSign();
  },

  exportSignatureFilePath() {
    return new Promise((resolve, reject) => {
      const canvas = this._sigCanvas;
      const w = this._sigWidth;
      const h = this._sigHeight;
      if (!canvas || !w || !h) {
        reject(new Error("签名画布未就绪"));
        return;
      }

      const failExport = () => reject(new Error("导出签名失败"));

      /** 部分基础库 Canvas 2D 节点无 toTempFilePath，需走 wx.canvasToTempFilePath */
      const viaWxApi = () => {
        wx.canvasToTempFilePath(
          {
            canvas,
            fileType: "png",
            quality: 1,
            success: (res) => resolve(res.tempFilePath),
            fail: failExport
          },
          this
        );
      };

      if (typeof canvas.toTempFilePath === "function") {
        canvas.toTempFilePath({
          fileType: "png",
          quality: 1,
          success: (res) => resolve(res.tempFilePath),
          fail: viaWxApi
        });
        return;
      }

      viaWxApi();
    });
  },

  async uploadSignatureToCos(filePath) {
    const uploadFilePath = await prepareImageForUpload(filePath, { quality: 85 });
    return new Promise((resolve, reject) => {
      const app = getApp();
      wx.uploadFile({
        url: `${app.globalData.apiBaseUrl}/api/contracts/signature/upload`,
        filePath: uploadFilePath,
        name: "file",
        header: { Authorization: `Bearer ${app.globalData.token}` },
        success: (res) => {
          let body = {};
          try {
            body = JSON.parse(res.data || "{}");
          } catch {
            body = {};
          }
          if (res.statusCode !== 200 || !body.ok || !body.signatureUrl) {
            reject(new Error(body.message || `上传签名失败(${res.statusCode})`));
            return;
          }
          resolve(String(body.signatureUrl));
        },
        fail: () => reject(new Error("网络错误"))
      });
    });
  },

  submitContractSign() {
    const kind = this.data.contractKind;
    if (!kind || this.data.isSigned) return;

    const app = getApp();
    const apiBase = app.globalData.apiBaseUrl;
    const token = app.globalData.token;

    this.setData({ signing: true });
    this.exportSignatureFilePath()
      .then((tempFilePath) => this.uploadSignatureToCos(tempFilePath))
      .then((signatureUrl) => {
        wx.request({
          url: `${apiBase}/api/contracts/${kind}/sign`,
          method: "POST",
          data: { signatureUrl },
          header: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`
          },
          success: (res) => {
            const d = res.data || {};
            if (res.statusCode === 200 && d && d.ok !== false && d.signedAt) {
              wx.showToast({ title: "签署成功", icon: "success", duration: 1500 });
              const signedAt = d.signedAt;
              this._cleanupSigCanvas();
              this.setData({
                signing: false,
                signatureModalVisible: false,
                signatureReady: false,
                signedAt,
                isSigned: true,
                signedAtDisplay: this.formatCn(signedAt)
              });
              setTimeout(() => {
                const pages = getCurrentPages();
                if (pages.length > 1) {
                  wx.navigateBack();
                } else {
                  wx.switchTab({ url: "/pages/mine/mine" });
                }
              }, 1600);
              return;
            }
            const msg = (d.message || d.code || "") || `签署失败 (${res.statusCode})`;
            wx.showToast({ title: msg, icon: "none" });
            this.setData({ signing: false });
          },
          fail: () => {
            wx.showToast({ title: "网络错误", icon: "none" });
            this.setData({ signing: false });
          }
        });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "签名失败", icon: "none" });
        this.setData({ signing: false });
      });
  }
});
