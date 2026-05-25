const brokerPromo = require("../../utils/broker-promo.js");

Page({
  data: {
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
    submitLoading: false
  },

  onLoad() {
    const app = getApp();
    const role = Number(app.globalData.role || 0);
    this.setData({ isBrokerRole: role === 3 });
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

  uploadBrokerLicenseFile(filePath) {
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
    wx.uploadFile({
      url: `${app.globalData.apiBaseUrl}/api/users/me/broker-license`,
      filePath,
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

  uploadAvatarFile(filePath) {
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
    wx.uploadFile({
      url: `${app.globalData.apiBaseUrl}/api/users/me/avatar`,
      filePath,
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
    return new Promise((resolve) => {
      wx.uploadFile({
        url: `${app.globalData.apiBaseUrl}/api/ocr/id-card`,
        filePath,
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
    });
  },

  async onRunOcr() {
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

  goNext() {
    const { nickname, phoneAuthorized, phoneNumber, submitLoading } = this.data;
    if (submitLoading) return;

    const nick = String(nickname || "").trim();
    if (!nick) {
      wx.showToast({ title: "请填写昵称", icon: "none" });
      return;
    }

    if (!phoneAuthorized || !phoneNumber) {
      wx.showToast({
        title: "请先完成手机号授权",
        icon: "none"
      });
      return;
    }

    const app = getApp();
    const role = Number(app.globalData.role || 0);
    if (role === 3) {
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
    if (!role) {
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
    if (!avatarStored) {
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

    this.setData({ submitLoading: true });

    const registrationData = {
      role,
      phone: phoneNumber,
      faceVerified: true,
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

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/auth/complete-registration`,
      method: "POST",
      header: {
        "content-type": "application/json",
        Authorization: `Bearer ${app.globalData.token}`
      },
      data: registrationData,
      success: (res) => {
        if (!res.data?.ok) {
          wx.showToast({
            title: res.data?.message || "提交失败",
            icon: "none"
          });
          return;
        }

        wx.showToast({
          title: "注册完成",
          icon: "success"
        });

        if (Number(role) === 2) {
          brokerPromo.clearPendingBrokerUserNo();
        }

        app.globalData.role = Number(res.data.role || role);
        wx.setStorageSync("selectedRole", app.globalData.role);

        if (!app.globalData.userInfo) {
          app.globalData.userInfo = {};
        }
        app.globalData.userInfo.nickName = nick;
        app.globalData.userInfo.avatarUrl = app.resolveAvatarUrl(
          avatarStored,
          app.globalData.apiBaseUrl
        );

        if (res.data.token) {
          app.globalData.token = res.data.token;
          wx.setStorageSync("authToken", res.data.token);
        }

        setTimeout(() => {
          const nextRole = Number(app.globalData.role || role || 0);
          const targetUrl =
            nextRole === 1 || nextRole === 3 || nextRole === 4
              ? "/pages/model-stats/model-stats"
              : "/pages/model-list/model-list";
          wx.switchTab({ url: targetUrl });
        }, 700);
      },
      fail: () => {
        wx.showToast({
          title: "网络异常，请稍后重试",
          icon: "none"
        });
      },
      complete: () => {
        this.setData({ submitLoading: false });
      }
    });
  }
});
