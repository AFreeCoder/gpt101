# GPT101 Partner Upgrade API

版本日期：2026-05-23

本文档描述第三方服务端全代理升级接入方式。第三方负责自己的支付、页面和用户交互；GPT101 只提供服务端 API，用于外部订单核验、ChatGPT session token 核验、提交升级任务和查询任务状态。

## 1. 接入方身份

每个第三方接入方拥有独立的：

- `appKey`：公开身份标识，每次请求都要携带。
- `appSecret`：服务端签名密钥，只能保存在第三方服务端，不能出现在浏览器、URL、前端代码、日志或埋点中。

GPT101 侧会记录接入方状态、允许的产品/会员档位、可选 IP 白名单、每分钟限流值和 nonce/audit 记录。禁用接入方或轮换密钥后，旧签名不再可用。

每个接入方必须显式配置允许售卖的产品和会员档位；未配置允许商品时，订单核验会被拒绝。`productCode` 和 `memberType` 也必须属于 GPT101 已支持的内部产品/档位，不能仅凭签名写入任意值。

## 2. 签名协议

所有 partner API 请求都必须带以下请求头：

```http
X-GPT101-App-Key: <appKey>
X-GPT101-Timestamp: <unix seconds>
X-GPT101-Nonce: <unique nonce>
X-GPT101-Signature: <hex hmac sha256>
```

签名算法：

```text
bodyHash = sha256(rawBody)

canonical = [
  HTTP_METHOD_UPPERCASE,
  REQUEST_PATH,
  X-GPT101-Timestamp,
  X-GPT101-Nonce,
  bodyHash
].join("\n")

signature = hmac_sha256_hex(appSecret, canonical)
```

校验规则：

- `timestamp` 有效窗口为 5 分钟。
- `nonce` 按 `appKey + nonce` 防重放，服务端保留 10 分钟；过期 nonce 会在后续鉴权时清理。
- 签名覆盖原始请求体，不使用重新序列化后的 JSON。
- 生产环境只允许 HTTPS。若服务位于 Caddy/Nginx 等反向代理后，只有在应用服务不对公网直连、代理会清洗并重写 forwarded headers 时，才允许设置 `PARTNER_TRUSTED_PROXY_HEADERS=true`。
- GET 请求的 `rawBody` 为空字符串。

服务端审计只记录 `appKey`、路径、method、nonce、body hash、client IP、结果和错误摘要，不记录原始请求体或 `sessionToken` 明文。失败鉴权审计会按 `appKey + client IP + path` 做窗口封顶，避免错误签名或缺失签名请求放大成无限 DB 写入。

## 3. 外部订单核验

```http
POST /api/partner/upgrade/verify-order
Content-Type: application/json
```

请求体：

```json
{
  "externalOrderNo": "ORDER-20260523-0001",
  "productCode": "gpt",
  "memberType": "plus"
}
```

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "valid": true,
    "externalOrderNo": "ORDER-20260523-0001",
    "productCode": "gpt",
    "memberType": "plus"
  }
}
```

说明：

- GPT101 使用 `appKey + externalOrderNo` 作为幂等键。
- 同一订单重复核验会返回同一内部升级凭证。
- 同一订单传入不同产品或会员档位会被拒绝。
- 第三方订单号不会作为内部卡密明文使用；系统会生成符合现有规则的内部兑换凭证，并建立映射。

## 4. Session Token 核验

```http
POST /api/partner/upgrade/resolve-account
Content-Type: application/json
```

请求体：

```json
{
  "externalOrderNo": "ORDER-20260523-0001",
  "sessionToken": "{\"user\":{\"id\":\"...\",\"email\":\"user@example.com\"},\"account\":{\"id\":\"...\",\"planType\":\"free\"},\"accessToken\":\"...\"}"
}
```

成功响应沿用现有账号解析语义：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "email": "user@example.com",
    "accountId": "account-id",
    "currentPlan": "free"
  }
}
```

第三方不得持久化或记录 `sessionToken` 明文。Partner API 不返回 ChatGPT `accessToken`，GPT101 提交升级时仍会再次校验原始 `sessionToken`。

## 5. 提交升级

```http
POST /api/partner/upgrade/submit
Content-Type: application/json
```

请求体：

```json
{
  "externalOrderNo": "ORDER-20260523-0001",
  "sessionToken": "...",
  "chatgptEmail": "user@example.com",
  "chatgptAccountId": "account-id",
  "chatgptCurrentPlan": "free"
}
```

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "taskNo": "TS-20260523-1234"
  }
}
```

说明：

- 重复提交同一外部订单会返回同一个 `taskNo`。
- GPT101 内部复用现有升级任务、worker 和渠道执行链路。
- 任务 metadata 会记录 `partnerAppKey`、`partnerOrderId` 和 `externalOrderNo`，便于后台售后和对账。

## 6. 查询任务

```http
GET /api/partner/upgrade/task/{taskNo}
```

GET 请求同样需要签名，`rawBody` 为空字符串。GPT101 会校验该 `taskNo` 是否归属于当前 `appKey`，不允许跨接入方查询。

成功响应沿用现有公开任务状态结构。

## 7. 错误响应

Partner API 沿用当前统一响应包络：

```json
{
  "code": -1,
  "message": "错误信息"
}
```

常见错误包括：

- `缺少 x-gpt101-app-key 请求头`
- `接入方无效或已禁用`
- `请求时间戳已过期`
- `请求签名无效`
- `重复请求`
- `商品或会员类型无效`
- `接入方未配置可用商品`
- `接入方不支持该商品`
- `外部订单商品不一致`
- `外部订单不存在`
- `任务不存在`

## 8. 发布前数据库步骤

当前项目采用 Drizzle `db:push` 模式，不维护独立 migration 文件。上线 partner API 前必须先通过 `gpt101-ops` 一次性运维容器执行 schema push，确保生产库存在：

- `upgrade_partner_app`
- `upgrade_partner_order`
- `upgrade_partner_nonce`
- `upgrade_partner_audit_log`

未完成 schema push 时，partner API 会因缺表失败；普通 `/api/upgrade/*` 卡密流程不依赖这些表。
