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
// ---- 渲染监控卡 ----
