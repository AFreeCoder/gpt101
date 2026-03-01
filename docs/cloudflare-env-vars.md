# Cloudflare 环境变量迁移清单

本文用于 Cloudflare（Pages/Workers + OpenNext）部署时的变量迁移基线。

## 1. Wrangler 绑定配置（`wrangler.toml`）

以下绑定已在仓库的 `wrangler.toml` 中声明：

- `ASSETS`（OpenNext 静态资源绑定）

`HYPERDRIVE` 默认未声明。若启用 Cloudflare Hyperdrive，请在 `wrangler.toml` 追加：

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<your-hyperdrive-id>"
```

## 2. 必迁移变量（生产必须配置）

下列变量在生产环境建议全部迁移，避免运行时缺参：

| 变量名 | 用途 | 建议存放 |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | 站点公开 URL（需改为 Cloudflare 实际域名） | `vars` |
| `NEXT_PUBLIC_APP_NAME` | 站点名称 | `vars` |
| `NEXT_PUBLIC_APP_DESCRIPTION` | 站点描述 | `vars` |
| `NEXT_PUBLIC_THEME` | 主题风格 | `vars` |
| `NEXT_PUBLIC_APPEARANCE` | 外观模式 | `vars` |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | 默认语言 | `vars` |
| `NEXT_PUBLIC_LOCALE_DETECT_ENABLED` | 语言自动检测开关 | `vars` |
| `DATABASE_PROVIDER` | 数据库类型（默认 `postgresql`） | `vars` |
| `DATABASE_URL` | 数据库连接串 | `secret` |
| `DB_SINGLETON_ENABLED` | 数据库单例连接开关 | `vars` |
| `DB_MAX_CONNECTIONS` | 数据库最大连接数 | `vars` |
| `AUTH_SECRET` | 鉴权密钥（`openssl rand -base64 32` 生成） | `secret` |
| `AUTH_URL` | 鉴权回调基准地址（建议与 `NEXT_PUBLIC_APP_URL` 一致） | `vars` |

## 3. 按需迁移变量（可选）

以下变量按业务是否启用决定：

| 变量名 | 用途 | 建议存放 |
| --- | --- | --- |
| `DATABASE_AUTH_TOKEN` | 某些数据库驱动的鉴权 Token | `secret` |
| `DB_SCHEMA_FILE` | DB schema 文件路径（本地工具链常用） | `vars` |
| `DB_SCHEMA` | DB schema 名称 | `vars` |
| `DB_MIGRATIONS_TABLE` | 迁移记录表名 | `vars` |
| `DB_MIGRATIONS_SCHEMA` | 迁移 schema | `vars` |
| `DB_MIGRATIONS_OUT` | 迁移输出目录（本地工具链常用） | `vars` |
| `GOOGLE_ANALYTICS_ID` | Google Analytics ID | `vars` |
| `GOOGLE_ADS_ID` | Google Ads ID | `vars` |
| `BAIDU_ANALYTICS_ID` | 百度统计 ID | `vars` |
| `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SEND_TO` | Google Ads 转化追踪参数 | `vars` |
| `NEXT_PUBLIC_APP_LOGO` | 自定义站点 Logo URL | `vars` |
| `NEXT_PUBLIC_APP_FAVICON` | 自定义 favicon URL | `vars` |
| `NEXT_PUBLIC_APP_PREVIEW_IMAGE` | 自定义分享预览图 URL | `vars` |
| `NEXT_PUBLIC_DEBUG` | 前端调试开关 | `vars` |
| `AUTH_GET_SESSION_MIN_INTERVAL_MS` | 服务端会话最小刷新间隔 | `vars` |
| `NEXT_PUBLIC_AUTH_GET_SESSION_MIN_INTERVAL_MS` | 客户端会话最小刷新间隔 | `vars` |

## 4. 不建议迁移到生产的本地变量

| 变量名 | 说明 |
| --- | --- |
| `ANALYZE` | 仅用于本地/CI 构建分析 |
| `ENV_FILE` | 本地脚本读取 `.env` 文件时使用 |
| `NODE_ENV` | 运行时自动注入，无需手工维护 |

## 5. 迁移建议

1. 先把非敏感变量写入 `wrangler.toml` 的 `[vars]`。
2. 将敏感变量通过 `wrangler secret put <NAME>` 注入。
3. 生产环境将 `NEXT_PUBLIC_APP_URL`、`AUTH_URL` 同步为 Cloudflare 正式域名。
4. 若启用 Hyperdrive，把 `[[hyperdrive]]` 的 `id` 配成真实值，并验证 `env.HYPERDRIVE` 可读。
