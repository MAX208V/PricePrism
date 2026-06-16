export class CacheRepository {
  private CACHE_PREFIX = "cache:"
  private DEFAULT_TTL = 3600 // 1小时

  constructor(private env: any) {}

  /**
   * 获取缓存
   * @param key 缓存键
   * @returns 缓存值
   */
  async get(key: string) {
    try {
      const cacheKey = this.CACHE_PREFIX + key
      const cached = await this.env.KV.get(cacheKey, { type: 'json' })
      
      if (cached && cached.expireAt > Date.now()) {
        return cached.data
      }
      
      // 缓存过期，删除它
      if (cached) {
        await this.env.KV.delete(cacheKey)
      }
      
      return null
    } catch (error) {
      console.error('Error getting cache:', error)
      return null
    }
  }

  /**
   * 设置缓存
   * @param key 缓存键
   * @param data 缓存数据
   * @param ttl 过期时间（秒）
   */
  async set(key: string, data: any, ttl: number = this.DEFAULT_TTL) {
    try {
      const cacheKey = this.CACHE_PREFIX + key
      const expireAt = Date.now() + (ttl * 1000)
      
      await this.env.KV.put(cacheKey, JSON.stringify({ data, expireAt }), {
        expirationTtl: ttl
      })
    } catch (error) {
      console.error('Error setting cache:', error)
    }
  }

  /**
   * 删除缓存
   * @param key 缓存键
   */
  async delete(key: string) {
    try {
      const cacheKey = this.CACHE_PREFIX + key
      await this.env.KV.delete(cacheKey)
    } catch (error) {
      console.error('Error deleting cache:', error)
    }
  }
}