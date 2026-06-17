# Play Scraper API

Google Play 应用价格监控服务，基于 Cloudflare Workers + KV + Cron + Assets 架构。

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                    │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Assets    │  │    API      │  │   Cron Jobs     │  │
│  │  (静态HTML) │  │  (_worker)  │  │ (定时检查价格)  │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
│         │                │                   │          │
│         │                ▼                   │          │
│         │        ┌─────────────┐             │          │
│         │        │  KV Store   │◄────────────┘          │
│         │        │ (应用配置)  │                        │
│         │        │ (价格状态)  │                        │
│         │        │ (通知历史)  │                        │
│         │        └─────────────┘                        │
└─────────┴───────────────────────────────────────────────┘
```

## 目录结构

```
play-scraper-api/
├── public/
│   └── index.html      # 前端静态页面 (Cloudflare Assets 托管)
├── _worker.js          # Workers 入口 (API + 定时任务)
├── wrangler.toml       # Cloudflare 配置
└── README.md
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/dashboard` | GET | 获取仪表盘数据 (apps, history, 配置状态) |
| `/api/apps` | GET | 获取所有监控应用列表 |
| `/api/apps` | POST | 添加新应用到监控列表 |
| `/api/apps` | PATCH | 更新应用配置 |
| `/api/apps` | DELETE | 删除应用 |
| `/api/check` | GET | 手动触发价格检查 |
| `/api/history` | GET | 获取通知历史记录 |
| `/api/status` | GET | 获取所有应用状态 |
| `/api/search` | GET | 搜索 Google Play 应用 |

## 环境变量

在 Cloudflare Dashboard 中配置：

| 变量 | 说明 |
|------|------|
| `SC3_UID` | Server酱推送 UID |
| `SC3_SENDKEY` | Server酱推送 SendKey |
| `SCRAPER_API` | Google Play 爬虫 API 地址（支持搜索功能） |

## 部署

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 部署
wrangler deploy
```

## 本地开发

```bash
# 启动本地开发服务器
wrangler dev

# 访问 http://localhost:8787
```

## 前端架构

前端采用纯静态 HTML，页面加载后通过 JavaScript 调用 `/api/dashboard` 获取数据并渲染：

1. **`public/index.html`** - 包含完整的 HTML/CSS/JavaScript
2. 前端通过 `fetch()` 调用 API 端点
3. Cloudflare Assets 自动处理静态资源缓存

## 通知功能

- 支持降价阈值通知 (monitor_mode: "threshold")
- 支持价格变动通知 (monitor_mode: "change")
- 通过 Server酱 (push.ft07.com) 发送推送

## License

MIT
