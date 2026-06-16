/**
 * 应用数据访问层
 */
export class AppsRepository {
  private KV_KEY = 'apps'
  
  constructor(private env: any) {}
  
  /**
   * 获取所有应用
   */
  async list(): Promise<any[]> {
    try {
      const data = await this.env.KV.get(this.KV_KEY, 'json')
      return Array.isArray(data) ? data : []
    } catch (err) {
      console.error('获取应用列表失败:', err)
      return []
    }
  }
  
  /**
   * 根据应用ID获取应用
   * @param appId Google Play 应用ID
   */
  async getByAppId(appId: string) {
    const apps = await this.list()
    return apps.find((app: any) => app.appId === appId)
  }
  
  /**
   * 创建应用
   * @param app 应用对象
   */
  async create(app: any) {
    const apps = await this.list()
    apps.push(app)
    await this.env.KV.put(this.KV_KEY, JSON.stringify(apps))
    return app
  }
  
  /**
   * 根据应用ID更新应用
   * @param appId Google Play 应用ID
   * @param app 应用对象
   */
  async updateByAppId(appId: string, app: any) {
    const apps = await this.list()
    const index = apps.findIndex((item: any) => item.appId === appId)
    
    if (index === -1) {
      throw new Error('应用不存在')
    }
    
    apps[index] = app
    await this.env.KV.put(this.KV_KEY, JSON.stringify(apps))
    return app
  }
  
  /**
   * 根据应用ID删除应用
   * @param appId Google Play 应用ID
   */
  async deleteByAppId(appId: string) {
    const apps = await this.list()
    const filtered = apps.filter((app: any) => app.appId !== appId)
    await this.env.KV.put(this.KV_KEY, JSON.stringify(filtered))
  }
}