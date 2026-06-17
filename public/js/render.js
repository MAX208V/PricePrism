/**
 * Rendering functions for dynamic UI updates
 */

import { fmtUTC } from '../../src/utils/helpers.js';

// We'll need to reimplement fmtUTC for client-side since we can't import from server modules
function fmtUTCClient(isoString) {
  if (!isoString) return "-";
  
  const date = new Date(isoString);
  const pad = (num) => (num < 10 ? "0" + num : "" + num);
  
  return (
    pad(date.getUTCMonth() + 1) +
    "/" +
    pad(date.getUTCDate()) +
    " " +
    pad(date.getUTCHours()) +
    ":" +
    pad(date.getUTCMinutes()) +
    " UTC"
  );
}

let detailData = null;

/**
 * Render app cards
 * @param {Array} apps - Array of apps with status
 * @returns {void}
 */
export function renderAppCards(apps) {
  const container = document.getElementById('appList');
  
  if (apps.length === 0) {
    container.innerHTML = '<div class="cd" style="text-align:center;padding:32px;color:var(--m);font-weight:500;font-size:14px">暂无监控应用</div>';
    return;
  }
  
  let cardsHTML = '';
  
  for (const app of apps) {
    const status = app.status || {};
    const price = status.last_checked_price;
    const priceStr = price !== undefined ? `$${price}` : '-';
    const checkedAt = fmtUTCClient(status.last_checked_at);
    const notifiedAt = fmtUTCClient(status.last_notified_at);
    const isLow = price !== undefined && price > 0 && price < app.threshold;
    const icon = status.icon || '';
    const score = status.scoreText || '';
    const ratings = status.ratings || '';
    const note = app.note || '';
    const dev = status.developer || '';
    
    let cardHTML = `
      <div class="ac">
        <div class="ach">
          ${icon ? `<img src="${icon}" alt="" class="aci-icon" onerror="this.style.display='none'">` : ''}
          <div class="acn">
            <div class="act">${escapeHtml(app.name)}</div>
            ${note ? `<div class="acnote">${escapeHtml(note)}</div>` : ''}
            <div class="aci">${dev ? `${escapeHtml(dev)} · ` : ''}${escapeHtml(app.app_id)}</div>
          </div>
          <span class="bg ${isLow ? '' : 'gy'}">${isLow ? '低于阈值' : '正常'}</span>
        </div>
        <div class="acb">
          <div class="g">
            <div class="gi">
              <div class="gl">当前价格</div>
              <div class="v ${isLow ? 'gr' : ''}">${priceStr}</div>
            </div>
            <div class="gi">
              <div class="gl">阈值</div>
              <div class="v">$${app.threshold}</div>
            </div>
            <div class="gi" style="grid-column:1/3">
              <div class="gl">评分 / 心愿单</div>
              <div class="v">
                ${score ? `<span class="star">\u2605</span> ${escapeHtml(score)} ` : ''}
                ${ratings ? `<span style="color:var(--m)">|</span> ${escapeHtml(ratings)}` : ''}
              </div>
            </div>
            <div class="gi">
              <div class="gl">检查</div>
              <div class="v">${checkedAt}</div>
            </div>
            <div class="gi">
              <div class="gl">通知</div>
              <div class="v">${notifiedAt}</div>
            </div>
          </div>
          <div class="ar">
            <button class="bs" onclick="editApp('${escapeJs(app.app_id)}','${escapeJs(app.name)}','${escapeJs(app.country || 'us')}',${app.threshold},'${escapeJs(note)}','${app.monitor_mode}')">
              <span class="mat">edit</span>
            </button>
            <button class="bs br" onclick="removeApp('${escapeJs(app.app_id)}')">
              <span class="mat">delete</span>
            </button>
          </div>
        </div>
      </div>
    `;
    
    cardsHTML += cardHTML;
  }
  
  container.innerHTML = cardsHTML;
}

/**
 * Render history entries
 * @param {Array} history - History entries
 * @returns {void}
 */
export function renderHistory(history) {
  const container = document.getElementById('historyList');
  
  if (history.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--m);font-weight:500;font-size:14px">暂无记录</div>';
    return;
  }
  
  let historyHTML = '';
  
  for (const entry of history) {
    historyHTML += `
      <div class="hr">
        <span class="ht">${fmtUTCClient(entry.time)}</span>
        <span class="hn">${escapeHtml(entry.name)}</span>
        <span class="hp">$${entry.price}</span>
        <span class="bg hb ${entry.notified ? '' : 'gy'}">${entry.notified ? '已通知' : '跳过'}</span>
      </div>
    `;
  }
  
  container.innerHTML = historyHTML;
}

/**
 * Show detail modal
 * @param {string} id - App ID
 * @param {string} title - App title
 * @param {string} icon - App icon URL
 * @param {string} price - App price
 * @param {string} dev - Developer name
 * @param {string} score - Score text
 * @returns {void}
 */
export function showDetail(id, title, icon, price, dev, score) {
  detailData = { id, title };
  
  let contentHTML = `
    <div style='display:flex;align-items:center;gap:var(--sm);margin-bottom:var(--ss)'>
      ${icon ? `<img src='${icon}' alt='' style='width:44px;height:44px;border-radius:10px;flex-shrink:0' onerror='this.style.display="none"'>` : ''}
      <div>
        <div style='font-size:17px;font-weight:700'>${escapeHtml(title)}</div>
        <div style='font-size:11px;color:var(--m);margin-top:1px'>${escapeHtml(id)}</div>
      </div>
    </div>
    <div class='g' style='margin-bottom:0'>
      <div class='gi' style='padding:10px'>
        <div class='gl'>评分</div>
        <div class='v'>
          <span class='star'>\u2605</span> ${score || '-'}
        </div>
      </div>
      <div class='gi' style='padding:10px'>
        <div class='gl'>价格</div>
        <div class='v'>${price || '-'}</div>
      </div>
    </div>
    ${dev ? `<div class='gi' style='padding:10px;margin-top:var(--ss)'><div class='gl'>开发者</div><div class='v'>${escapeHtml(dev)}</div></div>` : ''}
  `;
  
  document.getElementById('detailContent').innerHTML = contentHTML;
  document.getElementById('dv').classList.add('s');
}

/**
 * Close detail modal
 * @returns {void}
 */
export function closeDetail() {
  detailData = null;
  document.getElementById('dv').classList.remove('s');
}

/**
 * Show edit modal
 * @param {string} id - App ID
 * @param {string} name - App name
 * @param {string} country - Country code
 * @param {number} threshold - Price threshold
 * @param {string} note - Note text
 * @param {string} monitorMode - Monitor mode
 * @returns {void}
 */
export function showEdit(id, name, country, threshold, note, monitorMode) {
  document.getElementById('eName').value = name;
  document.getElementById('eThreshold').value = threshold;
  document.getElementById('eCountry').value = country;
  document.getElementById('eNote').value = note || '';
  document.getElementById('eMonitorMode').checked = monitorMode === 'change';
  
  window.edId = id; // Store in global scope for saveEdit function
  document.getElementById('ov').classList.add('s');
}

/**
 * Close edit modal
 * @returns {void}
 */
export function closeEdit() {
  window.edId = null;
  document.getElementById('ov').classList.remove('s');
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

// Make functions available globally for onclick handlers
window.showDetail = showDetail;
window.closeDetail = closeDetail;
window.showEdit = showEdit;
window.closeEdit = closeEdit;