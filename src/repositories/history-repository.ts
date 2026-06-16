// 历史记录数据访问层
const HISTORY_MAX = 50;

export class HistoryRepository {
  constructor(private env: any) {}

  /**
   * 获取历史记录
   */
  async getHistory(): Promise<any[]> {
    try {
      const history = await this.env.KV.get("history", "json");
      return Array.isArray(history) ? history : [];
    } catch (err) {
      console.error('获取历史记录失败:', err);
      return [];
    }
  }

  /**
   * 添加历史记录
   */
  async appendHistory(entry: any): Promise<void> {
    let history = await this.getHistory();
    history.unshift(entry);
    
    // 限制历史记录数量
    if (history.length > HISTORY_MAX) {
      history = history.slice(0, HISTORY_MAX);
    }
    
    await this.env.KV.put("history", JSON.stringify(history));
  }
}