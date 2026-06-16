// 应用状态数据访问层
export class StatusRepository {
  constructor(private env: any) {}

  /**
   * 获取应用状态
   */
  async getStatus(appId: string): Promise<any> {
    try {
      const status = await this.env.KV.get("status:" + appId, "json");
      return status || {};
    } catch (err) {
      console.error('获取应用状态失败:', err);
      return {};
    }
  }

  /**
   * 更新应用状态
   */
  async updateStatus(appId: string, status: any): Promise<void> {
    await this.env.KV.put("status:" + appId, JSON.stringify(status));
  }

  /**
   * 删除应用状态
   */
  async deleteStatus(appId: string): Promise<void> {
    await this.env.KV.delete("status:" + appId);
  }
}