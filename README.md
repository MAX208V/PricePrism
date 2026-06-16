# Play Scraper API

监控 Google Play 商店特定应用价格并提醒。

## 项目结构

```
Cloudflare Worker
├── Hono Router
├── KV
├── Cron
├── Static Assets
├── Dashboard SPA
├── Repository Layer
├── Service Layer
├── Notification Layer
└── Play Scraper Layer
```

## 功能特性

- 监控 Google Play 商店中特定应用的价格
- 当价格下降到预设阈值时发送通知
- 定时任务：每小时检查一次应用价格
- 可视化 Web 管理面板
- 支持配置不同的国家/地区商店

## 技术栈

- Cloudflare Workers
- Hono (轻量级路由器)
- TypeScript
- KV Storage

## 开发

1. 安装依赖：
   ```bash
   npm install
   ```

2. 启动开发服务器：
   ```bash
   npm run dev
   ```

## 部署

1. 登录到 Cloudflare：
   ```bash
   wrangler login
   ```

2. 创建 KV 命名空间：
   ```bash
   wrangler kv namespace create DATA
   ```

3. 部署：
   ```bash
   npm run deploy
   ```

## 项目结构详情

```
src/
├── index.ts               # 入口文件
├── routes/                # 路由控制器
│   ├── apps.ts           # 应用管理路由
│   ├── search.ts         # 搜索路由
│   ├── history.ts        # 历史记录路由
│   └── system.ts         # 系统路由
│
├── services/              # 业务逻辑层
│   ├── play.service.ts   # Google Play服务
│   ├── monitor.service.ts # 监控服务
│   ├── notify.service.ts # 通知服务
│   └── app.service.ts    # 应用服务
│
├── repositories/          # 数据访问层
│   ├── app.repo.ts       # 应用数据存储
│   ├── history.repo.ts   # 历史记录存储
│   └── cache.repo.ts     # 缓存存储
│
├── cron/                  # 定时任务
│   └── monitor.ts        # 价格监控任务
│
├── utils/                 # 工具函数
│   ├── response.ts       # 响应处理
│   ├── date.ts           # 日期处理
│   └── validator.ts      # 数据验证
│
├── dashboard/             # 管理面板前端
│   ├── index.html        # 主页面
│   ├── app.js            # 前端逻辑
│   ├── api.js            # API客户端
│   ├── store.js          # 状态管理
│   └── style.css         # 样式
│
└── types/                 # 类型定义
    └── index.ts          # 接口和类型定义
```