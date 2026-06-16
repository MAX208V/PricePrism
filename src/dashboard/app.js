// 导入API和状态管理
import { api } from './api.js';
import { store } from './store.js';

// DOM元素
const elements = {
  refreshBtn: document.getElementById('refreshBtn'),
  checkAllBtn: document.getElementById('checkAllBtn'),
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  searchResults: document.getElementById('searchResults'),
  appsList: document.getElementById('appsList'),
  addAppForm: document.getElementById('addAppForm'),
  historyList: document.getElementById('historyList')
};

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
  initApp();
});

/**
 * 初始化应用
 */
async function initApp() {
  // 绑定事件监听器
  bindEvents();
  
  // 加载初始数据
  await store.loadApps();
}

/**
 * 绑定事件监听器
 */
function bindEvents() {
  // 刷新按钮
  elements.refreshBtn.addEventListener('click', async () => {
    showLoading(elements.refreshBtn, '刷新中...');
    await store.loadApps();
    showLoading(elements.refreshBtn, '刷新', false);
  });

  // 检查所有按钮
  elements.checkAllBtn.addEventListener('click', async () => {
    showLoading(elements.checkAllBtn, '检查中...');
    await store.checkAll();
    showLoading(elements.checkAllBtn, '检查所有', false);
  });

  // 搜索按钮
  elements.searchBtn.addEventListener('click', () => {
    const query = elements.searchInput.value.trim();
    if (query) {
      store.searchApps(query);
    }
  });

  // 搜索输入框回车事件
  elements.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = elements.searchInput.value.trim();
      if (query) {
        store.searchApps(query);
      }
    }
  });

  // 添加应用表单
  elements.addAppForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(elements.addAppForm);
    const data = {
      appId: formData.get('appId'),
      threshold: parseFloat(formData.get('threshold')),
      country: formData.get('country'),
      note: formData.get('note'),
      monitorMode: formData.get('monitorMode') ? 'change' : 'threshold'
    };
    
    if (!data.appId) {
      showMessage('请填写Google Play ID', 'error');
      return;
    }
    
    if (isNaN(data.threshold) || data.threshold <= 0) {
      showMessage('请填写有效的降价阈值', 'error');
      return;
    }
    
    store.addApp(data);
  });
}

/**
 * 渲染应用列表
 */
