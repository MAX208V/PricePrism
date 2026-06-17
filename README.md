# Play Scraper API

一个基于 Cloudflare Workers 的 Google Play 应用价格监控系统。

## 功能特性

- ✅ 实时监控 Google Play 应用价格
- 📉 设置价格阈值，降价时自动通知
- 🔔 支持两种监控模式：阈值监控和价格变化监控
- 🔍 应用搜索功能
- 📱 响应式管理面板
- ⏰ 定时任务自动检查价格
- 📧 通过 Server酱 发送通知

## 系统架构

### 模块化设计

```
├── api/                 # API模块
│   ├── index.js         # API路由入口
│   ├── apps.js          # 应用管理API
│   ├── search.js        # 搜索API
│   └── check.js         # 价格检查API
├── dashboard/           # 前端界面
│   └── index.html       # 管理面板HTML
├── modules/             # 核心模块
│   ├── dashboard.js     # 控制面板渲染模块
│   ├── scheduler.js     # 定时任务模块
│   └── notification.js  # 通知模块
├── _worker.js           # Worker入口点
├── wrangler.toml        # 部署配置
└── package.json         # 项目依赖
```

## 部署

1. 安装 Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

2. 登录 Cloudflare:
   ```bash
   wrangler login
   ```

3. 配置 KV 命名空间:
   ```bash
   wrangler kv:namespace create "KV"
   ```
   
   将返回的命名空间ID填入 `wrangler.toml` 文件。

4. 部署应用:
   ```bash
   npm run deploy
   ```

## 配置

系统需要一些配置项才能完整运行：

### 1. KV存储配置

在KV中设置以下键值：

```javascript
// config (JSON)
{
  "sc3": "SERVERCHAN_SEND_KEY",  // Server酱的SendKey
  "proxyUrl": "https://cors-proxy.example.com/"  // 可选: CORS代理URL
}
```

### 2. 定时任务

默认配置了每小时执行一次的价格检查任务。

## API 接口

### 应用管理

- `GET /api/apps` - 获取监控应用列表
- `POST /api/apps` - 添加监控应用
- `PATCH /api/apps` - 更新监控应用
- `DELETE /api/apps` - 删除监控应用

### 搜索

- `GET /api/search?term=关键词` - 搜索Google Play应用

### 手动检查

- `POST /api/check` - 手动触发价格检查

## 本地开发

```bash
npm start
```

这将启动本地开发服务器，默认访问地址为 http://localhost:8787

## 许可证

MIT