let editingAppId = null;
let detailData = null;

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = n => n < 10 ? '0' + n : '' + n;
  return pad(d.getUTCMonth() + 1) + '/' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
}

function getPriceDisplay(r) {
  if (!r) return { text: '-', isFree: false, iapText: '' };
  const isFree = r.free === true || r.price === 0 || r.price === '0';
  const ads = r.containsAds === true;
  const iap = r.offersIAP === true;
  let text;
  if (isFree) {
    text = '免费';
    if (ads && iap) text += '·内购+广告';
    else if (ads) text += '·含广告';
    else if (iap) text += '·含内购';
  } else {
    text = '$' + parseFloat(r.price).toFixed(2);
  }

  let iapText = '';
  if (r.IAPRange) {
    iapText = r.IAPRange;
  } else if (iap) {
    iapText = '含内购';
  }
  return { text, isFree, offersIAP: iap, containsAds: ads, iapRange: r.IAPRange || '', iapText };
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadDashboard() {
  try {
    const data = await api('/api/dashboard');
    renderApps(data.apps);
    renderHistory(data.history);
  } catch (e) {
    showToast('加载失败: ' + e.message);
  }
}

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
    const priceInfo = getPriceDisplay({ free: isFree, price, offersIAP: st.offersIAP, containsAds: st.containsAds, IAPRange: st.IAPRange });
    const threshold = app.threshold;
    const isBelow = !isFree && !app.monitor_mode && price !== undefined && price > 0 && price < threshold;
    const isChangeMode = app.monitor_mode === 'change';
    const icon = st.icon || '';
    const score = st.scoreText || '';
    const note = app.note || '';
    const hasIAP = !!st.IAPRange;
    const monitorIAP = app.monitor_iap || false;
    const iapThreshold = app.iap_threshold || '';

    return '<div class="app-card">' +
      '<div class="app-card-main">' +
        (icon ? '<img src="' + escapeHtml(icon) + '" class="app-card-icon" onerror="this.style.display=\'none\'">' : '<div class="app-card-icon"></div>') +
        '<div class="app-card-body">' +
          '<div class="app-card-name">' + escapeHtml(app.name) + '</div>' +
          '<div class="app-card-id">' + escapeHtml(app.id) + '</div>' +
          '<div class="app-card-meta">' +
            (score ? '<span>★ ' + escapeHtml(score) + '</span>' : '') +
            (isBelow ? '<span class="badge badge--success">低于阈值</span>' : '') +
            (isChangeMode ? '<span class="badge badge--warning">变动监控</span>' : '') +
            (st.offersIAP ? '<span class="badge badge--success">含内购</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="app-card-right">' +
          '<div class="app-card-price' + (isBelow ? ' success' : '') + '"><div class="app-card-price-value">' + priceInfo.text + '</div></div>' +
          '<div class="app-card-threshold">' + (isChangeMode ? '变动通知' : '阈值 $' + threshold) + '</div>' +
        '</div>' +
      '</div>' +
      (hasIAP ? '<div class="app-card-iap" onclick="toggleIAP(this)">' +
        '<div class="iap-expand-toggle">' +
          '<span class="material-symbols-rounded">payments</span>' +
          '<span class="iap-range-text">' + escapeHtml(st.IAPRange) + '</span>' +
          '<span class="material-symbols-rounded iap-arrow">expand_more</span>' +
        '</div>' +
        '<div class="iap-detail">' +
          '<div class="iap-info">最低内购价: <strong>' + escapeHtml(st.IAPRange) + '</strong></div>' +
          '<div class="iap-monitor">' +
            '<label class="toggle">' +
              '<input type="checkbox" class="toggle-input" ' + (monitorIAP ? 'checked' : '') + ' onchange="setIAPMonitor(\'' + escapeHtml(app.id) + '\',this.checked,\'' + escapeHtml(app.name) + '\')">' +
              '<span class="toggle-slider"></span>' +
              '<span class="toggle-label">监控内购最低价</span>' +
            '</label>' +
            '<div class="iap-threshold-row" style="' + (monitorIAP ? '' : 'display:none') + '">' +
              '<input type="number" class="input" style="height:32px;font-size:12px;width:90px;" placeholder="阈值$" value="' + escapeHtml(iapThreshold) + '" onchange="setIAPThreshold(\'' + escapeHtml(app.id) + '\',this.value)">' +
              '<span style="font-size:11px;color:var(--mute);margin-left:4px;">低于此价时通知</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' : '') +
      (note ? '<div class="app-card-note"><span class="material-symbols-rounded" style="font-size:14px;vertical-align:middle;margin-right:4px;">sticky_note_2</span>' + escapeHtml(note) + '</div>' : '') +
      '<div class="app-card-actions">' +
        '<button class="btn btn-icon" onclick="openEditModal(\'' + escapeHtml(app.id) + '\',\'' + escapeHtml(app.name) + '\',\'' + escapeHtml(app.country || 'us') + '\',' + threshold + ',\'' + escapeHtml(note) + '\',' + isChangeMode + ',' + monitorIAP + ',\'' + escapeHtml(iapThreshold) + '\')"><span class="material-symbols-rounded">edit</span></button>' +
        '<button class="btn btn-icon" onclick="deleteApp(\'' + escapeHtml(app.id) + '\')" style="color:var(--negative)"><span class="material-symbols-rounded">delete</span></button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ---- IAP Functions ----
function toggleIAP(el) {
  const detail = el.querySelector('.iap-detail');
  const arrow = el.querySelector('.iap-arrow');
  if (!detail) return;
  const isOpen = detail.style.display === 'block';
  detail.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? 'expand_more' : 'expand_less';
}

async function setIAPMonitor(appId, checked, appName) {
  try {
    await api('/api/apps', {
      method: 'PATCH',
      body: JSON.stringify({ app_id: appId, monitor_iap: checked })
    });
    showToast(checked ? '已开启内购监控' : '已关闭内购监控');

    // Show/hide threshold row
    const cards = document.querySelectorAll('.app-card');
    for (const card of cards) {
      const toggle = card.querySelector('.iap-monitor .toggle-input');
      if (toggle && toggle.checked === checked && card.querySelector('.iap-threshold-row')) {
        const row = card.querySelector('.iap-threshold-row');
        if (row) row.style.display = checked ? 'flex' : 'none';
      }
    }
  } catch (e) {
    showToast(e.message);
  }
}

async function setIAPThreshold(appId, value) {
  const v = parseFloat(value);
  if (isNaN(v) || v <= 0) {
    showToast('请输入有效阈值');
    return;
  }
  try {
    await api('/api/apps', {
      method: 'PATCH',
      body: JSON.stringify({ app_id: appId, iap_threshold: v })
    });
    showToast('内购阈值已更新');
  } catch (e) {
    showToast(e.message);
  }
}

// ---- History ----
function renderHistory(history) {
  const container = document.getElementById('historyList');
  const countEl = document.getElementById('historyCount');
  countEl.textContent = history ? history.length : 0;
  if (!history || history.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无记录</div>';
    return;
  }
  container.innerHTML = history.map(h => {
    const isIAP = h.type === 'iap';
    return '<div class="history-item">' +
      '<span class="history-time">' + formatTime(h.time) + '</span>' +
      '<span class="history-name">' + escapeHtml(h.name) + (isIAP ? ' <span style="font-size:10px;color:var(--positive-deep);">内购</span>' : '') + '</span>' +
      '<span class="history-price">' + (h.price !== undefined ? '$' + h.price : '') + '</span>' +
      '<span class="history-badge history-badge--' + (h.notified ? 'notified' : 'skipped') + '">' + (h.notified ? '已通知' : '跳过') + '</span>' +
    '</div>';
  }).join('');
}

// ---- Search ----
async function doSearch() {
  const term = document.getElementById('searchInput').value.trim();
  if (!term) { showToast('请输入关键词'); return; }
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
          '<div class="search-item-meta">' + escapeHtml(r.appId) + ' · ' + escapeHtml(typeof r.developer === 'object' ? (r.developer.devId || r.developer.name || '') : (r.developer || '')) + '</div>' +
        '</div>' +
        '<div class="search-item-price">' + pi.text + '</div>' +
      '</div>';
    }).join('');
  } catch (e) {
    resultsEl.innerHTML = '<div class="empty-state">搜索失败</div>';
  }
}

