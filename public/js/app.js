/**
 * Main application entry point
 */

// 从window对象获取所需函数而不是使用import
const { getApps, addApp, editApp, deleteApp, checkAll, search } = window;

// Global variables
let edId = null; // For tracking which app is being edited
let detailData = null; // For tracking detail view data

// Make global functions available for inline event handlers
window.edId = edId;
window.detailData = detailData;
window.editApp = editAppWrapper;
window.removeApp = removeApp;
window.checkAll = checkAllWrapper;
window.doSearch = doSearch;
window.addFromDetail = addFromDetail;
window.saveEdit = saveEdit;
window.closeEdit = closeEdit;
window.closeDetail = closeDetail;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, starting app initialization...');
  try {
    // Load apps and history
    await loadData();
    
    // Set up form submission handler
    const form = document.getElementById('af');
    if (form) {
      form.addEventListener('submit', addAppWrapper);
      console.log('Form submission handler attached');
    } else {
      console.error('Form element not found');
    }
  } catch (error) {
    console.error('Error during initialization:', error);
  }
});

/**
 * Load apps and history data
 * @returns {Promise<void>}
 */
async function loadData() {
  try {
    // Show loading states
    document.getElementById('appList').innerHTML = '<div class="cd" style="text-align:center;padding:32px;color:var(--m);font-weight:500;font-size:14px">加载中...</div>';
    document.getElementById('historyList').innerHTML = '<div style="text-align:center;padding:20px;color:var(--m);font-weight:500;font-size:14px">加载中...</div>';
    
    // Fetch all data from single API endpoint
    const data = await getApps();
    
    // Extract apps and history from response
    const apps = data.apps || [];
    const history = data.history || [];
    const hasSc3 = data.hasSc3 || false;
    const hasProxy = data.hasProxy || false;
    
    // Render data
    window.renderAppCards(apps);
    window.renderHistory(history);
    
    // Show/hide warning section based on SC3 configuration
    const warningSection = document.getElementById('warning-section');
    if (warningSection) {
      warningSection.style.display = hasSc3 ? 'none' : 'block';
    }
    
    // Show/hide search section based on proxy configuration
    const searchSection = document.getElementById('searchSection');
    if (searchSection) {
      searchSection.style.display = hasProxy ? 'block' : 'none';
    }
  } catch (error) {
    console.error('Failed to load data:', error);
    showToast('加载数据失败: ' + error.message);
    
    // Show error messages in place of loading indicators
    try {
      document.getElementById('appList').innerHTML = '<div class="cd" style="text-align:center;padding:32px;color:var(--r);font-weight:500;font-size:14px">加载失败: ' + error.message + '</div>';
      document.getElementById('historyList').innerHTML = '<div style="text-align:center;padding:20px;color:var(--r);font-weight:500;font-size:14px">加载失败: ' + error.message + '</div>';
    } catch (domError) {
      console.error('Failed to update DOM with error messages:', domError);
    }
  }
}

/**
 * Wrapper for addApp functionality
 * @param {Event} e - Form submit event
 * @returns {Promise<void>}
 */
