// ==================== 配置区 ====================
const DEFAULT_COUNTRY = "us";
const DEFAULT_LANG = "en";
const DEFAULT_THRESHOLD = 6;
const DEFAULT_CURRENCY = "USD";
const HISTORY_MAX = 50;

const COUNTRY_NAMES = {
  us: "🇺🇸 美国", jp: "🇯🇵 日本", kr: "🇰🇷 韩国", hk: "🇭🇰 香港",
  tw: "🇹🇼 台湾", cn: "🇨🇳 中国", gb: "🇬🇧 英国", de: "🇩🇪 德国",
  fr: "🇫🇷 法国", it: "🇮🇹 意大利", es: "🇪🇸 西班牙", ca: "🇨🇦 加拿大",
  au: "🇦🇺 澳大利亚", br: "🇧🇷 巴西", ru: "🇷🇺 俄罗斯", in: "🇮🇳 印度",
  sg: "🇸🇬 新加坡", my: "🇲🇾 马来西亚", th: "🇹🇭 泰国", id: "🇮🇩 印度尼西亚",
  ph: "🇵🇭 菲律宾", vn: "🇻🇳 越南", nl: "🇳🇱 荷兰", se: "🇸🇪 瑞典",
  no: "🇳🇴 挪威", dk: "🇩🇰 丹麦", ch: "🇨🇭 瑞士", mx: "🇲🇽 墨西哥",
  tr: "🇹🇷 土耳其", za: "🇿🇦 南非", ae: "🇦🇪 阿联酋", sa: "🇸🇦 沙特"
};

// ==================== 主入口 ====================
export default {
  async scheduled(event, env, ctx) {
    await monitorAndNotify(env);
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/dashboard") return handleDashboard(env);
    if (path === "/api/apps") return handleAppsApi(request, env);
    if (path === "/api/check") return handleCheck(env);
    if (path === "/api/history") return handleHistory(env);
    if (path === "/api/status") return handleStatus(env);
    if (path === "/api/search") return handleSearch(request, env);
    if (path === "/api/app-detail") return handleAppDetail(request, env);
    if (path === "/api/countries") return handleCountries();
    if (path === "/api/bg") return handleBg();
    if (path.startsWith("/api/")) return jsonResponse({ error: "Not found" }, 404);

    const response = await env.ASSETS.fetch(request);
    if (response.status === 404) {
      return env.ASSETS.fetch(new URL('/index.html', url.origin));
    }
    return response;
  },
};

// ==================== Countries API ====================
function handleCountries() {
  return jsonResponse(COUNTRY_NAMES);
}

// ==================== Bing Wallpaper API ====================
async function handleBg() {
  try {
    const resp = await fetch("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=en-US");
    if (!resp.ok) return jsonResponse({ url: null });
    const data = await resp.json();
    const img = data.images?.[0];
    if (!img) return jsonResponse({ url: null });
    return jsonResponse({
      url: "https://www.bing.com" + img.url,
      title: img.copyright || ""
    });
  } catch (e) {
    return jsonResponse({ url: null });
  }
}

// ==================== Dashboard API ====================
async function handleDashboard(env) {
  const apps = await getApps(env);
  const list = [];
  for (const app of apps) {
    const st = await env.KV.get("status:" + app.id, "json") || {};
    list.push({ ...app, status: st });
  }
  const history = await env.KV.get("history", "json") || [];
  return jsonResponse({
    apps: list,
    history,
    has_sc3: !!env.SC3_URL,
    has_api: !!env.PLAY_API
  });
}

