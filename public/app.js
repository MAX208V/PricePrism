let editingAppId = null;
let detailData = null;
let countryNames = {};
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
  if (!r) return { text: '-', isFree: false };
  if (r.price === null || r.price === undefined) return { text: '待检查', isFree: false, containsAds: false };
  const isFree = r.free === true || r.free === 1;
  const price = parseFloat(r.price);
  const ads = r.containsAds === true || r.containsAds === 1;
  let text = '';
  if (isFree) text = '免费';
  else if (isNaN(price)) text = '待检查';
  else text = '$' + price.toFixed(2);
  if (ads) text += '·含广告';
  return { text, isFree, containsAds: ads };
}
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// ---- 区域名称缓存 ----
async function loadCountries() {
  try {
    countryNames = await api('/api/countries');
  } catch (e) { countryNames = {}; }
}
function getCountryName(code) {
  return countryNames[code] || code.toUpperCase();
}
// ---- 主数据加载 ----
async function loadDashboard() {
  try {
    const data = await api('/api/dashboard');
    window._apps = data.apps;
    renderApps(data.apps);
    renderHistory(data.history);
  } catch (e) { showToast('加载失败: ' + e.message); }
}
// ---- 渲染监控卡 ----
function renderApps(apps) {
  const container = document.getElementById('appsList');
  const countEl = document.getElementById('appsCount');
  countEl.textContent = apps ? apps.length : 0;
  if (!apps || apps.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无监控应用</div>';
    return;
  }
  container.innerHTML = apps.map((app, i) => {
    const sep = i > 0 ? '<div class="app-card-sep"></div>' : '';
    const st = app;
    const price = app.last_price;
    const isFree = app.last_free;
    const priceInfo = getPriceDisplay({ free: isFree, price, containsAds: app.last_contains_ads });
    const threshold = app.threshold;
    const thresholdType = app.threshold_type || 'amount';
    const thresholdPct = app.threshold_pct || 20;
    const isBelow = !isFree && price !== undefined && price > 0 && price < threshold;
    const isChangeMode = app.monitor_mode === 'change';
    const icon = app.icon_data || app.last_icon || '';
    const score = app.last_score_text || '';
    const note = app.note || '';
    
    const appCountries = (() => {
    try { return typeof app.countries === 'string' ? JSON.parse(app.countries) : (app.countries || [app.country || 'us']); }
    catch(e) { return [app.country || 'us']; }
  })();
    const pricesByCountry = (() => {
  try { return typeof app.last_prices_by_country === 'string' ? JSON.parse(app.last_prices_by_country) : (app.last_prices_by_country || {}); }
  catch(e) { return {}; }
})();
    return sep + '<div class="app-card">' +
      '<div class="app-card-main">' +
        (icon ? '<img src="' + escapeHtml(icon) + '" class="app-card-icon" onerror="this.style.display=\'none\'">' : '<div class="app-card-icon"></div>') +
        '<div class="app-card-body">' +
          '<div class="app-card-name">' + escapeHtml(app.name) + '</div>' +
          '<div class="app-card-id">' + escapeHtml(app.id) + '</div>' +
          '<div class="app-card-meta">' +
            (score ? '<span>★ ' + escapeHtml(score) + '</span>' : '') +
            (isBelow ? '<span class="badge badge--success">低于阈值</span>' : '') +
            (isChangeMode ? '<span class="badge badge--warning">变动监控</span>' : '') +
            (app.base_price !== null && price !== undefined && price !== null && !isFree ? '<span class="badge ' + (price < app.base_price ? 'badge--success' : 'badge--info') + '">' +
              (price < app.base_price ? '▼' : price > app.base_price ? '▲' : '') + '$' + Math.abs(price - app.base_price).toFixed(2) + '</span>' : '') +
            
            (appCountries.length > 1 ? '<span class="badge badge--primary">' + appCountries.length + '区域</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="app-card-right">' +
          '<div class="app-card-price' + (isBelow ? ' success' : '') + '" onclick="toggleTrend(\'' + escapeHtml(app.id) + '\',this)" style="cursor:pointer;">' +
            '<div class="app-card-price-value">' + priceInfo.text + '</div>' +
          '</div>' +
          '<div class="app-card-threshold">' + (isChangeMode ? '变动通知' : thresholdType === 'percent' ? '阈值 ' + thresholdPct + '%' : '阈值 $' + threshold) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="app-card-trend" id="trend-' + escapeHtml(app.id) + '" style="display:none;">' +
        '<div class="trend-tabs">' +
          '<span class="trend-tab active" onclick="loadTrend(\'' + escapeHtml(app.id) + '\',\'week\',this)">周</span>' +
          '<span class="trend-tab" onclick="loadTrend(\'' + escapeHtml(app.id) + '\',\'month\',this)">月</span>' +
          '<span class="trend-tab" onclick="loadTrend(\'' + escapeHtml(app.id) + '\',\'year\',this)">年</span>' +
          '<span class="trend-loading" id="trend-load-' + escapeHtml(app.id) + '" style="display:none;margin-left:auto;font-size:10px;color:var(--mute);">加载中...</span>' +
        '</div>' +
        '<div class="trend-chart" id="trend-chart-' + escapeHtml(app.id) + '"></div>' +
      '</div>' +
      // 区域价格对比（可展开）
      (appCountries.length > 1 || Object.keys(pricesByCountry).length > 0 ? '<div class="app-card-regions" onclick="toggleRegions(this)">' +
        '<div class="region-toggle">' +
          '<span class="material-symbols-rounded">language</span>' +
          '<span>价格对比 (' + (appCountries.length > 1 ? appCountries.length : Object.keys(pricesByCountry).length) + '区域)</span>' +
          '<span class="material-symbols-rounded region-arrow">expand_more</span>' +
        '</div>' +
        '<div class="region-detail">' +
          Object.entries(pricesByCountry).length > 0
            ? '<table class="region-table"><tbody>' +
              appCountries.map(cc => {
                const pc = pricesByCountry[cc];
                if (!pc) return '';
                const flagEmoji = getCountryName(cc).split(' ')[0] || '';
                return '<tr>' +
                  '<td class="region-flag">' + flagEmoji + '</td>' +
                  '<td class="region-name">' + getCountryName(cc).replace(/^[^\s]+\s/, '') + '</td>' +
                  '<td class="region-price' + (pc.free ? ' region-free' : '') + '">' + (pc.free ? '免费' : (pc.priceText || '$' + pc.price)) + '</td>' +
                '</tr>';
              }).join('') +
              '</tbody></table>'
            : appCountries.map(cc => {
              return '<div class="region-pending"><span>' + getCountryName(cc) + '</span><span class="mute">等待检查</span></div>';
            }).join('') +
        '</div>' +
      '</div>' : '') +
      // 最近动态
      '<div class=\"app-card-event\" onclick=\"toggleEvents(this,\\'' + escapeHtml(app.id) + '\\')\">' +
        '<div class=\"event-toggle\">' +
          '<span class=\"event-badge\" id=\"event-badge-' + escapeHtml(app.id) + '\">...</span>' +
          '<span class=\"material-symbols-rounded event-arrow\">expand_more</span>' +
        '</div>' +
        '<div class=\"event-detail\" id=\"event-detail-' + escapeHtml(app.id) + '\">' +
          '<div class=\"event-list\" id=\"event-list-' + escapeHtml(app.id) + '\">' +
            '<div class=\"loading\" style=\"padding:8px;\">加载中...</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      (note ? '<div class="app-card-note"><span class="material-symbols-rounded" style="font-size:14px;vertical-align:middle;margin-right:4px;">sticky_note_2</span>' + escapeHtml(note) + '</div>' : '') +
      '<div class="app-card-actions">' +
        '<button class="btn btn-icon" onclick="openEditModal(\'' + escapeHtml(app.id) + '\')"><span class="material-symbols-rounded">edit</span></button>' +
        '<button class="btn btn-icon" onclick="deleteApp(\'' + escapeHtml(app.id) + '\')" style="color:var(--negative)"><span class="material-symbols-rounded">delete</span></button>' +
      '</div>' +
    '</div>';
  }).join('');
  // 自动加载每个应用的最近动态摘要
  apps.forEach(app => loadEvents(app.id));
}
// ---- 区域展开 ----
function toggleRegions(el) {
  const detail = el.querySelector('.region-detail');
  const arrow = el.querySelector('.region-arrow');
  if (!detail) return;
  const isOpen = detail.style.display === 'block';
  detail.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? 'expand_more' : 'expand_less';
}
// ---- 最近动态 ----
async function toggleEvents(headerEl, appId) {
  const detail = document.getElementById('event-detail-' + appId);
  const arrow = headerEl.querySelector('.event-arrow');
  if (!detail) return;
  const isOpen = detail.style.display === 'block';
  if (!isOpen) {
    detail.style.display = 'block';
    if (arrow) arrow.textContent = 'expand_less';
    await loadEvents(appId);
  } else {
    detail.style.display = 'none';
    if (arrow) arrow.textContent = 'expand_more';
  }
}

// 自动加载每个应用的最近动态摘要（展开时再拉取完整数据，只设角标初始状态）
// 注意：不会捏造数据，仅在用户点击展开时请求真实变动的API
async function loadEvents(appId) {
  const list = document.getElementById('event-list-' + appId);
  const badge = document.getElementById('event-badge-' + appId);
  if (!list) return;
  try {
    const data = await api('/api/app-events?appId=' + encodeURIComponent(appId));
    if (!data.events || data.events.length === 0) {
      list.innerHTML = '<div class="mute" style="padding:8px;font-size:11px;">暂未检测到价格变动</div>';
      if (badge) { badge.style.display = 'none'; }
      return;
    }
    // 只显示真实变动事件
    if (badge) {
      badge.style.display = 'inline-flex';
      badge.textContent = data.events.length + '次变动';
    }
    list.innerHTML = data.events.map((ev, idx) => {
      const dt = new Date(ev.time);
      const timeStr = dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      let icon = 'trending_flat';
      if (ev.type === '降价') icon = 'trending_down';
      else if (ev.type === '涨价') icon = 'trending_up';
      else if (ev.type === '变为免费') icon = 'money_off';
      return '<div class="event-item">' +
        '<span class="material-symbols-rounded event-item-icon" style="color:' + (ev.type === '降价' ? 'var(--positive)' : ev.type === '涨价' ? 'var(--negative)' : 'var(--mute)') + '">' + icon + '</span>' +
        '<div class="event-item-body">' +
          '<div class="event-item-type">' +
            (ev.type === '降价' ? '📉 降价' : ev.type === '涨价' ? '📈 涨价' : ev.type === '变为免费' ? '🎉 变为免费' : ev.type) +
          '</div>' +
          '<div class="event-item-price">' +
            '<span class="old-price">' + ev.old_price + '</span>' +
            ' <span style="color:var(--mute)">→</span> ' +
            '<span class="new-price">' + ev.new_price + '</span>' +
          '</div>' +
          '<div class="event-item-time">' + timeStr + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch (e) {
    list.innerHTML = '<div class="mute" style="padding:8px;font-size:11px;">加载失败</div>';
    badge.style.display = 'none';
  }
}
// ---- History ----
function renderHistory(history) {
  const container = document.getElementById('historyList');
  const countEl = document.getElementById('historyCount');
  if (countEl) {
    const len = history ? history.length : 0;
    countEl.textContent = len > 0 ? len : '';
  }
  // 从 localStorage 读取折叠状态（默认展开）
  const shown = localStorage.getItem('notif_visible') !== 'false';
  if (container) container.style.display = shown ? '' : 'none';
  if (!history || history.length === 0) {
    if (container) container.innerHTML = '<div class="empty-state">暂无记录</div>';
    return;
  }
  container.innerHTML = history.map(h => {
    return '<div class="history-item">' +
      '<span class="history-time">' + formatTime(h.time) + '</span>' +
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
    }).catch(() => {});
}
function closeDetailModal() {
  document.getElementById('detailOverlay').classList.remove('visible');
  detailData = null;
}
async function addFromDetail() {
  if (!detailData) return;
  const threshold = parseFloat(document.getElementById('detailThreshold').value);
  const note = document.getElementById('detailNote').value.trim();
  const monitorMode = document.getElementById('detailMonitorMode').checked;
  if (isNaN(threshold) || threshold <= 0) { showToast('请输入有效阈值'); return; }
  try {
    await api('/api/apps', {
      method: 'POST',
      body: JSON.stringify({
        app_id: detailData.id, name: detailData.title, threshold, country: 'us', note,
        monitor_mode: monitorMode ? 'change' : 'threshold',
        countries: ['us']
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
  const selectedCountries = getSelectedCountries('addCountries');
  try {
    await api('/api/apps', {
      method: 'POST',
      body: JSON.stringify({
        app_id: form.get('app_id'), name: form.get('name') || '',
        threshold: parseFloat(form.get('threshold')), country: selectedCountries[0] || 'us',
        countries: selectedCountries,
        note: form.get('note') || '', monitor_mode: form.get('monitor_mode') ? 'change' : 'threshold'
      })
    });
    showToast('已添加到监控列表');
    setTimeout(() => location.reload(), 500);
  } catch (e) { showToast(e.message); }
}
// ---- Edit Modal ----
function openEditModal(id) {
  const app = (window._apps || []).find(a => a.id === id);
  if (!app) return;
  editingAppId = id;
  document.getElementById('editName').value = app.name || '';
  document.getElementById('editThreshold').value = app.threshold || 6;
  document.getElementById('editNote').value = app.note || '';
  document.getElementById('editBasePrice').value = (app.base_price !== null && app.base_price !== undefined) ? app.base_price : '';
  document.getElementById('editMonitorMode').checked = app.monitor_mode === 'change';
  // 填充已选区域
  const existingCountries = [];
  try {
    const raw = typeof app.countries === 'string' ? JSON.parse(app.countries) : (app.countries || [app.country || 'us']);
    if (Array.isArray(raw)) existingCountries.push(...raw);
  } catch (e) {}
  if (existingCountries.length === 0) existingCountries.push(app.country || 'us');
  document.querySelectorAll('#editCountries .country-checkbox').forEach(cb => {
    cb.checked = existingCountries.includes(cb.value);
  });
  // IAP

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
  const note = document.getElementById('editNote').value.trim();
  const monitorMode = document.getElementById('editMonitorMode').checked;
  const selectedCountries = getSelectedCountries('editCountries');
  // IAP removed
  if (!name) { showToast('名称不能为空'); return; }
  try {
    await api('/api/apps', {
      method: 'PATCH',
      body: JSON.stringify({
        app_id: editingAppId, name, threshold, note,
        base_price: parseFloat(document.getElementById('editBasePrice').value) || null,
        threshold_type: document.getElementById('editThresholdType').value,
        threshold_pct: parseFloat(document.getElementById('editThresholdPct').value) || 20,
        monitor_mode: monitorMode ? 'change' : 'threshold',
        countries: selectedCountries,

      })
    });
    showToast('已更新');
    closeEditModal();
    setTimeout(() => location.reload(), 500);
  } catch (e) { showToast(e.message); }
}
// ---- 国家选择 ----
function getSelectedCountries(containerId) {
  const checkboxes = document.querySelectorAll('#' + containerId + ' .country-checkbox:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}
function toggleCountryPicker(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}
// ---- 立即检查 ----
async function checkPrices() {
  const btn = document.querySelector('.card-badge-refresh .material-symbols-rounded');
  if (btn) btn.style.animation = 'spin .6s linear infinite';
  try {
    const res = await fetch('/api/check');
    const data = await res.json();
    if (!data.ok) {
      showToast('检查失败: ' + (data.error || JSON.stringify(data.errors || data)));
      return;
    }
    showToast('检查完成 (' + (data.results?.filter(r=>r.ok).length || 0) + '/' + (data.results?.length || 0) + ')');
    await loadDashboard();
  } catch (e) {
    showToast('请求失败: ' + e.message);
  } finally {
    if (btn) btn.style.animation = '';
  }
}
// ---- 添加表单折叠 ----
function toggleNotifHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  const shown = list.style.display !== 'none';
  list.style.display = shown ? 'none' : '';
  localStorage.setItem('notif_visible', shown ? 'false' : 'true');
}
function toggleAddForm() {
  const form = document.getElementById('addForm');
  const arrow = document.querySelector('.add-arrow');
  if (!form) return;
  const isOpen = form.style.display !== 'none';
  form.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? 'expand_more' : 'expand_less';
}
// ---- 价格趋势 ----
function toggleTrend(appId, el) {
  const trendEl = document.getElementById('trend-' + appId);
  if (!trendEl) return;
  const isOpen = trendEl.style.display === 'block';
  trendEl.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    const tab = trendEl.querySelector('.trend-tab.active');
    if (tab) tab.click();
    else loadTrend(appId, 'week', trendEl.querySelector('.trend-tab'));
  }
}
async function loadTrend(appId, range, tabEl) {
  const container = document.getElementById('trend-' + appId);
  if (!container) return;
  container.querySelectorAll('.trend-tab').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');
  const loadEl = document.getElementById('trend-load-' + appId);
  const chartEl = document.getElementById('trend-chart-' + appId);
  if (!chartEl) return;
  if (loadEl) loadEl.style.display = '';
  try {
    const data = await api('/api/trend?appId=' + encodeURIComponent(appId) + '&range=' + range);
    if (loadEl) loadEl.style.display = 'none';
    if (data.data && data.data.length > 0) {
      chartEl.innerHTML = renderTrendSVG(data.data, range);
    } else {
      chartEl.innerHTML = '<div class="trend-empty">暂无数据</div>';
    }
  } catch (e) {
    if (loadEl) loadEl.style.display = 'none';
    chartEl.innerHTML = '<div class="trend-empty">加载失败</div>';
  }
}
function renderTrendSVG(data, range) {
  if (!data || data.length === 0) return '<div class="trend-empty">暂无数据</div>';
  const points = data.map(d => ({
    price: d.free ? 0 : (d.price || 0),
    free: d.free,
    text: d.priceText || (d.free ? '免费' : '$' + d.price),
    time: new Date(d.time)
  }));
  const width = 520, height = 160, pad = { top: 16, right: 12, bottom: 28, left: 44 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const paidPoints = points.filter(p => !p.free);
  if (paidPoints.length === 0) {
    const y = pad.top + chartH / 2;
    const labels = points.map((p, i) => {
      const x = pad.left + (i / (points.length - 1 || 1)) * chartW;
      return '<text x="' + x.toFixed(0) + '" y="' + (y + 16) + '" text-anchor="middle" font-size="8" fill="#999">' + formatTrendTime(p.time, range) + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + width + ' ' + height + '" style="width:100%;height:auto;">' +
      '<text x="' + (width / 2) + '" y="' + y + '" text-anchor="middle" font-size="12" fill="var(--positive-deep)" font-weight="600">始终免费</text>' +
      labels + '</svg>';
  }
  const prices = paidPoints.map(p => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range_p = maxPrice - minPrice || 1;
  const yTicks = 4;
  const yLabels = [];
  for (let i = 0; i <= yTicks; i++) {
    const v = minPrice + (range_p / yTicks) * i;
    yLabels.push({ y: pad.top + chartH - (i / yTicks) * chartH, label: '$' + v.toFixed(2) });
  }
  let svg = '';
  for (const yl of yLabels) {
    svg += '<line x1="' + pad.left + '" y1="' + yl.y + '" x2="' + (pad.left + chartW) + '" y2="' + yl.y + '" stroke="#e8ebe6" stroke-width="1"/>';
  }
  const maxLabels = range === 'year' ? 12 : (range === 'month' ? 6 : 4);
  const step = Math.max(1, Math.floor(points.length / maxLabels));
  for (let i = 0; i < points.length; i += step) {
    const x = pad.left + (i / (points.length - 1 || 1)) * chartW;
    svg += '<text x="' + x.toFixed(0) + '" y="' + (height - 4) + '" text-anchor="middle" font-size="8" fill="#999">' + formatTrendTime(points[i].time, range) + '</text>';
  }
  for (const yl of yLabels) {
    svg += '<text x="' + (pad.left - 4) + '" y="' + (yl.y + 3) + '" text-anchor="end" font-size="9" fill="#666">' + yl.label + '</text>';
  }
  const linePoints = paidPoints.map((p, i) => {
    const x = pad.left + (i / (paidPoints.length - 1 || 1)) * chartW;
    const y = pad.top + chartH - ((p.price - minPrice) / range_p) * chartH;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  svg += '<polyline points="' + linePoints + '" fill="none" stroke="#9fe870" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  const areaPoints = paidPoints.map((p, i) => {
    const x = pad.left + (i / (paidPoints.length - 1 || 1)) * chartW;
    const y = pad.top + chartH - ((p.price - minPrice) / range_p) * chartH;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  const firstX = pad.left;
  const lastX = pad.left + chartW;
  const bottomY = pad.top + chartH;
  svg += '<polygon points="' + firstX + ',' + bottomY + ' ' + areaPoints + ' ' + lastX + ',' + bottomY + '" fill="url(#g11539)" opacity="0.25"/>';
  svg = '<defs><linearGradient id="g11539" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9fe870"/><stop offset="100%" stop-color="#9fe870" stop-opacity="0.05"/></linearGradient></defs>' + svg;
  return '<svg viewBox="0 0 ' + width + ' ' + height + '" style="width:100%;height:auto;">' + svg + '</svg>';
}
function formatTrendTime(date, range) {
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  if (range === 'year') return m + '/' + d;
  const h = date.getUTCHours();
  return m + '/' + d + ' ' + h + '时';
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
document.getElementById('searchInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
});
document.addEventListener('click', function(e) {
  const searchCard = document.querySelector('.card--search');
  const results = document.getElementById('searchResults');
  if (results && results.classList.contains('visible') && searchCard && !searchCard.contains(e.target)) {
    results.innerHTML = '';
    results.classList.remove('visible');
  }
});
(async function init() {
  await loadCountries();
  // 加载背景
  try {
    const bg = await api('/api/bg');
    if (bg.url) {
      const el = document.getElementById('bgWallpaper');
      if (el) el.style.backgroundImage = 'url(' + bg.url + ')';
    }
  } catch (_) {}
  // 填充国家选择器
  const addDiv = document.getElementById('addCountries');
  const editDiv = document.getElementById('editCountries');
  if (addDiv || editDiv) {
    const html = Object.entries(countryNames).map(([code, name]) => {
      return '<label class="country-checkbox-label" title="' + escapeHtml(name) + '">' +
        '<input type="checkbox" class="country-checkbox" value="' + code + '"' + (code === 'us' ? ' checked' : '') + '>' +
        '<span>' + escapeHtml(name) + '</span>' +
      '</label>';
    }).join('');
    if (addDiv) addDiv.innerHTML = html;
    if (editDiv) editDiv.innerHTML = html;
  }
  loadDashboard();
})();
