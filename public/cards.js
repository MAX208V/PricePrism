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
