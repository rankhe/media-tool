## 目标与范围
- 新增“微信公众号热门”模块，数据来源为 `https://dajiala.com/main/`。
- 采集三块内容：
  1) 最新爆文
  2) 最新收录优质公众号
  3) 最新热文
- 前端呈现方式与原站布局风格保持一致（Ant Design 复刻），支持打开原文/主页链接。

## 数据结构与统一规范
- Article（爆文/热文）：
  - `id`, `title`, `summary`, `cover_url`, `link`, `author_name`, `author_id?`, `published_at?`, `read_count?`, `like_count?`, `tags?: string[]`
- Account（优质公众号）：
  - `id`, `name`, `avatar_url`, `wechat_id?`, `desc?`, `followers?`, `category?`, `link`
- 所有返回值加 `is_real_data: true`；数字字段尽量做整数化；时间统一 ISO 字符串。

## 技术实现（后端）
- 新增爬虫服务：`api/services/external/dajialaCrawler.ts`
  - `getLatestExplodes(limit?: number)` → Article[]
  - `getLatestQualityAccounts(limit?: number)` → Account[]
  - `getLatestHotArticles(limit?: number)` → Article[]
- 采集策略（两级回退）：
  1) HTTP直取：`fetch` 获取 HTML，按版块标题（如“最新爆文”、“最新收录优质公众号”、“最新热文”）定位其容器，再解析条目（标题、作者、封面、链接、摘要、指标）。
  2) 无头浏览器回退：如直取为空或结构变动，使用 `puppeteer/puppeteer-core` 无头加载 `/main/`，`waitUntil: 'networkidle2'` 后拿 `page.content()` 再解析；Windows 环境支持自动探测 Chrome 路径或通过 `PUPPETEER_EXECUTABLE_PATH` 指定。
- 选择器与解析：
  - 基于版块头部文案定位父容器，再在容器内解析列表卡片（标题文本、作者昵称、封面 `<img>`、详情 `<a>`）。
  - 文案/样式变动时，回退以相邻结构与语义文本匹配（例如通过`包含“最新爆文”`的 heading 上层容器）。
- 缓存与限速：
  - 引入 Redis 缓存，Key 例如：`dajiala:explodes`, `dajiala:quality_accounts`, `dajiala:hot_articles`，TTL 10 分钟；优先返回缓存，过期重抓。
  - 简单速率限制：同路由每分钟最多 6 次抓取（命中缓存不计数）。
- 新增路由：`api/routes/wechat.ts`
  - `GET /api/wechat/explodes?limit=20`
  - `GET /api/wechat/quality-accounts?limit=20`
  - `GET /api/wechat/hot-articles?limit=20`
  - `GET /api/wechat/overview`（一次返回三块数据，含各自 `total`）
- 错误处理：
  - 网络/解析异常返回 `{ success:false, error:{ code:'FETCH_FAILED' } }`；无数据返回空数组但不报 500。

## 技术实现（前端）
- 新增页面：`src/pages/WeChatDiscovery.tsx`
  - 顶部标题“公众号热点”，三个区块：最新爆文、最新收录优质公众号、最新热文。
  - 组件：
    - ArticleCard：支持封面、标题、摘要、作者、指标，按钮“打开原文”。
    - AccountCard（复用视频页样式思路）：头像、名称、简介、按钮“主页”。
  - 数据源：
    - `wechatAPI.getExplodes(limit)`、`getQualityAccounts(limit)`、`getHotArticles(limit)`、`getOverview()`（在 `src/services/api.ts` 增加）
  - 交互：加载态、空态、错误提示；点击打开原链接新窗口；图片统一走现有 `proxify` 路由。
- 导航入口：侧边栏或 Home Tabs 增加“公众号热点”入口。

## 兼容与安全
- UA 设置为常见桌面 UA；不注入或持久化任何登录态；遵守基本抓取频率，避免压力。
- 仅采集站点公开页 `/main/` 展示内容；不写入站点受限数据。

## 测试与验证
- 路由级集成测试：命中缓存与不命中缓存两种路径；断言返回字段完整性。
- 页面自测：检查三块数据渲染、点击行为、空态与错误态。

## 里程碑
1) 后端爬虫与路由（直取+无头回退+缓存）
2) 前端页面与 API 接口
3) 完整联调与优化（选择器适配、性能与缓存策略）

## 配置项
- `PUPPETEER_EXECUTABLE_PATH`（可选）：指定本机 Chrome；Windows 自动探测。
- `REDIS` 已存在复用；缓存 TTL 可在 `.env` 配置 `DAJIALA_CACHE_TTL=600`。

## 交付
- 新增爬虫文件、路由、前端页面与服务接口；提供基础测试与日志。