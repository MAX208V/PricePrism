import { Hono } from 'hono'
import { AppsRepository } from './repositories/app.repo'
import { HistoryRepository } from './repositories/history.repo'
import { PlayStoreService } from './services/playstore.service'
import { renderHtml } from './dashboard/original-dashboard'

// 初始化 Hono 应用
const app = new Hono()

// 中间件：设置 CORS 头
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type')
  await next()
})

// 处理 OPTIONS 请求
app.options('*', (c) => {
  return c.text('', 200)
})

// 主页 - 返回管理面板
app.get('/', async (c) => {
  // 获取应用数据和历史记录
  const appsRepo = new AppsRepository(c.env)
  
  try {
    const apps = await appsRepo.list()
    // 在实际实现中，这里需要获取历史记录数据
    const history: any[] = []
    
    // 渲染管理面板HTML
    const html = renderHtml(apps, history, true, true)
    return c.html(html)
  } catch (err) {
    console.error('渲染管理面板时出错:', err)
    // 如果渲染出错，返回一个简单的错误页面
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>管理面板</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body>
        <div style="text-align: center; padding: 50px;">
          <h1>管理面板</h1>
          <p>系统初始化中...</p>
          <button onclick="location.reload()">刷新页面</button>
        </div>
      </body>
      </html>
    `)
  }
})

// API 路由：获取应用列表
app.get('/api/apps', async (c) => {
  try {
    const appsRepo = new AppsRepository(c.env)
    const apps = await appsRepo.list()
    return c.json({
      success: true,
      data: apps
    })
  } catch (err) {
    return c.json({
      success: false,
      message: err.message
    }, 500)
  }
})

// API 路由：添加应用
app.post('/api/apps', async (c) => {
  try {
    const data = await c.req.json()
    const appsRepo = new AppsRepository(c.env)
    const playStoreService = new PlayStoreService()
    
    // 验证必需字段
    if (!data.app_id) {
      return c.json({
        success: false,
        message: '缺少必需字段: app_id'
      }, 400)
    }
    
    // 获取应用详情
    let appTitle = data.name || data.app_id
    try {
      const appDetails = await playStoreService.getAppDetails(data.app_id)
      appTitle = appDetails.title
    } catch (err) {
      console.warn('获取应用详情失败:', err)
    }
    
    // 创建应用对象
    const app = {
      id: crypto.randomUUID(), // 生成 UUID
      appId: data.app_id,
      name: appTitle,
      threshold: parseFloat(data.threshold) || 6.00,
      country: data.country || 'us',
      note: data.note || '',
      monitor_mode: data.monitor_mode || 'threshold',
      created_at: Date.now(),
      updated_at: Date.now()
    }
    
    // 保存到 KV
    await appsRepo.create(app)
    
    return c.json({
      success: true,
      data: app
    })
  } catch (err) {
    return c.json({
      success: false,
      message: err.message
    }, 500)
  }
})

// API 路由：更新应用
app.patch('/api/apps', async (c) => {
  try {
    const data = await c.req.json()
    const appsRepo = new AppsRepository(c.env)
    
    if (!data.app_id) {
      return c.json({
        success: false,
        message: '缺少必需字段: app_id'
      }, 400)
    }
    
    // 获取现有应用
    const existingApp = await appsRepo.getByAppId(data.app_id)
    if (!existingApp) {
      return c.json({
        success: false,
        message: '应用不存在'
      }, 404)
    }
    
    // 更新应用信息
    const updatedApp = {
      ...existingApp,
      name: data.name || existingApp.name,
      threshold: parseFloat(data.threshold) || existingApp.threshold,
      country: data.country || existingApp.country,
      note: data.note !== undefined ? data.note : existingApp.note,
      monitor_mode: data.monitor_mode || existingApp.monitor_mode,
      updated_at: Date.now()
    }
    
    await appsRepo.updateByAppId(data.app_id, updatedApp)
    
    return c.json({
      success: true,
      data: updatedApp
    })
  } catch (err) {
    return c.json({
      success: false,
      message: err.message
    }, 500)
  }
})

// API 路由：删除应用
app.delete('/api/apps', async (c) => {
  try {
    const data = await c.req.json()
    const appsRepo = new AppsRepository(c.env)
    
    if (!data.app_id) {
      return c.json({
        success: false,
        message: '缺少必需字段: app_id'
      }, 400)
    }
    
    await appsRepo.deleteByAppId(data.app_id)
    
    return c.json({
      success: true,
      message: '应用删除成功'
    })
  } catch (err) {
    return c.json({
      success: false,
      message: err.message
    }, 500)
  }
})

// API 路由：搜索应用
app.get('/api/search', async (c) => {
  const term = c.req.query('term') || ''
  
  if (!term) {
    return c.json({
      success: false,
      message: '缺少搜索词'
    }, 400)
  }
  
  try {
    const playStoreService = new PlayStoreService()
    const results = await playStoreService.search(term)
    
    return c.json({
      success: true,
      results: results
    })
  } catch (err) {
    return c.json({
      success: false,
      message: err.message
    }, 500)
  }
})

// API 路由：价格检查（模拟）
app.post('/api/check', async (c) => {
  try {
    // 在实际实现中，这里应该执行价格检查逻辑
    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return c.json({
      success: true,
      message: "价格检查完成"
    })
  } catch (err) {
    return c.json({
      success: false,
      message: err.message
    }, 500)
  }
})

// 导出应用
export default app