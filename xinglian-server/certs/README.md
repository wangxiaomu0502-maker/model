# 微信支付证书目录

本目录已在 `.gitignore` 中忽略，**不会提交到 Git**。

## 当前已有

| 文件 | 说明 |
|------|------|
| `apiclient_cert.pem` | 商户 API 证书（公钥） |
| `apiclient_key.pem` | 商户 API 私钥（已从项目根目录 `支付证书目录/` 复制） |

商户证书序列号（填 `.env` 的 `WECHAT_PAY_SERIAL_NO`）：

```
75C073DF04065F5AFCCD36B95EDA2EF3EAE0A47D
```

原始下载文件在项目根目录 **`支付证书目录/`**（已加入 `.gitignore`）。

## 还需你手动放入

### `wechatpay_public.pem`（必填，回调验签用）

路径：**账户中心 → API安全 → 微信支付公钥 → 下载**

将下载的公钥文件保存为本目录的 `wechatpay_public.pem`。

`.env` 中 `WECHAT_PAY_PUBLIC_KEY_ID` 已确认为：

```
PUB_KEY_ID_0117451356322026052200381569003402
```

## `.env` 路径示例（本地 / 服务器）

```env
WECHAT_PAY_MODE=wechat
WECHAT_PAY_MCH_ID=1745135632
WECHAT_PAY_API_V3_KEY=你在商户平台设置的32位APIv3密钥
WECHAT_PAY_SERIAL_NO=75C073DF04065F5AFCCD36B95EDA2EF3EAE0A47D
WECHAT_PAY_PRIVATE_KEY_PATH=./certs/apiclient_key.pem
WECHAT_PAY_PUBLIC_KEY_ID=你的微信支付公钥ID
WECHAT_PAY_PUBLIC_KEY_PATH=./certs/wechatpay_public.pem
WECHAT_PAY_NOTIFY_URL=https://api.xinglianmoku.cn/api/pay/wechat/notify
```

服务器部署时建议用绝对路径，例如：

`WECHAT_PAY_PRIVATE_KEY_PATH=/srv/xinglian-server/certs/apiclient_key.pem`

部署后执行：`chmod 600 certs/*.pem`