function renderApps() {
  if (store.apps.length === 0) {
    elements.appsList.innerHTML = '<div class="empty-state">暂无监控的应用</div>';
    return;
  }

  elements.appsList.innerHTML = store.apps.map(app => `
    <div class="app-card" data-id="${app.id}">
      <div class="app-header">
        <div>
          <div class="app-title">${escapeHtml(app.name)}</div>
          <div class="app-id">${escapeHtml(app.appId)}</div>
          ${app.note ? `<div class="app-note">${escapeHtml(app.note)}</div>` : ''}
        </div>
        <span class="status-badge ${app.price > 0 && app.price < app.threshold ? 'low' : 'normal'}">
          ${app.price > 0 && app.price < app.threshold ? '低于阈值' : '正常'}
        </span>
      </div>
      
      <div class="app-stats">
        <div class="stat-item">
          <span class="stat-label">当前价格</span>
          <span class="stat-value ${app.price > 0 && app.price < app.threshold ? 'low' : ''}">
            ${app.price ? `$${app.price}` : '-'}
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label">阈值</span>
          <span class="stat-value">$${app.threshold}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">地区</span>
          <span class="stat-value">${app.country || 'us'}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">更新时间</span>
          <span class="stat-value">${formatDate(app.updatedAt)}</span>
        </div>
      </div>
      
      <div class="app-actions">
        <button class="btn-secondary" onclick="editApp('${app.id}')">编辑</button>
        <button class="btn-danger" onclick="removeApp('${app.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

/**
 * 渲染搜索结果
 */
function renderSearchResults() {
  if (store.searchResults.length === 0) {
    elements.searchResults.innerHTML = '<div class="empty-state">未找到相关应用</div>';
    return;
  }

  elements.searchResults.innerHTML = store.searchResults.map(result => `
    <div class="result-item" onclick="addFromSearch('${escapeHtml(result.appId)}')">
      <div class="result-header">
        ${result.icon ? `<img src="${escapeHtml(result.icon)}" alt="" class="result-icon">` : ''}
        <div>
          <div class="result-title">${escapeHtml(result.title)}</div>
          <div class="result-developer">${escapeHtml(result.developer)}</div>
        </div>
      </div>
      <div class="result-price">${result.free ? '免费' : (result.price ? `$${result.price}` : '价格未知')}</div>
    </div>
  `).join('');
}

/**
 * 显示消息
 * @param {string} message 消息内容
 * @param {string} type 消息类型 (success, error, info)
 */
function showMessage(message, type = 'info') {
  // 创建消息元素
  const messageEl = document.createElement('div');
  messageEl.className = `message message-${type}`;
  messageEl.textContent = message;
  
  // 添加样式
  Object.assign(messageEl.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '12px 20px',
    borderRadius: '8px',
    color: 'white',
    fontWeight: '500',
    zIndex: '1000',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    transform: 'translateX(100%)',
    transition: 'transform 0.3s ease-out'
  });
  
  // 根据类型设置背景色
  switch (type) {
    case 'success':
      messageEl.style.backgroundColor = '#4caf50';
      break;
    case 'error':
      messageEl.style.backgroundColor = '#f44336';
      break;
    default:
      messageEl.style.backgroundColor = '#2196f3';
  }
  
  // 添加到页面
  document.body.appendChild(messageEl);
  
  // 显示动画
  setTimeout(() => {
    messageEl.style.transform = 'translateX(0)';
  }, 100);
  
  // 3秒后自动移除
  setTimeout(() => {
    messageEl.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 300);
  }, 3000);
}

/**
 * 显示加载状态
 * @param {HTMLElement} button 按钮元素
 * @param {string} text 显示文本
 * @param {boolean} loading 是否加载中
 */
function showLoading(button, text, loading = true) {
  if (loading) {
    button.disabled = true;
    button.textContent = text;
  } else {
    button.disabled = false;
    button.textContent = text;
  }
}

/**
 * 转义HTML特殊字符
 * @param {string} text 文本
 * @returns 转义后的文本
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 格式化日期
 * @param {number} timestamp 时间戳
 * @returns 格式化后的日期字符串
 */
function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * 从搜索结果添加应用
 * @param {string} appId 应用ID
 */
function addFromSearch(appId) {
  document.getElementById('appId').value = appId;
  document.getElementById('searchResults').innerHTML = '';
  document.getElementById('searchInput').value = '';
  // 滚动到添加表单
  document.getElementById('addAppSection').scrollIntoView({ behavior: 'smooth' });
}

/**
 * 编辑应用
 * @param {string} id 应用ID
 */
function editApp(id) {
  const app = store.apps.find(a => a.id === id);
  if (!app) return;
  
  // 这里应该打开编辑模态框
  // 为了简化，我们直接填充表单并滚动到表单位置
  document.getElementById('appId').value = app.appId;
  document.getElementById('threshold').value = app.threshold;
  document.getElementById('country').value = app.country || 'us';
  document.getElementById('note').value = app.note || '';
  document.getElementById('monitorMode').checked = app.monitorMode === 'change';
  
  // 滚动到添加表单
  document.getElementById('addAppSection').scrollIntoView({ behavior: 'smooth' });
  
  // 显示提示消息
  showMessage('请修改表单中的信息然后重新添加应用', 'info');
}

/**
 * 删除应用
 * @param {string} id 应用ID
 */
function removeApp(id) {
  if (confirm('确定要删除这个应用吗？')) {
    store.removeApp(id);
  }
}

// 将函数暴露到全局作用域，以便HTML可以直接调用
window.addFromSearch = addFromSearch;
window.editApp = editApp;
window.removeApp = removeApp;