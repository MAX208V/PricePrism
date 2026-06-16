import { Hono } from 'hono'
import { HistoryRepository } from '../repositories/history.repo'
import { success } from '../index'

export const historyRoute = new Hono()

// 获取历史价格
historyRoute.get('/:id', async (c) => {
  try {
    const appId = c.req.param('id')
    const historyRepo = new HistoryRepository()
    const history = await historyRepo.get(appId)
    return success(history)
  } catch (error) {
    throw new HTTPException(500, { message: error.message })
  }
})