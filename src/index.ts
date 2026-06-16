import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { appsRoute } from './routes/apps'
import { searchRoute } from './routes/search'
import { historyRoute } from './routes/history'
import { systemRoute } from './routes/system'
import { runMonitor } from './cron/monitor'

const app = new Hono()

// 中间件
app.use('*', async (c, next) => {
  c.header('Content-Type', 'application/json')
  await next()
})

// 统一成功响应
export function success(data: any) {
  return Response.json({
    success: true,
    data
  })
}

// 错误处理
app.onError((err, c) => {
  console.error(err)
  return c.json({
    success: false,
    message: err.message
  }, 500)
})

// 路由
app.route('/api/apps', appsRoute)
app.route('/api/search', searchRoute)
app.route('/api/history', historyRoute)
app.route('/api/system', systemRoute)

// 静态资源路由
app.get('/', async (c) => {
  return c.redirect('/dashboard')
})

app.get('/dashboard', async (c) => {
  return c.html(await fetchDashboard())
})

// 获取仪表板页面
async function fetchDashboard(): Promise<string> {
  // 这里应该从静态资源返回仪表板HTML
  // 现在我们暂时返回一个简单的HTML
  return `
    <!doctype html>
    <html>
    <head>
    <meta charset="utf-8">
    <title>Play Scraper</title>
    <link rel="stylesheet" href="/dashboard/style.css">
    </head>
    <body>
    <div id="app">
      <h1>Play Scraper Dashboard</h1>
      <p>Loading...</p>
    </div>
    <script src="/dashboard/app.js"></script>
    </body>
    </html>
  `
}

export default {
  fetch: app.fetch,
  
  async scheduled(event: any, env: any, ctx: any) {
    ctx.waitUntil(
      runMonitor(env)
    )
  }
}