async function addAppWrapper(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  
  const data = {
    app_id: formData.get('app_id'),
    name: formData.get('name') || '',
    threshold: parseFloat(formData.get('threshold')),
    country: formData.get('country'),
    note: formData.get('note') || '',
    monitor_mode: document.getElementById('monitorMode')?.checked ? 'change' : 'threshold'
  };
  
  try {
    await addApp(data);
    showToast('已添加');
    form.reset();
    setTimeout(() => {
      location.reload();
    }, 800);
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Wrapper for editApp functionality
 * @param {string} id - App ID
 * @param {string} name - App name
 * @param {string} country - Country code
 * @param {number} threshold - Threshold value
 * @param {string} note - Note text
 * @param {string} monitorMode - Monitor mode
 * @returns {void}
 */
function editAppWrapper(id, name, country, threshold, note, monitorMode) {
  showEdit(id, name, country, threshold, note, monitorMode);
  window.edId = id;
}

/**
 * Save edited app
 * @returns {Promise<void>}
 */
async function saveEdit() {
  if (!window.edId) return;
  
  const name = document.getElementById('eName').value.trim();
  const threshold = parseFloat(document.getElementById('eThreshold').value);
  const country = document.getElementById('eCountry').value.trim();
  const note = document.getElementById('eNote').value.trim();
  const monitorMode = document.getElementById('eMonitorMode').checked ? 'change' : 'threshold';
  
  if (!name) {
    showToast('名称不能为空');
    return;
  }
  
  if (isNaN(threshold) || threshold <= 0) {
    showToast('无效阈值');
    return;
  }
  
  const data = {
    app_id: window.edId,
    name: name,
    threshold: threshold,
    country: country,
    note: note,
    monitor_mode: monitorMode
  };
  
  try {
    await editApp(data);
    showToast('已更新');
    closeEdit();
    setTimeout(() => {
      location.reload();
    }, 800);
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Remove an app
 * @param {string} id - App ID
 * @returns {Promise<void>}
 */
async function removeApp(id) {
  if (!confirm('确认删除？')) return;
  
  try {
    await deleteApp(id);
    showToast('已删除');
    setTimeout(() => {
      location.reload();
    }, 800);
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Wrapper for checkAll functionality
 * @returns {Promise<void>}
 */
async function checkAllWrapper() {
  try {
    showToast('正在检查...');
    await checkAll();
    showToast('检查完成');
    setTimeout(() => {
      location.reload();
    }, 1500);
  } catch (error) {
    showToast(error.message);
  }
}

/**
 * Perform search
 * @returns {Promise<void>}
 */
async function doSearch() {
  const searchTerm = document.getElementById('searchTerm').value.trim();
  
  if (!searchTerm) {
    showToast('请输入关键词');
    return;
  }
  
  const resultsContainer = document.getElementById('searchResults');
  resultsContainer.textContent = '搜索中...';
  
  try {
    const data = await search(searchTerm);
    
    if (!data.results || data.results.length === 0) {
      resultsContainer.innerHTML = "<div style='text-align:center;padding:20px;color:var(--m)'>未找到结果</div>";
      return;
    }
    
    let html = '';
    
    for (const result of data.results) {
      html += `
        <div class='sri' onclick='showDetail("${escapeJs(result.appId)}","${escapeJs(result.title)}","${escapeJs(result.icon || '')}","${escapeJs(result.priceText || (result.free ? '免费' : ''))}","${escapeJs(result.developer || '')}","${escapeJs(result.scoreText || '')}")'>
          ${result.icon ? `<img src='${result.icon}' alt='' onerror='this.style.display="none"'>` : ''}
          <div class='srd'>
            <div class='srn'>${escapeHtml(result.title)}</div>
            <div class='sra'>${escapeHtml(result.appId)} - ${escapeHtml(result.developer || '')}</div>
          </div>
          <div class='srp'>${escapeHtml(result.priceText || (result.free ? '免费' : ''))}</div>
        </div>
      `;
    }
    
    resultsContainer.innerHTML = `<div class='sr'>${html}</div>`;
  } catch (error) {
    resultsContainer.innerHTML = "<div style='text-align:center;padding:20px;color:var(--m)'>搜索失败</div>";
    console.error('Search failed:', error);
  }
}

/**
 * Add app from detail view
 * @returns {Promise<void>}
 */
async function addFromDetail() {
  if (!window.detailData) return;
  
  const addButton = document.getElementById('detailAddBtn');
  const threshold = parseFloat(document.getElementById('dtThreshold').value);
  const country = document.getElementById('dtCountry').value.trim();
  const note = document.getElementById('dtNote').value.trim();
  const monitorMode = document.getElementById('dtMonitorMode').checked ? 'change' : 'threshold';
  
  if (isNaN(threshold) || threshold <= 0) {
    showToast('无效阈值');
    return;
  }
  
  addButton.disabled = true;
  addButton.textContent = '添加中...';
  
  try {
    await addApp({
      app_id: window.detailData.id,
      name: window.detailData.title,
      threshold: threshold,
      country: country || 'us',
      note: note,
      monitor_mode: monitorMode
    });
    
    showToast('已添加');
    closeDetail();
    setTimeout(() => {
      location.reload();
    }, 800);
  } catch (error) {
    showToast(error.message);
    addButton.disabled = false;
    addButton.textContent = '添加监控';
  }
}

/**
 * Show toast message
 * @param {string} message - Message to show
 * @returns {void}
 */
function showToast(message) {
  const toast = document.getElementById('tt');
  if (!toast) {
    console.error('Toast element not found');
    return;
  }
  toast.textContent = message;
  toast.classList.add('s');
  
  clearTimeout(window.ttm);
  window.ttm = setTimeout(() => {
    toast.classList.remove('s');
  }, 2500);
}

/**
 * Escape JavaScript string for use in onclick attributes
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeJs(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"');
}

/**
 * Escape HTML characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}