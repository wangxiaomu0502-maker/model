/**
 * 余额 + 账本流水（原钱包页），供「收入明细」复用。
 * API：GET /api/users/me/wallet
 */
module.exports = Behavior({
  data: {
    loading: false,
    initialLoaded: false,
    loadError: "",
    availableYuan: 0,
    frozenYuan: 0,
    pendingYuan: 0,
    availableDisplay: "0.00",
    frozenDisplay: "0.00",
    pendingDisplay: "0.00",
    ledgerTableReady: true,
    ledgerRows: [],
    nextBeforeId: null,
    showLoadMore: false,
    paging: false
  },

  methods: {
    fmtMoney(x) {
      const n = Number(x);
      if (!Number.isFinite(n)) return "0.00";
      return n.toFixed(2);
    },

    formatLedgerRow(item) {
      const amt = Number(item.amountYuan) || 0;
      const pos = amt >= 0;
      const titleRaw =
        item.title && String(item.title).trim()
          ? String(item.title).trim()
          : item.bizTypeLabel || item.bizType || "账户变动";
      const iso = item.createdAtIso ? String(item.createdAtIso) : "";
      let timeLine = iso;
      if (iso) {
        try {
          const d = new Date(iso.replace(" ", "T"));
          const mm = `${d.getMonth() + 1}`.padStart(2, "0");
          const dd = `${d.getDate()}`.padStart(2, "0");
          const hh = `${d.getHours()}`.padStart(2, "0");
          const mi = `${d.getMinutes()}`.padStart(2, "0");
          timeLine = `${mm}-${dd} ${hh}:${mi}`;
        } catch (_e) {
          timeLine = iso.slice(0, 16);
        }
      }
      const parts = [];
      if (item.orderId != null) parts.push(`订单 #${item.orderId}`);
      if (item.bizTypeLabel && item.bizTypeLabel !== titleRaw) {
        parts.push(item.bizTypeLabel);
      }

      return {
        id: item.id,
        titleLine: titleRaw,
        amountLine: `${pos ? "+" : ""}${amt.toFixed(2)}`,
        amountClass: pos ? "ledger-amt--pos" : "ledger-amt--neg",
        timeLine,
        subLine: parts.length ? parts.join(" · ") : ""
      };
    },

    applyPayload(body, append) {
      const ledger = Array.isArray(body.ledger) ? body.ledger : [];
      const rows = ledger.map((x) => this.formatLedgerRow(x));
      const merged = append ? (this.data.ledgerRows || []).concat(rows) : rows;

      const availableYuan = Number(body.availableYuan) || 0;
      const frozenYuan = Number(body.frozenYuan) || 0;
      const pendingYuan = Number(body.pendingSettlementYuan) || 0;

      const nextRaw = body.nextBeforeId;
      let nextBeforeId = null;
      if (nextRaw != null && String(nextRaw) !== "") {
        const n = Number(nextRaw);
        nextBeforeId = Number.isFinite(n) ? n : null;
      }

      this.setData({
        ledgerTableReady: body.ledgerTableReady !== false,
        availableYuan,
        frozenYuan,
        pendingYuan,
        availableDisplay: this.fmtMoney(availableYuan),
        frozenDisplay: this.fmtMoney(frozenYuan),
        pendingDisplay: this.fmtMoney(pendingYuan),
        ledgerRows: merged,
        nextBeforeId,
        showLoadMore: Boolean(nextBeforeId),
        loading: false,
        paging: false,
        initialLoaded: true,
        loadError: ""
      });
    },

    fetchWallet(opts) {
      const app = getApp();
      const token = app.globalData.token || "";
      if (!token) {
        this.setData({
          loading: false,
          loadError: "请先登录后再查看收入明细"
        });
        return Promise.resolve(false);
      }

      const append = Boolean(opts && opts.append);
      if (!append) this.setData({ loading: true, loadError: "" });
      else this.setData({ paging: true });

      const qs = {};
      const beforeId =
        opts && opts.beforeId != null ? opts.beforeId : this.data.nextBeforeId;
      if (append && beforeId != null) qs.beforeId = beforeId;

      const query =
        Object.keys(qs).length > 0
          ? `?${Object.entries(qs)
              .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
              .join("&")}`
          : "";

      return new Promise((resolve) => {
        wx.request({
          url: `${app.globalData.apiBaseUrl}/api/users/me/wallet${query}`,
          method: "GET",
          header: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`
          },
          success: (res) => {
            const body = res.data || {};
            if (res.statusCode !== 200 || !body.ok) {
              this.setData({
                loading: false,
                paging: false,
                loadError: body.message || "加载失败"
              });
              resolve(false);
              return;
            }
            this.applyPayload(body, append);
            resolve(true);
          },
          fail: () => {
            this.setData({
              loading: false,
              paging: false,
              loadError: "网络异常，请稍后重试"
            });
            resolve(false);
          }
        });
      });
    },

    async onLoadMoreLedger() {
      if (
        this.data.paging ||
        !this.data.showLoadMore ||
        this.data.nextBeforeId == null
      ) {
        return;
      }
      await this.fetchWallet({
        append: true,
        beforeId: this.data.nextBeforeId
      });
    }
  }
});
