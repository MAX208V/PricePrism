# Play Scraper API

监控 Google Play 商店特定应用价格并提醒。

## 项目结构

```
src/
├── index.ts                 # 主入口文件
├── dashboard-handler.ts     # 仪表板处理器
├── api/                     # API 路由处理器
│   ├── apps-handler.ts      # 应用管理 API
│   ├── search-handler.ts    # 搜索 API
│   ├── check-handler.ts     # 检查 API
│   └── history-handler.ts   # 历史记录 API
├── services/                # 业务逻辑层
│   ├── app-service.ts       # 应用服务
│   ├── monitor-service.ts   # 监控服务
│   └── search-service.ts    # 搜索服务
├── repositories/            # 数据访问层
│   ├── apps-repository.ts   # 应用数据存储
│   ├── status-repository.ts # 状态数据存储
│   └── history-repository.ts# 历史记录存储
└── dashboard/               # 仪表板组件
    ├── dashboard-template.ts# HTML 模板和渲染
    └── dashboard-utils.ts   # 工具函数
```

## API 接口

### 应用管理
- `GET /api/apps` - 获取所有监控应用
- `POST /api/apps` - 添加新的监控应用
- `DELETE /api/apps` - 删除监控应用
- `PATCH /api/apps` - 更新监控应用

### 价格监控
- `POST /api/check` - 手动触发价格检查
- `GET /api/history` - 获取通知历史记录

### 搜索功能
- `GET /api/search?term=关键词` - 搜索 Google Play 应用

## 环境变量

```bash
# Server酱通知配置
SC3_UID=
SC3_SENDKEY=

# Google Play 抓取代理
SCRAPER_PROXY=

# 备用API地址
SCRAPER_API=
```

## 部署

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 部署到 Cloudflare
wrangler deploy
```