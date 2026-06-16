// 应用数据访问层
export class AppsRepository {
  constructor(private env: any) {}

  /**
   * 获取所有应用配置
   */
  async getAll(): Promise<any[]> {
    try {
      const data = await this.env.KV.get("config:apps", "json");
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('获取应用列表失败:', err);
      return [];
    }
  }

  /**
   * 根据应用ID获取应用配置
   */
  async getById(appId: string): Promise<any> {
    const apps = await this.getAll();
    return apps.find((app: any) => app.id === appId);
  }

  /**
   * 创建应用配置
   */
  async create(appConfig: any): Promise<void> {
    const apps = await this.getAll();
    apps.push(appConfig);
    await this.env.KV.put("config:apps", JSON.stringify(apps));
  }

  /**
   * 更新应用配置
   */
  async update(appId: string, updatedFields: any): Promise<void> {
    const apps = await this.getAll();
    const index = apps.findIndex((app: any) => app.id === appId);
    
    if (index === -1) {
      throw new Error('应用不存在');
    }
    
    // 更新字段
    for (const key in updatedFields) {
      if (key !== "id") {
        apps[index][key] = updatedFields[key];
      }
    }
    
    await this.env.KV.put("config:apps", JSON.stringify(apps));
  }

  /**
   * 删除应用配置
   */
  async delete(appId: string): Promise<void> {
    const apps = await this.getAll();
    const filtered = apps.filter((app: any) => app.id !== appId);
    await this.env.KV.put("config:apps", JSON.stringify(filtered));
    // 同时删除状态数据
    await this.env.KV.delete("status:" + appId);
  }
}