// ==================== State ====================
let editingAppId = null;
let detailData = null;

// ==================== API Helper ====================
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

// ==================== Toast ====================
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

// ==================== Format Time ====================
function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = n => n < 10 ? '0' + n : '' + n;
  return pad(d.getUTCMonth() + 1) + '/' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
}

// ==================== Price Display ====================
function getPriceDisplay(r) {
  if (!r) return { text: '-', isFree: false };
  const isFree = r.free === true || r.price === 0 || r.price === '0';
  if (isFree) return { text: '免费', isFree: true };
  if (r.price !== undefined && r.price !== null && r.price !== 0) {
    return { text: '$' + parseFloat(r.price).toFixed(2), isFree: false };
  }
  return { text: '-', isFree: false };
}

// ==================== Escape HTML ====================
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==================== Load Dashboard ====================
async function loadDashboard() {
  try {
    const data = await api('/api/dashboard');
    renderApps(data.apps);
    renderHistory(data.history);
  } catch (e) {
    showToast('加载失败: ' + e.message);
  }
}

// ==================== Render Apps ====================
function renderApps(apps) {
  const container = document.getElementById('appsList');
  const countEl = document.getElementById('appsCount');
  countEl.textContent = apps ? apps.length : 0;

  if (!apps || apps.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无监控应用</div>';
    return;
  }

  container.innerHTML = apps.map(app => {
    const st = app.status || {};
    const price = st.last_checked_price;
    const isFree = st.last_checked_free;
    const priceInfo = getPriceDisplay({ free: isFree, price });
    const threshold = app.threshold;
    const isBelow = !isFree && !app.monitor_mode && price !== undefined && price > 0 && price < threshold;
    const isChangeMode = app.monitor_mode === 'change';
    const icon = st.icon || '';
    const score = st.scoreText || '';
    const note = app.note || '';

    const html = [
      '<div class="app-card">',
        '<div class="app-card-main">',
          icon ? '<img src="' + escapeHtml(icon) + '" class="app-card-icon" onerror="this.style.display=\'none\'">' : '<div class="app-card-icon"></div>',
          '<div class="app-card-body">',
            '<div class="app-card-name">' + escapeHtml(app.name) + '</div>',
            '<div class="app-card-meta">',
              '<span>' + escapeHtml(app.id) + '</span>',
              score ? '<span>★ ' + escapeHtml(score) + '</span>' : '',
              isBelow ? '<span class="badge badge--success">低于阈值</span>' : '',
              isChangeMode ? '<span class="badge badge--warning">变动监控</span>' : '',
            '</div>',
          '</div>',
          '<div class="app-card-right">',
            '<div class="app-card-price' + (isBelow ? ' success' : '') + '">' + priceInfo.text + '</div>',
            '<div class="app-card-threshold">' + (isChangeMode ? '变动通知' : '阈值 $' + threshold) + '</div>',
          '</div>',
        '</div>',
        note ? '<div class="app-card-note"><span class="material-symbols-rounded" style="font-size:14px;vertical-align:middle;margin-right:4px;">sticky_note_2</span>' + escapeHtml(note) + '</div>' : '',
        '<div class="app-card-actions">',
          '<button class="btn btn-icon" onclick="openEditModal(\'' + escapeHtml(app.id) + '\',\'' + escapeHtml(app.name) + '\',\'' + escapeHtml(app.country || 'us') + '\',' + threshold + ',\'' + escapeHtml(note) + '\',' + isChangeMode + ')"><span class="material-symbols-rounded">edit</span></button>',
          '<button class="btn btn-icon" onclick="deleteApp(\'' + escapeHtml(app.id) + '\')" style="color:var(--negative)"><span class="material-symbols-rounded">delete</span></button>',
        '</div>',
      '</div>'
    ].join('');
    return html;
  }).join('');
}

// ==================== Render History ====================
function renderHistory(history) {
  const container = document.getElementById('historyList');
  const countEl = document.getElementById('historyCount');
  countEl.textContent = history ? history.length : 0;

  if (!history || history.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无记录</div>';
    return;
  }

  container.innerHTML = history.map(h => {
    return '<div class="history-item">' +
      '<span class="history-time">' + formatTime(h.time) + '</span>' +
      '<span class="history-name">' + escapeHtml(h.name) + '</span>' +
      '<span class="history-price">$' + h.price + '</span>' +
      '<span class="history-badge history-badge--' + (h.notified ? 'notified' : 'skipped') + '">' + (h.notified ? '已通知' : '跳过') + '</span>' +
    '</div>';
  }).join('');
}

