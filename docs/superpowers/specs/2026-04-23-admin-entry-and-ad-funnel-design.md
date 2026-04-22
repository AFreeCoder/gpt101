# GPT101 管理员登录入口与广告漏斗设计

## 背景

当前站点头部没有显示登录入口，管理员无法从页面上直接发现后台登录路径。

同时，`/upgrade` 已经承接广告落地页导流，但当前转化追踪仍偏向“出站点击”模型，不能准确衡量广告用户在升级流程中的推进情况。

本次目标有两件事：

- 在不新造认证流程的前提下，恢复站点头部登录入口
- 为 `source=ad-plus` 的广告流量建立升级页内的漏斗追踪，并把“点击核验 Token”定义为广告转化

## 已确认决策

- 登录入口采用当前项目原有模板能力，不新增独立登录页入口，不新增单独的“后台登录组件”
- 头部登录交互沿用当前模板：点击后打开登录弹窗
- 当前站点没有普通用户业务场景，因此不需要为“普通用户登录”和“管理员登录”做额外区隔
- 广告漏斗只对 `source=ad-plus` 生效
- 广告漏斗事件命名采用：
  - `ad_plus_click_upgrade`
  - `ad_plus_click_verify_code`
  - `ad_plus_click_verify_token`
- 其中 `ad_plus_click_verify_token` 同时作为 Google Ads conversion
- “点击核验 Token”即记为广告转化，不等待接口成功返回

## 目标

- 头部显示可用的登录入口，复用现有 `SignUser` / `SignModal`
- 登录成功后继续按现有权限体系控制后台访问
- 广告落地页到升级页形成完整三步漏斗
- 非 `source=ad-plus` 的流量不进入这套广告转化漏斗

## 非目标

- 不修改现有认证提供方、登录表单、权限模型
- 不新增“普通用户中心”或其他登录后页面
- 不把广告漏斗扩展为站点级通用埋点体系
- 不把“核验成功”或“提交成功”定义为广告转化

## 方案对比

### 方案 A：新增独立后台登录入口

在头部新增一个单独的“后台登录”按钮，点击跳 `/sign-in`，回跳 `/admin`。

优点：

- 路径直接
- 文案显式

缺点：

- 没有复用当前模板默认交互
- 会形成与现有 `SignUser` 平行的另一套入口

### 方案 B：启用现有 `SignUser`，并把回跳目标固定为 `/admin`（采用）

在头部启用模板已有的登录入口，保持弹窗交互；通过参数把登录成功后的目标页固定到 `/admin`。

优点：

- 完全复用现有模板与认证能力
- 交互与当前项目风格一致
- 改动集中，回归成本低

缺点：

- 需要给 `SignUser` / `SignModal` 补可配置 `callbackUrl`

### 方案 C：只做广告漏斗，不恢复登录入口

优点：

- 范围最小

缺点：

- 不能解决管理员找不到登录入口的问题

## 设计

### 1. 头部登录入口

#### 1.1 配置层

- 落地页头部配置中的 `show_sign` 改为启用
- 不新增新的 header schema 字段

#### 1.2 组件层

- 继续使用现有 `Header -> SignUser -> SignModal -> SignInForm` 链路
- 为 `SignUser` 新增可选 `callbackUrl`
- 为 `SignModal` 透传该 `callbackUrl`
- 在头部调用 `SignUser` 时传入 `/admin`

#### 1.3 登录后行为

- 登录成功后回跳 `/admin`
- `/admin` 继续由现有 `requireAdminAccess` 守卫控制
- 没有 `admin.access` 的账号，仍会被重定向到无权限页

### 2. 广告漏斗定义

仅当升级页来源满足 `source=ad-plus` 时，触发以下事件：

1. 广告落地页点击“立即升级”
   - 事件名：`ad_plus_click_upgrade`

2. 升级页点击“立即核验”
   - 事件名：`ad_plus_click_verify_code`

3. 升级页点击“核验 Token”
   - 事件名：`ad_plus_click_verify_token`
   - 同时发送 Google Ads conversion

转化定义：

- 用户点击“核验 Token”按钮即记为广告转化

### 3. 埋点触发位置

#### 3.1 广告落地页

- 在广告落地页“立即升级”按钮点击时触发 `ad_plus_click_upgrade`
- 该按钮继续跳转 `/upgrade?source=ad-plus`

#### 3.2 升级页 Step 1

- 在“立即核验”按钮点击时触发 `ad_plus_click_verify_code`
- 仅当当前来源为 `source=ad-plus` 时触发

#### 3.3 升级页 Step 2

- 在“核验 Token”按钮点击时触发 `ad_plus_click_verify_token`
- 同时发送 Google Ads conversion
- 仅当当前来源为 `source=ad-plus` 时触发

### 4. 埋点实现方式

#### 4.1 事件发送能力

- 保留现有 `sendOutboundClick`
- 在同一埋点模块中增加更通用的事件发送方法，支持：
  - 普通 gtag event
  - conversion event

#### 4.2 广告漏斗辅助层

- 新增一个轻量 helper，用于：
  - 读取并判断当前 `source`
  - 只在 `source=ad-plus` 时放行
  - 发送三类漏斗事件
  - 在最终节点发送 conversion

#### 4.3 与后端 metadata 的关系

- 继续沿用现有 `/api/upgrade/submit` 对 `source/utm_*` 的透传与落库
- 本次不新增后端转化判定逻辑
- 后端 metadata 仅作为后续核对和分析补充

## 边界与约束

- 这套漏斗只服务于广告效果衡量，不用于站内全量行为分析
- 首页来源 `source=home` 不触发广告漏斗
- 自然访问 `/upgrade` 不触发广告漏斗
- 后续若新增其他广告来源，应通过扩展来源判断而不是复用 `ad-plus` 名称

## 验证

完成后需要满足以下条件：

- 头部出现可用登录入口，点击后打开现有登录弹窗
- 登录成功后按现有逻辑回跳 `/admin`
- `source=ad-plus` 时：
  - 点击广告页“立即升级”会触发 `ad_plus_click_upgrade`
  - 点击升级页“立即核验”会触发 `ad_plus_click_verify_code`
  - 点击升级页“核验 Token”会触发 `ad_plus_click_verify_token`
  - 点击“核验 Token”时会同时触发 Google Ads conversion
- 非 `source=ad-plus` 时，上述三类广告漏斗事件都不触发

## 风险

- 如果把 conversion 绑在接口成功而不是点击，会引入账号质量、网络波动、上游校验失败等噪音，导致广告转化口径不稳定
- 如果不按 `source=ad-plus` 做来源约束，会把自然流量和广告流量混在一起，导致广告效果失真
- 如果 `callbackUrl` 透传不完整，头部登录入口可能回到首页而不是 `/admin`
