import { Hono } from 'hono'
import { PlayService } from '../services/play.service'
import { success } from '../index'

export const searchRoute = new Hono()

// 搜索应用
searchRoute.get('/', async (c) => {
  try {
    const query = c.req.query('q')
    if (!query) {
      return c.json({ success: false, message: 'Query parameter is required' }, 400)
    }
    
    const playService = new PlayService()
    const results = await playService.search(query)
    return success(results)
  } catch (error) {
    throw new HTTPException(500, { message: error.message })
  }
})