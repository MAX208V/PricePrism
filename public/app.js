// State
let editingAppId = null;
let detailData = null;

// API helper
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

// Toast
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

// Format UTC time
function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = n => n < 10 ? '0' + n : '' + n;
  return pad(d.getUTCMonth() + 1) + '/' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
}

// Price display helper
function getPriceDisplay(r) {
  if (!r) return '-';
  if (r.free === true || r.price === 0) {
    const a = r.containsAds === true;
    const i = r.offersIAP === true;
    if (a && i) return '免费·含广告+内购';
    if (a) return '免费·含广告';
    if (i) return '免费·含内购';
    return '免费';
  }
  if (r.price !== undefined && r.price !== null && r.price !== 0) {
    return '$' + parseFloat(r.price).toFixed(2);
  }
  return '-';
}

// Load dashboard data
async function loadDashboard() {
  try {
    const data = await api('/api/dashboard');
    renderApps(data.apps);
    renderHistory(data.history);
  } catch (e) {
    showToast('加载失败: ' + e.message);
  }
}

// Render apps
function renderApps(apps) {
  const container = document.getElementById('appsList');
  if (!apps || apps.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = apps.map(app => {
    const status = app.status || {};
    const price = status.last_checked_price;
    const isFree = status.last_checked_free;
    const priceStr = isFree ? '免费' : (price !== undefined ? '$' + price : '-');
    const threshold = app.threshold;
    const isBelowThreshold = !isFree && !app.monitor_mode && price !== undefined && price > 0 && price < threshold;
    const isChangeMode = app.monitor_mode === 'change';
    
    const icon = status.icon || '';
    const score = status.scoreText || '';
    const note = app.note || '';
    
    return `
      <div class="app-card" style="margin-bottom: var(--space-md);">
        <div class="app-header">
          ${icon ? `<img src="${escapeHtml(icon)}" class="app-icon" onerror="this.style.display='none'">` : '<div class="app-icon"></div>'}
          <div class="app-info">
            <div class="app-name">${escapeHtml(app.name)}</div>
            <div class="app-id">${escapeHtml(app.id)}</div>
          </div>
          ${isBelowThreshold ? '<span class="app-badge">低于阈值</span>' : ''}
        </div>
        <div class="app-body">
          <div class="grid-2">
            <div class="grid-item">
              <div class="grid-label">当前价格</div>
              <div class="grid-value${isBelowThreshold ? ' success' : ''}">${priceStr}</div>
            </div>
            <div class="grid-item">
              <div class="grid-label">${isChangeMode ? '监控模式' : '阈值'}</div>
              <div class="grid-value">${isChangeMode ? '变动通知' : '$' + threshold}</div>
            </div>
            ${score ? `
            <div class="grid-item">
              <div class="grid-label">评分</div>
              <div class="grid-value">★ ${score}</div>
            </div>
            ` : ''}
            ${note ? `
            <div class="grid-item">
              <div class="grid-label">备注</div>
              <div class="grid-value" style="font-size: 12px; color: var(--warning-deep);">${escapeHtml(note)}</div>
            </div>
            ` : ''}
          </div>
          <div class="app-actions">
            <button class="btn btn-icon" onclick="openEditModal('${escapeHtml(app.id)}', '${escapeHtml(app.name)}', '${escapeHtml(app.country || 'us')}', ${threshold}, '${escapeHtml(note)}', ${isChangeMode})">
              <span class="material-symbols-rounded">edit</span>
            </button>
            <button class="btn btn-icon danger" onclick="deleteApp('${escapeHtml(app.id)}')">
              <span class="material-symbols-rounded">delete</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Render history
function renderHistory(history) {
  const container = document.getElementById('historyList');
  if (!history || history.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无记录</div>';
    return;
  }

  container.innerHTML = history.map(h => `
    <div class="history-item">
      <span class="history-time">${formatTime(h.time)}</span>
      <span class="history-name">${escapeHtml(h.name)}</span>
      <span class="history-price">$${h.price}</span>
      <span class="history-badge ${h.notified ? 'notified' : 'skipped'}">${h.notified ? '已通知' : '跳过'}</span>
    </div>
  `).join('');
}

// Escape HTML
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Search
async function doSearch() {
  const term = document.getElementById('searchInput').value.trim();
  if (!term) {
    showToast('请输入关键词');
    return;
  }

  const resultsEl = document.getElementById('searchResults');
  resultsEl.innerHTML = '<div class="loading">搜索中...</div>';

  try {
    const data = await api('/api/search?term=' + encodeURIComponent(term));
    if (!data.results || data.results.length === 0) {
      resultsEl.innerHTML = '<div class="empty-state">未找到结果</div>';
      return;
    }

    resultsEl.innerHTML = data.results.map(r => `
      <div class="search-item" onclick="showDetail('${escapeHtml(r.appId)}', '${escapeHtml(r.title)}', '${escapeHtml(r.icon || '')}', '${escapeHtml(getPriceDisplay(r))}')">
        ${r.icon ? `<img src="${escapeHtml(r.icon)}" class="search-item-icon" onerror="this.style.display='none'">` : '<div class="search-item-icon"></div>'}
        <div class="search-item-info">
          <div class="search-item-title">${escapeHtml(r.title)}</div>
          <div class="search-item-meta">${escapeHtml(r.appId)} · ${escapeHtml(r.developer || '')}</div>
        </div>
        <div class="search-item-price">${getPriceDisplay(r)}</div>
      </div>
    `).join('');
  } catch (e) {
    resultsEl.innerHTML = '<div class="empty-state">搜索失败</div>';
    showToast(e.message);
  }
}

// Show detail modal
function showDetail(id, title, icon, price) {
  detailData = { id, title };
  
  let html = '<div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-md);">';
  if (icon) {
    html += `<img src="${escapeHtml(icon)}" style="width: 44px; height: 44px; border-radius: var(--radius-sm);">`;
  }
  html += `<div><div style="font-size: 17px; font-weight: 700;">${escapeHtml(title)}</div>`;
  html += `<div style="font-size: 11px; color: var(--mute);">${escapeHtml(id)}</div></div></div>`;
  html += `<div class="grid-2" style="margin: 0;"><div class="grid-item"><div class="grid-label">价格</div>`;
  html += `<div class="grid-value">${price}</div></div></div>`;
  
  document.getElementById('detailContent').innerHTML = html;
  document.getElementById('detailOverlay').classList.add('visible');
}

function closeDetailModal() {
  document.getElementById('detailOverlay').classList.remove('visible');
  detailData = null;
}

// Add from detail
async function addFromDetail() {
  if (!detailData) return;

  const threshold = parseFloat(document.getElementById('detailThreshold').value);
  const country = document.getElementById('detailCountry').value.trim() || 'us';
  const note = document.getElementById('detailNote').value.trim();
  const monitorMode = document.getElementById('detailMonitorMode').checked;

  if (isNaN(threshold) || threshold <= 0) {
    showToast('无效阈值');
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
    showToast('已添加');
    closeDetailModal();
    setTimeout(() => location.reload(), 500);
  } catch (e) {
    showToast(e.message);
  }
}

// Add app
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
    showToast('已添加');
    setTimeout(() => location.reload(), 500);
  } catch (e) {
    showToast(e.message);
  }
}

// Edit modal
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

// Edit app
async function handleEditApp(e) {
  e.preventDefault();
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

// Delete app
async function deleteApp(id) {
  if (!confirm('确认删除？')) return;
  
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

// Enter key for search
document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    doSearch();
  }
});

// Load on ready
document.addEventListener('DOMContentLoaded', loadDashboard);
