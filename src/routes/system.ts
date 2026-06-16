import { Hono } from 'hono'
import { MonitorService } from '../services/monitor.service'
import { success } from '../index'

export const systemRoute = new Hono()

// 立即检查所有应用
systemRoute.post('/check', async (c) => {
  try {
    const monitorService = new MonitorService(c.env)
    await monitorService.checkAll()
    return success({ message: 'Check completed' })
  } catch (error) {
    throw new HTTPException(500, { message: error.message })
  }
})

// 检查单个应用
systemRoute.post('/check/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const monitorService = new MonitorService(c.env)
    await monitorService.checkApp(id)
    return success({ message: 'Check completed' })
  } catch (error) {
    throw new HTTPException(500, { message: error.message })
  }
})