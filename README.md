# Play Scraper API

监控 Google Play 商店特定应用价格并提醒。

## 架构

**Cloudflare Workers + KV + Cron + Assets**

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare Workers                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  _worker.js │  │  KV Store   │  │  Cron Trigger       │  │
│  │  API Routes │  │  App Data   │  │  Hourly Price Check │  │
│  └─────────────┘  │  History    │  └─────────────────────┘  │
│                   │  Config     │                           │
│                   └─────────────┘                           │
│                          │                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Assets (Static Files)                  │    │
│  │         public/index.html  (Dashboard UI)           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 项目结构

```
play-scraper-api/
├── _worker.js           # Worker 入口 (API 路由 & Cron)
├── wrangler.toml        # Cloudflare 配置
├── public/
│   └── index.html       # Dashboard 前端UI (静态页面)
└── README.md            # 本文件
```

## 部署

```bash
# 1. 安装 Wrangler
echo "你的Cloudflare API Token" | wrangler login

# 2. 设置 Secrets
wrangler secret put SC3_KEY
wrangler secret put PROXY_URL

# 3. 部署
wrangler deploy
```

## 环境变量

| 变量名 | 说明 |
|--------|------|
| `SC3_KEY` | ServerChan3 通知密钥 |
| `PROXY_URL` | CORS代理地址 (用于搜索功能) |

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | Dashboard 页面 |
| GET | `/api/dashboard` | 获取 Dashboard 数据 |
| GET | `/api/apps` | 列出所有监控应用 |
| POST | `/api/apps` | 添加应用 |
| DELETE | `/api/apps` | 删除应用 |
| PATCH | `/api/apps` | 更新应用 |
| POST | `/api/check` | 手动触发价格检查 |
| GET | `/api/search?term=xxx` | 搜索应用 |

## 定时任务

每小时自动检查一次所有应用的价格。

## 技术栈

- **Backend**: Cloudflare Workers + KV
- **Cron**: 价格检查定时任务
- **Assets**: 静态 HTML Dashboard (无框架, 原生JS)
- **通知**: ServerChan3