// ---- Detail Modal ----
function showDetail(id, title, icon, priceText) {
  detailData = { id, title };
  const content = document.getElementById('detailContent');
  content.innerHTML = (icon ? '<img src="' + escapeHtml(icon) + '" onerror="this.style.display=\'none\'">' : '') +
    '<div style="flex:1;min-width:0;">' +
      '<div class="detail-preview-title">' + escapeHtml(title) + '</div>' +
      '<div class="detail-preview-id">' + escapeHtml(id) + '</div>' +
      '<div class="detail-preview-price">' + escapeHtml(priceText) + '</div>' +
    '</div>';
  document.getElementById('detailOverlay').classList.add('visible');

  fetch('/api/app-detail?appId=' + encodeURIComponent(id))
    .then(r => r.json()).then(d => {
      if (!d.ok) return;
      const iapEl = document.getElementById('detailIAP');
      if (d.IAPRange && iapEl) {
        iapEl.textContent = '内购: ' + d.IAPRange.replace(/\s*per\s*item\s*$/i, '');
        iapEl.style.display = 'block';
      }
    }).catch(() => {});
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
  if (isNaN(threshold) || threshold <= 0) { showToast('请输入有效阈值'); return; }
  try {
    await api('/api/apps', {
      method: 'POST',
      body: JSON.stringify({
        app_id: detailData.id, name: detailData.title, threshold, country, note,
        monitor_mode: monitorMode ? 'change' : 'threshold'
      })
    });
    showToast('已添加到监控列表');
    closeDetailModal();
    setTimeout(() => location.reload(), 500);
  } catch (e) { showToast(e.message); }
}

