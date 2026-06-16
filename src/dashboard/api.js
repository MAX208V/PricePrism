/**
 * API客户端
 */
export const api = {
  /**
   * 获取应用列表
   * @returns Promise<App[]>
   */
  async apps() {
    const response = await fetch('/api/apps');
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return result.data;
  },

  /**
   * 添加应用
   * @param {Object} data 应用数据
   * @returns Promise<App>
   */
  async addApp(data) {
    const response = await fetch('/api/apps', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return result.data;
  },

  /**
   * 删除应用
   * @param {string} id 应用ID
   */
  async removeApp(id) {
    const response = await fetch(`/api/apps/${id}`, {
      method: 'DELETE',
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return result.data;
  },

  /**
   * 更新应用
   * @param {string} id 应用ID
   * @param {Object} data 更新数据
   * @returns Promise<App>
   */
  async updateApp(id, data) {
    const response = await fetch(`/api/apps/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return result.data;
  },

  /**
   * 搜索应用
   * @param {string} query 搜索关键词
   * @returns Promise<SearchResults>
   */
  async search(query) {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return result.data;
  },

  /**
   * 获取历史价格
   * @param {string} id 应用ID
   * @returns Promise<AppHistory[]>
   */
  async history(id) {
    const response = await fetch(`/api/history/${id}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return result.data;
  },

  /**
   * 检查所有应用
   */
  async checkAll() {
    const response = await fetch('/api/system/check', {
      method: 'POST',
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return result.data;
  },

  /**
   * 检查单个应用
   * @param {string} id 应用ID
   */
  async checkApp(id) {
    const response = await fetch(`/api/system/check/${id}`, {
      method: 'POST',
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return result.data;
  }
};