// ==================== Apps API ====================
async function handleAppsApi(request, env) {
  if (request.method === "GET") {
    const apps = await getApps(env);
    const result = [];
    for (const app of apps) {
      const st = await env.KV.get("status:" + app.id, "json") || {};
      result.push({ ...app, status: st });
    }
    return jsonResponse(result);
  }
  
  if (request.method === "POST") {
    const body = await request.json();
    if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);
    
    const apps = await getApps(env);
    if (apps.find(a => a.id === body.app_id)) {
      return jsonResponse({ error: "App already exists" }, 409);
    }
    
    let name = body.name;
    let icon = null;
    
    // 如果没有提供 name，尝试从 API 获取
    if (!name || name.trim() === "") {
      const appInfo = await fetchAppInfo(env, body.app_id, body.country || DEFAULT_COUNTRY);
      if (appInfo) {
        name = appInfo.title || body.app_id;
        icon = appInfo.icon;
      }
    }
    
    // 构建应用配置
    const countries = body.countries || [body.country || DEFAULT_COUNTRY];
    const appConfig = {
      id: body.app_id,
      name: name || body.app_id,
      threshold: body.threshold ?? DEFAULT_THRESHOLD,
      country: countries[0] || DEFAULT_COUNTRY,
      countries,
      lang: body.lang || DEFAULT_LANG,
      currency: DEFAULT_CURRENCY,
      note: body.note || "",
      monitor_mode: body.monitor_mode || "threshold",
      monitor_iap: body.monitor_iap || false,
      iap_threshold: body.iap_threshold || null,
      created_at: new Date().toISOString()
    };
    
    apps.push(appConfig);
    await env.KV.put("config:apps", JSON.stringify(apps));
    
    // 初始化状态 KV
    const statusKey = "status:" + body.app_id;
    const status = await env.KV.get(statusKey, "json") || {};
    if (icon) status.icon = icon;
    if (name) status.title = name;
    status.last_checked_at = null;
    status.last_checked_price = null;
    status.prices_by_country = null;
    await env.KV.put(statusKey, JSON.stringify(status));
    
    return jsonResponse({ ok: true });
  }
  
  if (request.method === "DELETE") {
    const body = await request.json();
    if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);
    let apps = await getApps(env);
    apps = apps.filter(a => a.id !== body.app_id);
    await env.KV.put("config:apps", JSON.stringify(apps));
    await env.KV.delete("status:" + body.app_id);
    return jsonResponse({ ok: true });
  }
  
  if (request.method === "PATCH") {
    const body = await request.json();
    if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);
    let apps = await getApps(env);
    const idx = apps.findIndex(a => a.id === body.app_id);
    if (idx === -1) return jsonResponse({ error: "App not found" }, 404);
    
    for (const key in body) {
      if (key !== "app_id" && key !== "id") {
        apps[idx][key] = body[key];
      }
    }
    
    // 如果更新 countries，同步 country 为第一个
    if (body.countries && body.countries.length > 0) {
      apps[idx].country = body.countries[0];
    }
    
    await env.KV.put("config:apps", JSON.stringify(apps));
    return jsonResponse({ ok: true });
  }
  
  return jsonResponse({ error: "Method not allowed" }, 405);
}

// ==================== 解析内购价格区间 ====================
function parseIAPRange(rangeStr) {
  if (!rangeStr) return null;
  const clean = rangeStr.replace(/\s*per\s*item\s*$/i, '').trim();
  const parts = clean.split('-').map(s => s.trim());
  if (parts.length < 1) return null;
  const toNum = (s) => { const m = s.match(/[\d.]+/); return m ? parseFloat(m[0]) : null; };
  const min = toNum(parts[0]);
  const max = parts.length > 1 ? toNum(parts[parts.length - 1]) : min;
  if (min === null) return null;
  const currencyMatch = clean.match(/^([^\d.]+)/);
  const currencySymbol = currencyMatch ? currencyMatch[1].trim() : '$';
  return { min, max, text: clean, currencySymbol };
}

// ==================== Check API ====================
async function handleCheck(env) {
  const res = await monitorAndNotify(env);
  return jsonResponse(res);
}

// ==================== History API ====================
async function handleHistory(env) {
  return jsonResponse(await env.KV.get("history", "json") || []);
}

// ==================== Status API ====================
async function handleStatus(env) {
  const apps = await getApps(env);
  const result = [];
  for (const app of apps) {
    const st = await env.KV.get("status:" + app.id, "json") || {};
    result.push({ ...app, status: st });
  }
  return jsonResponse(result);
}

