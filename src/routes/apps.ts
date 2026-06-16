import { Hono } from 'hono'
import { AppService } from '../services/app.service'
import { success } from '../index'

export const appsRoute = new Hono()

// 获取应用列表
appsRoute.get('/', async (c) => {
  try {
    const appService = new AppService(c.env)
    const apps = await appService.list()
    return success(apps)
  } catch (error) {
    throw new HTTPException(500, { message: error.message })
  }
})

// 添加监控应用
appsRoute.post('/', async (c) => {
  try {
    const data = await c.req.json()
    const appService = new AppService(c.env)
    const app = await appService.create(data)
    return success(app)
  } catch (error) {
    throw new HTTPException(500, { message: error.message })
  }
})

// 删除监控应用
appsRoute.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const appService = new AppService(c.env)
    await appService.remove(id)
    return success({ id })
  } catch (error) {
    throw new HTTPException(500, { message: error.message })
  }
})

// 更新监控应用
appsRoute.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const data = await c.req.json()
    const appService = new AppService(c.env)
    const app = await appService.update(id, data)
    return success(app)
  } catch (error) {
    throw new HTTPException(500, { message: error.message })
  }
})