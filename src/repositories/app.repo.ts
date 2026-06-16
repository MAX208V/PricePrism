export class AppRepository {
  private KV_NAMESPACE = "apps"

  constructor(private env: any) {}

  /**
   * 获取应用列表
   * @returns 应用列表
   */
  async list() {
    try {
      const data = await this.env.KV.get(this.KV_NAMESPACE, { type: 'json' })
      return data || []
    } catch (error) {
      console.error('Error getting apps list:', error)
      return []
    }
  }

  /**
   * 获取单个应用
   * @param id 应用ID
   * @returns 应用数据
   */
  async get(id: string) {
    const apps = await this.list()
    return apps.find(app => app.id === id)
  }

  /**
   * 创建应用
   * @param data 应用数据
   * @returns 创建的应用
   */
  async create(data: any) {
    const apps = await this.list()
    apps.push(data)
    await this.env.KV.put(this.KV_NAMESPACE, JSON.stringify(apps))
    return data
  }

  /**
   * 更新应用
   * @param id 应用ID
   * @param data 更新数据
   * @returns 更新后的应用
   */
  async update(id: string, data: any) {
    const apps = await this.list()
    const index = apps.findIndex(app => app.id === id)
    
    if (index === -1) {
      throw new Error('App not found')
    }
    
    apps[index] = { ...apps[index], ...data }
    await this.env.KV.put(this.KV_NAMESPACE, JSON.stringify(apps))
    return apps[index]
  }

  /**
   * 删除应用
   * @param id 应用ID
   */
  async remove(id: string) {
    const apps = await this.list()
    const filtered = apps.filter(app => app.id !== id)
    await this.env.KV.put(this.KV_NAMESPACE, JSON.stringify(filtered))
  }
}