// ---- Add App ----
async function handleAddApp(e) {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    await api('/api/apps', {
      method: 'POST',
      body: JSON.stringify({
        app_id: form.get('app_id'), name: form.get('name') || '',
        threshold: parseFloat(form.get('threshold')), country: form.get('country') || 'us',
        note: form.get('note') || '', monitor_mode: form.get('monitor_mode') ? 'change' : 'threshold'
      })
    });
    showToast('已添加到监控列表');
    setTimeout(() => location.reload(), 500);
  } catch (e) { showToast(e.message); }
}

// ---- Edit Modal ----
function openEditModal(id, name, country, threshold, note, monitorMode, monitorIAP, iapThreshold) {
  editingAppId = id;
  document.getElementById('editName').value = name;
  document.getElementById('editThreshold').value = threshold;
  document.getElementById('editCountry').value = country;
  document.getElementById('editNote').value = note;
  document.getElementById('editMonitorMode').checked = monitorMode;

  const iapRow = document.getElementById('editIAPRow');
  if (iapRow) {
    const checkbox = iapRow.querySelector('.iap-checkbox');
    const thresholdInput = iapRow.querySelector('.iap-threshold-input');
    if (checkbox) checkbox.checked = monitorIAP || false;
    if (thresholdInput) thresholdInput.value = iapThreshold || '';
  }
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

  let monitorIAP = false;
  let iapThreshold = null;
  const iapRow = document.getElementById('editIAPRow');
  if (iapRow) {
    const checkbox = iapRow.querySelector('.iap-checkbox');
    const thresholdInput = iapRow.querySelector('.iap-threshold-input');
    if (checkbox) monitorIAP = checkbox.checked;
    if (thresholdInput) {
      const v = parseFloat(thresholdInput.value);
      if (!isNaN(v) && v > 0) iapThreshold = v;
    }
  }

  if (!name) { showToast('名称不能为空'); return; }
  try {
    await api('/api/apps', {
      method: 'PATCH',
      body: JSON.stringify({
        app_id: editingAppId, name, threshold, country, note,
        monitor_mode: monitorMode ? 'change' : 'threshold',
        monitor_iap: monitorIAP, iap_threshold: iapThreshold
      })
    });
    showToast('已更新');
    closeEditModal();
    setTimeout(() => location.reload(), 500);
  } catch (e) { showToast(e.message); }
}

// ---- Delete ----
async function deleteApp(id) {
  if (!confirm('确认删除此应用？')) return;
  try {
    await api('/api/apps', { method: 'DELETE', body: JSON.stringify({ app_id: id }) });
    showToast('已删除');
    setTimeout(() => location.reload(), 500);
  } catch (e) { showToast(e.message); }
}

// ---- Init ----
document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
});
document.addEventListener('DOMContentLoaded', loadDashboard);