// ==================== Search ====================
async function doSearch() {
  const term = document.getElementById('searchInput').value.trim();
  if (!term) {
    showToast('请输入关键词');
    return;
  }

  const resultsEl = document.getElementById('searchResults');
  resultsEl.innerHTML = '<div class="loading">搜索中...</div>';
  resultsEl.classList.add('visible');

  try {
    const data = await api('/api/search?term=' + encodeURIComponent(term));
    if (!data.results || data.results.length === 0) {
      resultsEl.innerHTML = '<div class="empty-state">未找到结果</div>';
      return;
    }

    resultsEl.innerHTML = data.results.map(r => {
      const pi = getPriceDisplay(r);
      return '<div class="search-item" onclick="showDetail(\'' + escapeHtml(r.appId) + '\',\'' + escapeHtml(r.title) + '\',\'' + escapeHtml(r.icon || '') + '\',\'' + pi.text + '\')">' +
        (r.icon ? '<img src="' + escapeHtml(r.icon) + '" class="search-item-icon" onerror="this.style.display=\'none\'">' : '<div class="search-item-icon"></div>') +
        '<div class="search-item-info">' +
          '<div class="search-item-title">' + escapeHtml(r.title) + '</div>' +
          '<div class="search-item-meta">' + escapeHtml(r.appId) + ' · ' + escapeHtml(r.developer || '') + '</div>' +
        '</div>' +
        '<div class="search-item-price">' + pi.text + '</div>' +
      '</div>';
    }).join('');
  } catch (e) {
    resultsEl.innerHTML = '<div class="empty-state">搜索失败</div>';
  }
}

// ==================== Detail Modal ====================
function showDetail(id, title, icon, priceText) {
  detailData = { id, title };
  document.getElementById('detailContent').innerHTML =
    (icon ? '<img src="' + escapeHtml(icon) + '" onerror="this.style.display=\'none\'">' : '') +
    '<div style="flex:1;min-width:0;">' +
      '<div class="detail-preview-title">' + escapeHtml(title) + '</div>' +
      '<div class="detail-preview-id">' + escapeHtml(id) + '</div>' +
    '</div>';
  document.getElementById('detailOverlay').classList.add('visible');
}

function closeDetailModal() {
  document.getElementById('detailOverlay').classList.remove('visible');
  detailData = null;
}

async function addFromDetail() {
  if (!detailData) return;

  const threshold = parseFloat(document.getElementById('detailThreshold').value);
  const country = document.getElementById('detailCountry').value.trim() || 'us';
  const note = document.getElementById('detailNote').value.trim();
  const monitorMode = document.getElementById('detailMonitorMode').checked;

  if (isNaN(threshold) || threshold <= 0) {
    showToast('请输入有效阈值');
    return;
  }

  try {
    await api('/api/apps', {
      method: 'POST',
      body: JSON.stringify({
        app_id: detailData.id,
        name: detailData.title,
        threshold,
        country,
        note,
        monitor_mode: monitorMode ? 'change' : 'threshold'
      })
    });
    showToast('已添加到监控列表');
    closeDetailModal();
    setTimeout(() => location.reload(), 500);
  } catch (e) {
    showToast(e.message);
  }
}

// ==================== Add App ====================
async function handleAddApp(e) {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    await api('/api/apps', {
      method: 'POST',
      body: JSON.stringify({
        app_id: form.get('app_id'),
        name: form.get('name') || '',
        threshold: parseFloat(form.get('threshold')),
        country: form.get('country') || 'us',
        note: form.get('note') || '',
        monitor_mode: form.get('monitor_mode') ? 'change' : 'threshold'
      })
    });
    showToast('已添加到监控列表');
    setTimeout(() => location.reload(), 500);
  } catch (e) {
    showToast(e.message);
  }
}

// ==================== Edit Modal ====================
function openEditModal(id, name, country, threshold, note, monitorMode) {
  editingAppId = id;
  document.getElementById('editName').value = name;
  document.getElementById('editThreshold').value = threshold;
  document.getElementById('editCountry').value = country;
  document.getElementById('editNote').value = note;
  document.getElementById('editMonitorMode').checked = monitorMode;
  document.getElementById('editOverlay').classList.add('visible');
}

function closeEditModal() {
  document.getElementById('editOverlay').classList.remove('visible');
  editingAppId = null;
}

async function handleEditApp() {
  if (!editingAppId) return;

  const name = document.getElementById('editName').value.trim();
  const threshold = parseFloat(document.getElementById('editThreshold').value);
  const country = document.getElementById('editCountry').value.trim();
  const note = document.getElementById('editNote').value.trim();
  const monitorMode = document.getElementById('editMonitorMode').checked;

  if (!name) {
    showToast('名称不能为空');
    return;
  }

  try {
    await api('/api/apps', {
      method: 'PATCH',
      body: JSON.stringify({
        app_id: editingAppId,
        name,
        threshold,
        country,
        note,
        monitor_mode: monitorMode ? 'change' : 'threshold'
      })
    });
    showToast('已更新');
    closeEditModal();
    setTimeout(() => location.reload(), 500);
  } catch (e) {
    showToast(e.message);
  }
}

// ==================== Delete App ====================
async function deleteApp(id) {
  if (!confirm('确认删除此应用？')) return;
  try {
    await api('/api/apps', {
      method: 'DELETE',
      body: JSON.stringify({ app_id: id })
    });
    showToast('已删除');
    setTimeout(() => location.reload(), 500);
  } catch (e) {
    showToast(e.message);
  }
}

// ==================== Event Listeners ====================
document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    doSearch();
  }
});

document.addEventListener('DOMContentLoaded', loadDashboard);
