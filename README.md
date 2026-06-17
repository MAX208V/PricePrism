# Play Scraper API - Price Monitor

基于 Cloudflare Workers 的 Google Play 应用价格监控系统，采用前后端分离架构。

## 架构概览

- 前端：纯 HTML/CSS/JS，作为静态资源托管 (`public/`)
- 后端：ES Modules 模块化拆分 (`src/`)
- 数据存储：Cloudflare KV
- 定时任务：Cron Triggers 自动监控价格变化
- 通知推送：Server酱 (SC3)

## 目录结构

```
.
├── public/                 # 前端静态资源目录
│   ├── index.html          # 主页面
│   ├── css/
│   │   └── style.css       # 样式文件
│   └── js/
│       ├── api.js          # API 请求封装
│       ├── render.js       # DOM 渲染逻辑
│       └── app.js          # 应用主入口
├── src/                    # 后端 Worker 逻辑目录
│   ├── index.js            # Worker 入口
│   ├── router.js           # API 路由分发
│   ├── controllers/        # 控制器层
│   ├── services/           # 服务层
│   ├── repositories/       # 数据访问层
│   └── utils/              # 工具函数
├── wrangler.toml           # Cloudflare 配置文件
└── package.json            # 项目依赖配置
```

## 开发指南

### 本地开发

1. 安装依赖：
   ```bash
   npm install
   ```

2. 启动本地开发服务器：
   ```bash
   npm run dev
   ```

### 部署

部署到 Cloudflare Workers：
```bash
npm run deploy
```

### 环境变量配置

在 `wrangler.toml` 中配置必要的环境变量：

- `SCRAPER_API`: Scraper API 地址
- `SC3_UID`: Server酱 UID（建议在 Cloudflare Dashboard 中设置为加密变量）
- `SC3_SENDKEY`: Server酱 SENDKEY（建议在 Cloudflare Dashboard 中设置为加密变量）

### KV 存储配置

确保在 Cloudflare Dashboard 中创建了 KV 存储命名空间，并将 ID 配置到 `wrangler.toml` 中的 `kv_namespaces.id`。

## API 接口

### 应用管理
- `GET /api/apps` - 获取所有应用及其状态
- `POST /api/apps` - 添加新应用
- `PATCH /api/apps` - 更新应用配置
- `DELETE /api/apps` - 删除应用

### 监控管理
- `GET /api/status` - 获取所有应用状态
- `POST /api/check` - 手动触发价格检查
- `GET /api/history` - 获取通知历史

### 搜索功能
- `GET /api/search?term=<keyword>` - 搜索应用

## 定时任务

默认每小时执行一次价格监控检查，可通过修改 `wrangler.toml` 中的 `triggers.crons` 来调整频率。