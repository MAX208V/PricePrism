为了将现有的单体 Worker 代码重构为前后端分离的架构，我们需要将原本通过字符串拼接返回 HTML 的逻辑（renderHtml）拆分为纯静态资源，并将 API 路由与业务逻辑进行模块化拆分。
以下是详细的分离、拆分与合并模块设计文档：
1. 目标架构总览
基于 Cloudflare Workers 的最新特性，采用 Workers + KV + Cron + Static Assets 架构：
前端：纯 HTML/CSS/JS，作为静态资源托管，通过 Fetch API 调用后端接口，实现客户端动态渲染。
后端：使用 ES Modules 拆分路由、控制器、服务层和数据访问层。
定时任务：Cron Triggers 触发价格监控。
数据层：Cloudflare KV 存储配置和状态。
2. 目录结构设计
/
├── public/                 # 前端静态资源目录
│   ├── index.html          # 纯 HTML 骨架
│   ├── css/
│   │   └── style.css       # 从 _worker.js.txt 中提取的 <style> 内容
│   └── js/
│       ├── api.js          # 封装所有 fetch 请求
│       ├── render.js       # 负责动态渲染 DOM (替代原来的 renderHtml)
│       └── app.js          # 主入口，事件绑定与初始化 (提取原 SCRIPT 数组逻辑)
├── src/                    # 后端 Worker 逻辑目录
│   ├── index.js            # Worker 入口：处理 fetch 和 scheduled 事件
│   ├── router.js           # API 路由分发
│   ├── controllers/
│   │   ├── appController.js    # 处理 /api/apps 增删改查
│   │   ├── monitorController.js# 处理 /api/check, /api/status, /api/history
│   │   └── searchController.js # 处理 /api/search
│   ├── services/
│   │   ├── monitorService.js   # 核心业务：比价、监控模式判断
│   │   ├── scraperService.js   # 外部 API 调用 (fetchAppInfo, fetchPrice)
│   │   └── notifyService.js    # Server酱 (SC3) 推送逻辑
│   ├── repositories/
│   │   └── kvRepository.js     # 封装所有 env.KV.get/put 操作
│   └── utils/
│       └── helpers.js          # jsonResponse, 日期格式化等纯函数
├── wrangler.toml           # Cloudflare 配置文件 (配置 KV, Cron, Assets)
└── package.json
3. 后端模块拆分详细说明
将原 _worker.js.txt 中的单一 default 导出和底层函数拆分为以下模块：
3.1 入口与路由
src/index.js
导出 default 对象，包含 fetch 和 scheduled 方法。
fetch 中判断：如果是 API 请求 (/api/*)，交由 router.js 处理；否则交由 Static Assets 处理（或返回 index.html）。
scheduled 直接调用 monitorService.runScheduledCheck(env)。
3.2 控制器层
src/controllers/appController.js：映射自原 handleAppsApi。处理 GET, POST, PATCH, DELETE。
src/controllers/monitorController.js：映射自原 /check、/api/history、/api/status。调用对应的 Service。
src/controllers/searchController.js：映射自原 handleSearch。
3.3 服务层
src/services/monitorService.js：核心逻辑迁移自原 monitorAndNotify 和 checkApp。处理两种监控模式（threshold 和 change），计算是否需要通知。
src/services/scraperService.js：合并 fetchAppInfo 和 fetchPrice。处理 Proxy 和 Fallback API 逻辑。
src/services/notifyService.js：迁移 sendSc3 逻辑，负责发送微信通知。
3.4 数据访问层
src/repositories/kvRepository.js：封装所有 KV 操作。
getApps(env) / saveApps(env, apps)
getStatus(env, appId) / saveStatus(env, appId, status)
getHistory(env) / appendHistory(env, entry)
4. 前端模块拆分详细说明
将原 dashboard.js.txt 和 _worker.js.txt 中的 HTML 模板和 JS 字符串提取为真实的静态文件。
4.1 视图层
public/index.html
包含基本的页面骨架：<div class="wr">，包含 Header、搜索区、应用列表区 (<div id="appList"></div>)、添加表单 (<form id="af">)、通知记录区 (<div id="historyList"></div>)。
包含模态框的 HTML 结构 (详情框 #dv 和编辑框 #ov)。
public/css/style.css
直接提取原代码中 out += '<style>...</style>' 中的 CSS 内容。
4.2 逻辑层
public/js/api.js
封装原代码中的 async function api(p,o)。
暴露 getApps(), addApp(data), editApp(data), deleteApp(id), checkAll(), search(term), getHistory() 等方法。
public/js/render.js
将原 renderHtml 函数拆解为多个 DOM 渲染函数。
renderAppCard(app)：返回单个应用的 DOM 元素，替代原来的字符串拼接。
renderHistory(history)：渲染历史记录。
showDetail(data) / closeDetail()：操作模态框显隐及内容填充。
public/js/app.js
提取原 SCRIPT 数组中的所有事件绑定逻辑。
在 DOMContentLoaded 时，调用 api.getApps() 获取数据，再调用 render.renderAppCard() 渲染页面。
绑定表单提交 (addApp)、刷新按钮 (checkAll) 等事件。
5. 配置合并
使用 wrangler.toml 将所有组件绑定到 Worker：
name = "price-monitor"
main = "src/index.js"
compatibility_date = "2023-10-30"
# 静态资源配置 (前端分离)
[assets]
directory = "./public"
binding = "ASSETS"
keep_vars = true

# KV 存储（保存应用配置和通知状态）
[[kv_namespaces]]
binding = "KV"
id = "8b89d8b5c511457390f5aee4cce00570"

[triggers]
crons = ["0 * * * *"] # 每小时执行一次
# 环境变量
[vars]
SCRAPER_API = env.SCRAPER_API
# SC3_UID 和 SC3_SENDKEY 建议在 Cloudflare Dashboard 中配置为加密变量

6. 数据流向与重构要点
首页加载流程改变：
原架构：Worker 读取 KV -> renderHtml 拼接字符串 -> 返回完整 HTML 页面。
新架构：Worker 返回纯静态 index.html -> 浏览器加载 app.js -> JS 发起 GET /api/status 请求 -> 返回 JSON -> JS 动态生成 DOM 插入页面。
API 响应格式统一：
前后端分离后，后端所有的 /api/* 接口统一返回 JSON 数据，不再返回包含 HTML 标签的数据。
前端模板处理：
原代码中使用单引号拼接 HTML 并处理转义 (esc 函数) 的方式不再需要。在前端使用 document.createElement 或 <template> 标签创建元素，天然防止 XSS 攻击。
静态资源回退：
在 src/index.js 的 fetch 处理中，如果 !url.pathname.startsWith('/api/')，则执行 return env.ASSETS.fetch(request)，直接由 Cloudflare 边缘网络返回静态文件。