// ==================== Search API ====================
async function handleSearch(request, env) {
  const url = new URL(request.url);
  const term = url.searchParams.get("term");
  if (!term) return jsonResponse({ error: "term required" }, 400);
  const playApi = env.PLAY_API;
  if (!playApi) return jsonResponse({ error: "PLAY_API not configured" }, 400);
  try {
    const resp = await fetch(`${playApi}/api/apps/?q=${encodeURIComponent(term)}&country=us&lang=en`, {
      headers: { Accept: "application/json" }
    });
    if (!resp.ok) return jsonResponse({ error: `API error: ${resp.status}` }, 500);
    const data = await resp.json();
    const results = (data.results || []).map(app => ({
      appId: app.appId, title: app.title, icon: app.icon,
      developer: typeof app.developer === 'object' && app.developer !== null ? app.developer.devId || app.developer.name || String(app.developer) : (app.developer || ''),
      developerUrl: typeof app.developer === 'object' && app.developer !== null ? app.developer.url : '',
      score: app.score, scoreText: app.scoreText,
      price: app.price, free: app.free, currency: app.currency,
      containsAds: app.containsAds, offersIAP: app.offersIAP || app.inAppPurchases,
      IAPRange: (app.IAPRange || '').replace(/\s*per\s*item\s*$/i, '')
    }));
    return jsonResponse({ ok: true, results });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

// ==================== App Detail API ====================
async function handleAppDetail(request, env) {
  const url = new URL(request.url);
  const appId = url.searchParams.get("appId");
  if (!appId) return jsonResponse({ error: "appId required" }, 400);
  const playApi = env.PLAY_API;
  if (!playApi) return jsonResponse({ error: "PLAY_API not configured" }, 400);
  try {
    const resp = await fetch(`${playApi}/api/apps/${encodeURIComponent(appId)}?country=${url.searchParams.get('country') || 'us'}`, {
      headers: { Accept: "application/json" }
    });
    if (!resp.ok) return jsonResponse({ error: `API ${resp.status}` }, 500);
    const d = await resp.json();
    return jsonResponse({
      ok: true, title: d.title, icon: d.icon,
      developer: typeof d.developer === 'object' ? (d.developer.devId || d.developer.name || '') : (d.developer || ''),
      score: d.score, scoreText: d.scoreText,
      price: d.price, free: d.free, currency: d.currency,
      offersIAP: d.offersIAP || d.inAppPurchases || false,
      IAPRange: (d.IAPRange || '').replace(/\s*per\s*item\s*$/i, ''),
      containsAds: d.containsAds, installs: d.installs
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

// ==================== 获取应用详情 ====================
async function fetchAppInfo(env, appId, country = DEFAULT_COUNTRY) {
  const playApi = env.PLAY_API;
  if (!playApi) return null;
  try {
    const resp = await fetch(`${playApi}/api/apps/${encodeURIComponent(appId)}?country=${country}`, { headers: { Accept: "application/json" } });
    if (!resp.ok) return null;
    const data = await resp.json();
    return { title: data.title, icon: data.icon, developer: data.developer, score: data.score, scoreText: data.scoreText, price: data.price, free: data.free, currency: data.currency };
  } catch (e) { return null; }
}

// ==================== 获取应用价格（单国家） ====================
async function fetchAppPrice(playApi, appId, country, lang) {
  try {
    const resp = await fetch(`${playApi}/api/apps/${encodeURIComponent(appId)}?country=${country}&lang=${lang}`, { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const data = await resp.json();
    return {
      ok: true, price: data.price || 0, currency: data.currency || "USD",
      free: data.free,
      offersIAP: data.offersIAP || data.inAppPurchases || false,
      IAPRange: (data.IAPRange || '').replace(/\s*per\s*item\s*$/i, ''),
      title: data.title, icon: data.icon, developer: data.developer,
      score: data.score, scoreText: data.scoreText,
      installs: data.installs, containsAds: data.containsAds,
      priceText: data.priceText
    };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ==================== Monitor & Notify ====================
async function monitorAndNotify(env) {
  const playApi = env.PLAY_API;
  const sc3Url = env.SC3_URL;
  if (!playApi) return { ok: false, error: "Missing PLAY_API" };
  if (!sc3Url) return { ok: false, error: "Missing SC3_URL" };
  const apps = await getApps(env);
  if (!apps.length) return { ok: true, message: "No apps configured" };
  const results = [];
  for (const app of apps) {
    try {
      results.push(await checkApp(app, playApi, env, sc3Url));
    } catch (e) {
      results.push({ app_id: app.id, name: app.name, ok: false, error: e.message });
    }
  }
  return { ok: true, results };
}

// ==================== Check App（含支持） ====================
async function checkApp(app, playApi, env, sc3Url) {
  const { id, name, country, lang, threshold, monitor_mode, note, monitor_iap, iap_threshold, countries } = app;
  
  // 获取所有需要检查的国家列表
  const checkCountries = [...new Set([country, ...(countries || [country])])].filter(Boolean);
  
  // 分别获取各国价格
  const priceResults = {};
  for (const cc of checkCountries) {
    const pi = await fetchAppPrice(playApi, id, cc, lang);
    priceResults[cc] = pi;
  }
  
  // 使用主国家的价格作为主价格
  const mainPriceInfo = priceResults[country] || Object.values(priceResults)[0];
  if (!mainPriceInfo || !mainPriceInfo.ok) {
    return { app_id: id, name, ok: false, error: mainPriceInfo?.error || "fetch_failed" };
  }
  
  const price = mainPriceInfo.price;
  const cur = mainPriceInfo.currency || "USD";
  const free = mainPriceInfo.free;
  const icon = mainPriceInfo.icon;
  const score = mainPriceInfo.score;
  const scoreText = mainPriceInfo.scoreText;
  const installs = mainPriceInfo.installs;
  const developer = mainPriceInfo.developer;
  
  const statusKey = "status:" + id;
  const status = await env.KV.get(statusKey, "json") || {};
  
  status.last_checked_price = price;
  status.last_checked_at = new Date().toISOString();
  status.last_checked_free = free;
  status.offersIAP = mainPriceInfo.offersIAP;
  status.IAPRange = mainPriceInfo.IAPRange;
  status.containsAds = mainPriceInfo.containsAds;
  status.icon = icon || status.icon;
  status.score = score || status.score;
  status.scoreText = scoreText || status.scoreText;
  status.installs = installs || status.installs;
  status.developer = developer || status.developer;
  
  // 存储多区域价格
  const pricesByCountry = {};
  for (const [cc, pi] of Object.entries(priceResults)) {
    if (pi.ok) {
      pricesByCountry[cc] = {
        price: pi.price,
        currency: pi.currency,
        free: pi.free,
        priceText: pi.priceText || `$${pi.price}`,
        checked_at: new Date().toISOString()
      };
    }
  }
  status.prices_by_country = pricesByCountry;
  
  let notified = false;
  let reason = null;
  let iapNotified = false;
  let iapReason = null;
  
  // 主价格监控（使用主国家价格）
  if (monitor_mode !== "change" && !free && price > 0) {
    const below = price < threshold;
    if (below) {
      const last = status.last_notified_price;
      if (last === undefined || last === null) { notified = true; reason = "first_drop"; }
      else if (price < last) { notified = true; reason = "price_dropped"; }
    }
  } else if (monitor_mode === "change") {
    const lastPrice = status.last_checked_price;
    const lastFree = status.last_checked_free;
    if (lastPrice !== undefined && (price !== lastPrice || free !== lastFree)) {
      notified = true; reason = "price_changed";
      if (status.initial_price === undefined && !free) status.initial_price = price;
    }
  }
  
  // IAP 内购价格监控
  const iapInfo = parseIAPRange(mainPriceInfo.IAPRange);
  if (iapInfo && (monitor_iap || iap_threshold)) {
    const iapThresh = iap_threshold || 0;
    status.iapRangeData = iapInfo;
    status.last_iap_min_price = iapInfo.min;
    if (iapThresh > 0 && iapInfo.min < iapThresh) {
      const lastIapMin = status.last_iap_notified_price;
      if (lastIapMin === undefined || lastIapMin === null) { iapNotified = true; }
      else if (iapInfo.min < lastIapMin) { iapNotified = true; }
    }
  }
  
  // 通知
  if (notified) {
    const title = name + (monitor_mode !== "change" ? " 降价啦！" : " 价格变动");
    let desp = free ? "**状态: 免费**\n\n" : `**价格: ${cur === 'USD' ? '$' : ''}${price} ${cur}**\n\n`;
    if (monitor_mode !== "change" && !free) desp += `已低于阈值 $${threshold}\n\n`;
    desp += `- 应用ID: \`${id}\`\n`;
    if (note) desp += `- 备注: ${note}\n`;
    desp += `[打开 Google Play](https://play.google.com/store/apps/details?id=${id})`;
    await sendSc3(sc3Url, title, desp);
    status.last_notified_price = price;
    status.last_notified_at = new Date().toISOString();
    await appendHistory(env, { app_id: id, name, price, threshold, time: new Date().toISOString(), notified: true, type: 'price' });
  }
  
  if (iapNotified) {
    const title = `${name} 内购降价啦！`;
    let desp = `**最低内购价: ${iapInfo.currencySymbol}${iapInfo.min}**\n\n`;
    desp += `内购价格区间: ${iapInfo.text}\n\n`;
    if (iap_threshold) desp += `已低于内购阈值 $${iap_threshold}\n\n`;
    desp += `- 应用ID: \`${id}\`\n`;
    if (note) desp += `- 备注: ${note}\n`;
    desp += `[打开 Google Play](https://play.google.com/store/apps/details?id=${id})`;
    await sendSc3(sc3Url, title, desp);
    status.last_iap_notified_price = iapInfo.min;
    status.last_iap_notified_at = new Date().toISOString();
    await appendHistory(env, { app_id: id, name: name + ' (内购)', price: iapInfo.min, threshold: iap_threshold, time: new Date().toISOString(), notified: true, type: 'iap' });
  }
  
  status.last_checked = new Date().toISOString();
  await env.KV.put(statusKey, JSON.stringify(status));
  
  return {
    app_id: id, name, ok: true, price, currency: cur, free, threshold,
    notified: notified || iapNotified,
    reason: iapNotified ? (iapReason || 'iap') : reason,
    iap: iapInfo, iapNotified, prices_by_country: pricesByCountry,
    icon, score, scoreText, installs
  };
}

async function sendSc3(url, title, desp) {
  const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, desp }) });
  return { status: resp.status, body: await resp.text() };
}

async function getApps(env) {
  return await env.KV.get("config:apps", "json") || [];
}

async function appendHistory(env, entry) {
  let h = await env.KV.get("history", "json") || [];
  h.unshift(entry);
  if (h.length > HISTORY_MAX) h = h.slice(0, HISTORY_MAX);
  await env.KV.put("history", JSON.stringify(h));
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
