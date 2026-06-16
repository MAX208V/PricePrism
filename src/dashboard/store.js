/**
 * 状态管理
 */
export const store = {
  apps: [],
  history: {},
  searchResults: [],

  /**
   * 加载应用列表
   */
  async loadApps() {
    try {
      this.apps = await api.apps();
      renderApps();
    } catch (error) {
      console.error('加载应用列表失败:', error);
      showMessage('加载应用列表失败: ' + error.message, 'error');
    }
  },

  /**
   * 添加应用
   * @param {Object} data 应用数据
   */
  async addApp(data) {
    try {
      const app = await api.addApp(data);
      this.apps.push(app);
      renderApps();
      document.getElementById('addAppForm').reset();
      showMessage('应用添加成功', 'success');
    } catch (error) {
      console.error('添加应用失败:', error);
      showMessage('添加应用失败: ' + error.message, 'error');
    }
  },

  /**
   * 删除应用
   * @param {string} id 应用ID
   */
  async removeApp(id) {
    try {
      await api.removeApp(id);
      this.apps = this.apps.filter(app => app.id !== id);
      renderApps();
      showMessage('应用删除成功', 'success');
    } catch (error) {
      console.error('删除应用失败:', error);
      showMessage('删除应用失败: ' + error.message, 'error');
    }
  },

  /**
   * 搜索应用
   * @param {string} query 搜索关键词
   */
  async searchApps(query) {
    try {
      const results = await api.search(query);
      this.searchResults = results.results || [];
      renderSearchResults();
    } catch (error) {
      console.error('搜索应用失败:', error);
      showMessage('搜索应用失败: ' + error.message, 'error');
    }
  },

  /**
   * 检查所有应用
   */
  async checkAll() {
    try {
      await api.checkAll();
      showMessage('价格检查完成', 'success');
      // 重新加载应用列表以显示更新的价格
      await this.loadApps();
    } catch (error) {
      console.error('检查应用失败:', error);
      showMessage('检查应用失败: ' + error.message, 'error');
    }
  }
};