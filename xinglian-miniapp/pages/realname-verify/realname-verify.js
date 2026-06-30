import { startEid } from "../../mp_ecard_sdk/main";

const brokerPromo = require("../../utils/broker-promo.js");
const { prepareImageForUpload } = require("../../utils/image-upload.js");
const { homeTabUrlForRole } = require("../../utils/role-tab.js");
const { PENDING_REGISTRATION_KEY } = require("../../utils/registration-contract.js");

Page({
  data: {
    isBoundModelMode: false,
    isBrokerRole: false,
    brokerKind: "",
    brokerLicensePreviewUrl: "",
    brokerLicenseStoredUrl: "",
    brokerLicenseUploading: false,
    nickname: "",
    avatarPreviewUrl: "",
    avatarStoredUrl: "",
    phoneAuthorized: false,
    phoneAuthCode: "",
    phoneNumber: "",
    phoneLoading: false,
    idCardFrontImageLocalPath: "",
    idCardBackImageLocalPath: "",
    ocrFrontLoading: false,
    ocrBackLoading: false,
    ocrFrontDone: false,
    ocrBackDone: false,
    realName: "",
    idCardNo: "",
    idCardFrontUrl: "",
    idCardBackUrl: "",
    issueAuthority: "",
    validDate: "",
    eidToken: "",
    eidVerified: false,
    faceVerifyLoading: false,
    submitLoading: false,
    realnameCompleted: false
  },

  resolveStoredImageUrl(stored) {
    const app = getApp();
    return app.resolveAvatarUrl(stored, app.globalData.apiBaseUrl);
  },

  applyVerifiedProfile(user) {
    const app = getApp();
    const pendingRn = app.OCR_PENDING_REAL_NAME || "待OCR核验";
    const pendingId = app.OCR_PENDING_ID_CARD_NO || "000000000000000000";
    const realNameRaw = user.realName != null ? String(user.realName).trim() : "";
    const idCardNoRaw = user.idCardNo != null ? String(user.idCardNo).trim() : "";
    const frontRaw = user.idCardFrontUrl != null ? String(user.idCardFrontUrl).trim() : "";
    const backRaw = user.idCardBackUrl != null ? String(user.idCardBackUrl).trim() : "";
    const issueRaw =
      user.idCardIssueAuthority != null ? String(user.idCardIssueAuthority).trim() : "";
    const validRaw = user.idCardValidDate != null ? String(user.idCardValidDate).trim() : "";

    const realName = realNameRaw && realNameRaw !== pendingRn ? realNameRaw : "";
    const idCardNo = idCardNoRaw && idCardNoRaw !== pendingId ? idCardNoRaw : "";
    const frontUrl = frontRaw ? this.resolveStoredImageUrl(frontRaw) : "";
    const backUrl = backRaw ? this.resolveStoredImageUrl(backRaw) : "";
    const hasFront = Boolean(frontUrl);
    const hasBack = Boolean(backUrl);

    this.setData({
      realnameCompleted: true,
      realName,
      idCardNo,
      issueAuthority: issueRaw,
      validDate: validRaw,
      idCardFrontUrl: frontRaw,
      idCardBackUrl: backRaw,
      idCardFrontImageLocalPath: hasFront ? frontUrl : "",
      idCardBackImageLocalPath: hasBack ? backUrl : "",
      ocrFrontDone: hasFront,
      ocrBackDone: hasBack
    });
  },

  onLoad(options) {
    const app = getApp();
    const mode = options && options.mode ? String(options.mode) : "";
    const isBoundModelMode = mode === "bound";
    const role = Number(app.globalData.role || 0);
    this.setData({ isBrokerRole: role === 3, isBoundModelMode });

    if (isBoundModelMode) {
      app.globalData.role = 1;
      app.globalData.identity = "模特";
      wx.setStorageSync("selectedRole", 1);
      this.loadBoundModelProfile();
    }
  },

  onShow() {
    if (this.data.isBoundModelMode) {
      this.loadBoundModelProfile();
    }
  },

  loadBoundModelProfile() {
    const app = getApp();
    if (!app.globalData.token) return;
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/users/me`,
      method: "GET",
      header: { Authorization: `Bearer ${app.globalData.token}` },
      success: (res) => {
        const body = res.data || {};
        const user = body.user;
        if (res.statusCode !== 200 || !body.ok || !user) return;
        const phone = user.phone ? String(user.phone) : "";
        const nick = user.nickname ? String(user.nickname).trim() : "";
        const patch = {
          phoneAuthorized: Boolean(phone),
          phoneNumber: phone,
          realnameCompleted: false
        };
        if (nick) patch.nickname = nick;
        this.setData(patch);
        if (Number(user.verifiedStatus) === 2) {
          this.applyVerifiedProfile(user);
        }
      }
    });
  },

  onBrokerKindTap(e) {
    const kind = String((e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.kind) || "");
    if (kind !== "professional" && kind !== "part-time") return;
    const patch = { brokerKind: kind };
    if (kind === "part-time") {
      patch.brokerLicensePreviewUrl = "";
      patch.brokerLicenseStoredUrl = "";
    }
    this.setData(patch);
  },

  onPickBrokerLicense() {
    const app = getApp();
    if (!app.globalData.token) {
      wx.showToast({
        title: "登录状态失效，请重新登录",
        icon: "none"
      });
      return;
    }
    if (this.data.brokerLicenseUploading) return;

    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success: (res) => {
        const filePath = res?.tempFiles?.[0]?.tempFilePath || "";
        if (!filePath) {
          wx.showToast({ title: "未获取到图片", icon: "none" });
          return;
        }
        this.uploadBrokerLicenseFile(filePath);
      },
      fail: (err) => {
        const msg = String((err && err.errMsg) || "");
        if (/cancel/i.test(msg)) return;
        wx.showToast({
          title: "选择图片失败，请重试",
          icon: "none"
        });
      }
    });
  },

  async uploadBrokerLicenseFile(filePath) {
    const app = getApp();
    if (!app.globalData.token) {
      wx.showToast({
        title: "登录状态失效，请重新登录",
        icon: "none"
      });
      return;
    }

    this.setData({
      brokerLicensePreviewUrl: filePath,
      brokerLicenseUploading: true
    });
    wx.showLoading({ title: "上传经纪人证..." });
    let uploadFilePath = filePath;
    try {
      uploadFilePath = await prepareImageForUpload(filePath);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: (err && err.message) || "图片处理失败",
        icon: "none"
      });
      this.setData({
        brokerLicensePreviewUrl: "",
        brokerLicenseStoredUrl: "",
        brokerLicenseUploading: false
      });
      return;
    }
    wx.uploadFile({
      url: `${app.globalData.apiBaseUrl}/api/users/me/broker-license`,
      filePath: uploadFilePath,
      name: "file",
      header: {
        Authorization: `Bearer ${app.globalData.token}`
      },
      success: (uploadRes) => {
        const status = uploadRes.statusCode;
        let body = {};
        try {
          body = JSON.parse(uploadRes.data || "{}");
        } catch (_e) {
          body = {};
        }
        if (status !== 200 || !body.ok || !body.brokerLicenseUrl) {
          wx.showToast({
            title: body.message || `上传失败(${status})`,
            icon: "none",
            duration: 2800
          });
          this.setData({
            brokerLicensePreviewUrl: "",
            brokerLicenseStoredUrl: ""
          });
          return;
        }
        this.setData({
          brokerLicenseStoredUrl: String(body.brokerLicenseUrl).trim()
        });
        wx.showToast({ title: "经纪人证已上传", icon: "success" });
      },
      fail: () => {
        wx.showToast({
          title: "网络异常，请稍后重试",
          icon: "none"
        });
        this.setData({
          brokerLicensePreviewUrl: "",
          brokerLicenseStoredUrl: ""
        });
      },
      complete: () => {
        wx.hideLoading();
        this.setData({ brokerLicenseUploading: false });
      }
    });
  },

  onNicknameInput(e) {
    const value = (e.detail && e.detail.value) || "";
    this.setData({ nickname: value });
  },

  onPickAvatar() {
    const app = getApp();
    if (!app.globalData.token) {
      wx.showToast({
        title: "登录状态失效，请重新登录",
        icon: "none"
      });
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success: (res) => {
        const filePath = res?.tempFiles?.[0]?.tempFilePath || "";
        if (!filePath) {
          wx.showToast({ title: "未获取到图片", icon: "none" });
          return;
        }
        this.uploadAvatarFile(filePath);
      },
      fail: (err) => {
        const msg = String((err && err.errMsg) || "");
        if (/cancel/i.test(msg)) return;
        wx.showToast({
          title: "选择图片失败，请重试",
          icon: "none"
        });
      }
    });
  },

  async uploadAvatarFile(filePath) {
    const app = getApp();
    if (!app.globalData.token) {
      wx.showToast({
        title: "登录状态失效，请重新登录",
        icon: "none"
      });
      return;
    }

    this.setData({ avatarPreviewUrl: filePath });
    wx.showLoading({ title: "上传头像中..." });
    let uploadFilePath = filePath;
    try {
      uploadFilePath = await prepareImageForUpload(filePath);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: (err && err.message) || "图片处理失败",
        icon: "none"
      });
      return;
    }
    wx.uploadFile({
      url: `${app.globalData.apiBaseUrl}/api/users/me/avatar`,
      filePath: uploadFilePath,
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
            title: body.message || `头像上传失败(${status})`,
            icon: "none",
            duration: 2800
          });
          return;
        }

        this.setData({
          avatarStoredUrl: body.avatarUrl
        });
        wx.showToast({
          title: "头像上传成功",
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
  },

  onGetPhoneNumber(e) {
    const detail = e.detail || {};
    if (!detail.code) {
      wx.showToast({
        title: "手机号授权未完成",
        icon: "none"
      });
      return;
    }

    const app = getApp();
    if (!app.globalData.token) {
      wx.showToast({
        title: "登录状态失效，请重新登录",
        icon: "none"
      });
      return;
    }

    this.setData({
      phoneLoading: true,
      phoneAuthCode: detail.code
    });

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/auth/bind-phone`,
      method: "POST",
      header: {
        "content-type": "application/json",
        Authorization: `Bearer ${app.globalData.token}`
      },
      data: {
        code: detail.code
      },
      success: (res) => {
        if (!res.data?.ok) {
          wx.showToast({
            title: res.data?.message || "手机号授权失败",
            icon: "none"
          });
          return;
        }

        this.setData({
          phoneAuthorized: true,
          phoneNumber: res.data.phone || ""
        });

        wx.showToast({
          title: "手机号授权成功",
          icon: "success"
        });
      },
      fail: () => {
        wx.showToast({
          title: "网络异常，请稍后重试",
          icon: "none"
        });
      },
      complete: () => {
        this.setData({
          phoneLoading: false
        });
      }
    });
  },

  onChooseIdCardFrontImage() {
    if (this.data.realnameCompleted) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["camera", "album"],
      sizeType: ["compressed"],
      success: (res) => {
        const filePath = res?.tempFiles?.[0]?.tempFilePath || "";
        if (!filePath) {
          wx.showToast({ title: "未获取到图片", icon: "none" });
          return;
        }
        this.setData({
          idCardFrontImageLocalPath: filePath,
          ocrFrontDone: false,
          eidToken: "",
          eidVerified: false,
          realName: "",
          idCardNo: "",
          idCardFrontUrl: ""
        });
      },
      fail: () => {
        wx.showToast({ title: "选择图片失败", icon: "none" });
      }
    });
  },

  onChooseIdCardBackImage() {
    if (this.data.realnameCompleted) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["camera", "album"],
      sizeType: ["compressed"],
      success: (res) => {
        const filePath = res?.tempFiles?.[0]?.tempFilePath || "";
        if (!filePath) {
          wx.showToast({ title: "未获取到图片", icon: "none" });
          return;
        }
        this.setData({
          idCardBackImageLocalPath: filePath,
          ocrBackDone: false,
          eidToken: "",
          eidVerified: false,
          issueAuthority: "",
          validDate: "",
          idCardBackUrl: ""
        });
      },
      fail: () => {
        wx.showToast({ title: "选择图片失败", icon: "none" });
      }
    });
  },

  runOcrBySide(side) {
    const loadingKey = side === "front" ? "ocrFrontLoading" : "ocrBackLoading";
    const doneKey = side === "front" ? "ocrFrontDone" : "ocrBackDone";
    const pathKey = side === "front" ? "idCardFrontImageLocalPath" : "idCardBackImageLocalPath";
    if (this.data[loadingKey]) return Promise.resolve(false);
    const app = getApp();
    if (!app.globalData.token) {
      wx.showToast({
        title: "登录状态失效，请重新登录",
        icon: "none"
      });
      return Promise.resolve(false);
    }
    const filePath = String(this.data[pathKey] || "").trim();
    if (!filePath) {
      wx.showToast({ title: "请先上传对应身份证照片", icon: "none" });
      return Promise.resolve(false);
    }

    this.setData({ [loadingKey]: true });
    return prepareImageForUpload(filePath)
      .then((uploadFilePath) => new Promise((resolve) => {
      wx.uploadFile({
        url: `${app.globalData.apiBaseUrl}/api/ocr/id-card`,
        filePath: uploadFilePath,
        name: "file",
        formData: {
          side
        },
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
          if (status !== 200 || !body.ok) {
            wx.showToast({
              title: body.message || `OCR识别失败(${status})`,
              icon: "none"
            });
            resolve(false);
            return;
          }

          if (side === "front") {
            const realName = String(body.realName || "").trim();
            const idCardNo = String(body.idCardNo || "").trim();
            const idCardFrontUrl = String(body.idCardFrontUrl || "").trim();
            if (!realName || !idCardNo) {
              wx.showToast({
                title: "人像面识别结果不完整",
                icon: "none"
              });
              resolve(false);
              return;
            }
            this.setData({
              [doneKey]: true,
              eidToken: "",
              eidVerified: false,
              realName,
              idCardNo,
              idCardFrontUrl
            });
          } else {
            const issueAuthority = String(body.issueAuthority || "").trim();
            const validDate = String(body.validDate || "").trim();
            const idCardBackUrl = String(body.idCardBackUrl || "").trim();
            if (!issueAuthority || !validDate) {
              wx.showToast({
                title: "国徽面识别结果不完整",
                icon: "none"
              });
              resolve(false);
              return;
            }
            this.setData({
              [doneKey]: true,
              eidToken: "",
              eidVerified: false,
              issueAuthority,
              validDate,
              idCardBackUrl
            });
          }
          resolve(true);
        },
        fail: () => {
          wx.showToast({
            title: "网络异常，请稍后重试",
            icon: "none"
          });
          resolve(false);
        },
        complete: () => {
          this.setData({ [loadingKey]: false });
        }
      });
    }))
      .catch((err) => {
        wx.showToast({
          title: (err && err.message) || "图片处理失败",
          icon: "none"
        });
        this.setData({ [loadingKey]: false });
        return false;
      });
  },

  async onRunOcr() {
    if (this.data.realnameCompleted) return;
    if (this.data.ocrFrontLoading || this.data.ocrBackLoading) return;
    if (!this.data.idCardFrontImageLocalPath || !this.data.idCardBackImageLocalPath) {
      wx.showToast({ title: "请先上传身份证人像面和国徽面", icon: "none" });
      return;
    }
    wx.showLoading({ title: "识别人像面..." });
    const frontOk = await this.runOcrBySide("front");
    if (!frontOk) {
      wx.hideLoading();
      return;
    }
    wx.showLoading({ title: "识别国徽面..." });
    const backOk = await this.runOcrBySide("back");
    wx.hideLoading();
    if (!backOk) return;
    wx.showToast({ title: "人像面和国徽面识别完成", icon: "success" });
  },

  requestEidToken(realName, idCardNo) {
    const app = getApp();
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/eid/token`,
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: `Bearer ${app.globalData.token}`
        },
        data: { realName, idCardNo },
        success: (res) => {
          const body = res.data || {};
          if (res.statusCode !== 200 || !body.ok || !body.eidToken) {
            reject(new Error(body.message || "获取E证通Token失败"));
            return;
          }
          resolve(String(body.eidToken).trim());
        },
        fail: () => reject(new Error("网络异常，请稍后重试"))
      });
    });
  },

  verifyEidResult(eidToken, realName, idCardNo) {
    const app = getApp();
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/eid/result`,
        method: "POST",
        header: {
          "content-type": "application/json",
          Authorization: `Bearer ${app.globalData.token}`
        },
        data: { eidToken, realName, idCardNo },
        success: (res) => {
          const body = res.data || {};
          if (res.statusCode !== 200 || !body.ok || !body.verified) {
            reject(new Error(body.message || "E证通核验未通过"));
            return;
          }
          resolve(true);
        },
        fail: () => reject(new Error("网络异常，请稍后重试"))
      });
    });
  },

  startFaceVerify(next) {
    if (this.data.faceVerifyLoading) return;
    if (!this.data.ocrFrontDone || !this.data.ocrBackDone) {
      wx.showToast({ title: "请先完成身份证OCR识别", icon: "none" });
      return;
    }
    const realName = String(this.data.realName || "").trim();
    const idCardNo = String(this.data.idCardNo || "").trim();
    if (!realName || !idCardNo) {
      wx.showToast({ title: "识别结果不完整，请重试", icon: "none" });
      return;
    }

    this.setData({ faceVerifyLoading: true });
    wx.showLoading({ title: "准备人脸核身..." });
    this.requestEidToken(realName, idCardNo)
      .then((eidToken) => {
        wx.hideLoading();
        startEid({
          data: {
            token: eidToken,
            needJumpPage: false,
            enableEmbedded: false
          },
          verifyDoneCallback: (result) => {
            const token = String((result && result.token) || eidToken).trim();
            wx.showLoading({ title: "确认核身结果..." });
            this.verifyEidResult(token, realName, idCardNo)
              .then(() => {
                this.setData({
                  eidToken: token,
                  eidVerified: true
                });
                wx.showToast({ title: "人脸核身完成", icon: "success" });
                if (typeof next === "function") {
                  setTimeout(next, 500);
                }
              })
              .catch((err) => {
                wx.showToast({
                  title: (err && err.message) || "E证通核验未通过",
                  icon: "none"
                });
              })
              .finally(() => {
                wx.hideLoading();
                this.setData({ faceVerifyLoading: false });
              });
          }
        });
        this.setData({ faceVerifyLoading: false });
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ faceVerifyLoading: false });
        wx.showToast({
          title: (err && err.message) || "获取E证通Token失败",
          icon: "none"
        });
      });
  },

  onStartFaceVerify() {
    this.startFaceVerify();
  },

  submitBoundModelRealname(payload) {
    const app = getApp();
    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/users/me/realname-verify`,
      method: "POST",
      header: {
        "content-type": "application/json",
        Authorization: `Bearer ${app.globalData.token}`
      },
      data: payload,
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode !== 200 || !body.ok) {
          wx.showToast({
            title: body.message || "实名认证失败",
            icon: "none",
            duration: 2800
          });
          return;
        }
        wx.showToast({ title: "实名认证完成", icon: "success" });
        app.globalData.role = 1;
        app.globalData.identity = "模特";
        wx.setStorageSync("selectedRole", 1);
        setTimeout(() => {
          wx.switchTab({ url: homeTabUrlForRole(1) });
        }, 700);
      },
      fail: () => {
        wx.showToast({ title: "网络异常，请稍后重试", icon: "none" });
      },
      complete: () => {
        this.setData({ submitLoading: false });
      }
    });
  },

  goNext() {
    const { nickname, phoneAuthorized, phoneNumber, submitLoading, isBoundModelMode, realnameCompleted } =
      this.data;
    if (submitLoading) return;

    if (realnameCompleted) {
      wx.navigateBack({
        fail: () => {
          wx.switchTab({ url: homeTabUrlForRole(1) });
        }
      });
      return;
    }

    const nick = String(nickname || "").trim();
    if (!isBoundModelMode && !nick) {
      wx.showToast({ title: "请填写昵称", icon: "none" });
      return;
    }

    if (!phoneAuthorized || !phoneNumber) {
      wx.showToast({
        title: isBoundModelMode ? "账号未绑定手机号，请联系管理员" : "请先完成手机号授权",
        icon: "none"
      });
      return;
    }

    const app = getApp();
    const role = Number(app.globalData.role || 0);
    if (!isBoundModelMode && role === 3) {
      const kind = String(this.data.brokerKind || "");
      if (!kind) {
        wx.showToast({ title: "请选择经纪人类型", icon: "none" });
        return;
      }
      if (kind === "professional" && !String(this.data.brokerLicenseStoredUrl || "").trim()) {
        wx.showToast({ title: "请上传经纪人证", icon: "none" });
        return;
      }
    }
    if (!isBoundModelMode && !role) {
      wx.showToast({
        title: "请先选择身份",
        icon: "none"
      });
      return;
    }

    if (!app.globalData.token) {
      wx.showToast({
        title: "登录状态失效，请重新登录",
        icon: "none"
      });
      return;
    }

    const avatarStored = String(this.data.avatarStoredUrl || "").trim();
    if (!isBoundModelMode && !avatarStored) {
      wx.showToast({ title: "请先上传头像", icon: "none" });
      return;
    }

    let realName;
    let idCardNo;
    let idCardFrontUrl;
    let idCardBackUrl;
    let idCardIssueAuthority;
    let idCardValidDate;

    if (!this.data.ocrFrontDone || !this.data.ocrBackDone) {
      wx.showToast({ title: "请先完成人像面和国徽面OCR识别", icon: "none" });
      return;
    }
    realName = String(this.data.realName || "").trim();
    idCardNo = String(this.data.idCardNo || "").trim();
    idCardFrontUrl = String(this.data.idCardFrontUrl || "").trim();
    idCardBackUrl = String(this.data.idCardBackUrl || "").trim();
    idCardIssueAuthority = String(this.data.issueAuthority || "").trim();
    idCardValidDate = String(this.data.validDate || "").trim();
    if (!realName || !idCardNo || !idCardFrontUrl || !idCardBackUrl || !idCardIssueAuthority || !idCardValidDate) {
      wx.showToast({ title: "识别结果不完整，请重试", icon: "none" });
      return;
    }
    if (!this.data.eidVerified || !String(this.data.eidToken || "").trim()) {
      this.startFaceVerify(() => this.goNext());
      return;
    }

    this.setData({ submitLoading: true });

    if (isBoundModelMode) {
      this.submitBoundModelRealname({
        faceVerified: true,
        eidToken: String(this.data.eidToken || "").trim(),
        realName,
        idCardNo,
        idCardFrontUrl,
        idCardBackUrl,
        idCardIssueAuthority,
        idCardValidDate
      });
      return;
    }

    const registrationData = {
      role,
      phone: phoneNumber,
      faceVerified: true,
      eidToken: String(this.data.eidToken || "").trim(),
      nickname: nick,
      avatarUrl: avatarStored,
      realName,
      idCardNo,
      idCardFrontUrl,
      idCardBackUrl,
      idCardIssueAuthority,
      idCardValidDate
    };
    if (Number(role) === 2) {
      const brokerUserNo = brokerPromo.readPendingBrokerUserNo();
      if (brokerUserNo) {
        registrationData.brokerUserNo = brokerUserNo;
      }
    }
    if (Number(role) === 3) {
      const kind = String(this.data.brokerKind || "");
      registrationData.isProfessional = kind === "professional";
      if (registrationData.isProfessional) {
        registrationData.brokerLicenseUrl = String(this.data.brokerLicenseStoredUrl || "").trim();
      }
    }

    try {
      wx.setStorageSync(PENDING_REGISTRATION_KEY, registrationData);
    } catch {
      wx.showToast({ title: "无法保存注册信息", icon: "none" });
      this.setData({ submitLoading: false });
      return;
    }

    this.setData({ submitLoading: false });
    wx.navigateTo({
      url: "/pages/contract-detail/contract-detail?mode=register",
      fail: () => {
        wx.showToast({ title: "无法打开协议页", icon: "none" });
      }
    });
  }
});
