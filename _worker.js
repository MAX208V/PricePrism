// ==================== 配置区 ====================
const DEFAULT_COUNTRY = "us";
const DEFAULT_LANG = "en";
const DEFAULT_THRESHOLD = 6;
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
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/dashboard") return handleDashboard(env);
    if (path === "/api/apps") return handleAppsApi(request, env);
    if (path === "/api/check") return handleCheck(env);
    if (path === "/api/history") return handleHistory(env);
    if (path === "/api/search") return handleSearch(request, env);
    if (path === "/api/app-detail") return handleAppDetail(request, env);
    if (path === "/api/countries") return handleCountries();
    if (path === "/api/bg") return handleBg();
    if (path === "/api/trend") return handleTrend(request, env);
    if (path === "/api/migrate") return handleMigrate(env);
    if (path.startsWith("/api/")) return jsonResponse({ error: "Not found" }, 404);

    const response = await env.ASSETS.fetch(request);
    if (response.status === 404) {
      return env.ASSETS.fetch(new URL('/index.html', url.origin));
    }
    return response;
  },
};

// ==================== 工具函数 ====================
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

function parseCountries(app) {
  if (!app) return ["us"];
  try {
    if (typeof app.countries === 'string') return JSON.parse(app.countries);
    if (Array.isArray(app.countries)) return app.countries;
  } catch (e) {}
  return [app.country || "us"];
}

function parseIAPRange(rangeStr) {
  if (!rangeStr) return null;
  const clean = rangeStr.replace(/\s*per\s*item\s*$/i, '').trim();
  const parts = clean.split('-').map(s => s.trim());
  if (parts.length < 1) return null;
  const toNum = (s) => { const m = s.match(/[\d.]+/); return m ? parseFloat(m[0]) : null; };
  const min = toNum(parts[0]);
  const max = parts.length > 1 ? toNum(parts[parts.length - 1]) : min;
  if (min === null) return null;
  const m = clean.match(/^([^\d.]+)/);
  return { min, max, text: clean, currencySymbol: m ? m[1].trim() : '$' };
}

// ==================== Countries API ====================
function handleCountries() {
  return jsonResponse(COUNTRY_NAMES);
}

// ==================== Bing Wallpaper ====================
async function handleBg() {
  try {
    const resp = await fetch("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=en-US");
    if (!resp.ok) return jsonResponse({ url: null });
    const data = await resp.json();
    const img = data.images?.[0];
    return jsonResponse({ url: img ? "https://www.bing.com" + img.url : null, title: img?.copyright || "" });
  } catch (e) { return jsonResponse({ url: null }); }
}

// ==================== Dashboard ====================
async function handleDashboard(env) {
  const { DB, ICONS } = env;
  let apps = [];
  try {
    apps = await DB.prepare("SELECT * FROM apps ORDER BY created_at DESC").all();
    apps = apps.results || [];
  } catch (e) { apps = []; }

  // 给每个 app 加载 R2 缓存图标
  for (const app of apps) {
    app.countries = JSON.stringify(parseCountries(app));
    app.icon_data = await getCachedIcon(ICONS, app.id, app.last_icon);
  }

  let history = [];
  try {
    history = await DB.prepare("SELECT * FROM notifications ORDER BY time DESC LIMIT ?").bind(HISTORY_MAX).all();
    history = history.results || [];
  } catch (e) { history = []; }

  return jsonResponse({ apps, history, has_sc3: !!env.SC3_URL, has_api: !!env.PLAY_API });
}

// ==================== 图标缓存 (R2) ====================
async function cacheIcon(ICONS, appId, iconUrl) {
  if (!iconUrl || !appId || !ICONS) return;
  try {
    const existing = await ICONS.get("icons/" + appId);
    if (existing) return;
    const resp = await fetch(iconUrl, { cf: { cacheTtl: 86400 } });
    if (!resp.ok) return;
    const buf = await resp.arrayBuffer();
    const contentType = resp.headers.get("content-type") || "image/png";
    await ICONS.put("icons/" + appId, buf, {
      httpMetadata: { contentType },
      customMetadata: { source: iconUrl }
    });
  } catch (e) {}
}

// ==================== 获取 R2 缓存图标 ====================
async function getCachedIcon(ICONS, appId, fallbackUrl) {
  if (!ICONS) return fallbackUrl || "";
  try {
    const obj = await ICONS.get("icons/" + appId);
    if (obj) {
      const buf = await obj.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      return "data:" + (obj.httpMetadata?.contentType || "image/png") + ";base64," + b64;
    }
    // 尝试读 metadata source URL
    const head = await ICONS.head("icons/" + appId);
    if (head?.customMetadata?.source) return head.customMetadata.source;
  } catch (e) {}
  return fallbackUrl || "";
}

// ==================== Apps API (D1) ====================
async function handleAppsApi(request, env) {
  const { DB, ICONS } = env;

  if (request.method === "GET") {
    let apps = [];
    try { apps = await DB.prepare("SELECT * FROM apps ORDER BY created_at DESC").all(); apps = apps.results || []; } catch (e) { apps = []; }
    for (const app of apps) {
      app.countries = JSON.stringify(parseCountries(app));
      app.icon_data = await getCachedIcon(ICONS, app.id, app.last_icon);
    }
    return jsonResponse(apps);
  }

  if (request.method === "POST") {
    const body = await request.json();
    if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);

    const countries = body.countries || [body.country || DEFAULT_COUNTRY];
    const now = new Date().toISOString();

    // 预拉应用信息
    let name = body.name;
    let preIcon = '';
    try {
      const info = await fetchAppInfo(env, body.app_id, countries[0]);
      if (info) {
        if (!name || name.trim() === '') name = info.title || name;
        preIcon = info.icon || '';
        if (info.icon && ICONS) await cacheIcon(ICONS, body.app_id, info.icon);
      }
    } catch (e) {}

    await DB.prepare(
      `INSERT INTO apps (id,name,threshold,country,countries,lang,note,monitor_mode,monitor_iap,iap_threshold,created_at,updated_at,last_icon)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      body.app_id, name || body.app_id,
      body.threshold ?? DEFAULT_THRESHOLD,
      countries[0] || DEFAULT_COUNTRY,
      JSON.stringify(countries),
      body.lang || DEFAULT_LANG,
      body.note || "",
      body.monitor_mode || "threshold",
      body.monitor_iap ? 1 : 0,
      body.iap_threshold || null,
      now, now, preIcon
    ).run();

    return jsonResponse({ ok: true });
  }

  if (request.method === "DELETE") {
    const body = await request.json();
    if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);
    await DB.prepare("DELETE FROM apps WHERE id = ?").bind(body.app_id).run();
    return jsonResponse({ ok: true });
  }

  if (request.method === "PATCH") {
    const body = await request.json();
    if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);
    const fields = [];
    const values = [];
    for (const [k, v] of Object.entries(body)) {
      if (k === "app_id" || k === "id") continue;
      if (k === "monitor_iap") { fields.push("monitor_iap=?"); values.push(v ? 1 : 0); continue; }
      fields.push(k + "=?");
      values.push(v);
    }
    if (fields.length === 0) return jsonResponse({ error: "no fields" }, 400);
    if (body.countries && Array.isArray(body.countries)) {
      fields.push("country=?");
      values.push(body.countries[0]);
      fields.push("countries=?");
      values.push(JSON.stringify(body.countries));
    }
    fields.push("updated_at=?");
    values.push(new Date().toISOString());
    values.push(body.app_id);
    // 如果有新 name 同步到 last_name
    if (body.name) { fields.push("name=?"); values.push(body.name); }
    await DB.prepare("UPDATE apps SET " + fields.join(",") + " WHERE id=?").bind(...values).run();
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
}

// ==================== History ====================
async function handleHistory(env) {
  try {
    const h = await env.DB.prepare("SELECT * FROM notifications ORDER BY time DESC LIMIT ?").bind(HISTORY_MAX).all();
    return jsonResponse(h.results || []);
  } catch (e) { return jsonResponse([]); }
}

// ==================== Search ====================
async function handleSearch(request, env) {
  const url = new URL(request.url);
  const term = url.searchParams.get("term");
  if (!term) return jsonResponse({ error: "term required" }, 400);
  const playApi = env.PLAY_API;
  if (!playApi) return jsonResponse({ error: "PLAY_API not configured" }, 400);
  try {
    const resp = await fetch(`${playApi}/api/apps/?q=${encodeURIComponent(term)}&country=us&lang=en`, { headers: { Accept: "application/json" } });
    if (!resp.ok) return jsonResponse({ error: `API error: ${resp.status}` }, 500);
    const data = await resp.json();
    const results = (data.results || []).map(app => ({
      appId: app.appId, title: app.title, icon: app.icon,
      developer: typeof app.developer === 'object' ? (app.developer.devId || app.developer.name || '') : (app.developer || ''),
      score: app.score, scoreText: app.scoreText, price: app.price, free: app.free,
      currency: app.currency, containsAds: app.containsAds,
      offersIAP: app.offersIAP || app.inAppPurchases,
      IAPRange: (app.IAPRange || '').replace(/\s*per\s*item\s*$/i, '')
    }));
    return jsonResponse({ ok: true, results });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ==================== App Detail ====================
async function handleAppDetail(request, env) {
  const url = new URL(request.url);
  const appId = url.searchParams.get("appId");
  if (!appId) return jsonResponse({ error: "appId required" }, 400);
  const playApi = env.PLAY_API;
  if (!playApi) return jsonResponse({ error: "PLAY_API not configured" }, 400);
  try {
    const resp = await fetch(`${playApi}/api/apps/${encodeURIComponent(appId)}?country=${url.searchParams.get('country') || 'us'}`, { headers: { Accept: "application/json" } });
    if (!resp.ok) return jsonResponse({ error: `API ${resp.status}` }, 500);
    const d = await resp.json();
    return jsonResponse({
      ok: true, title: d.title, icon: d.icon,
      developer: typeof d.developer === 'object' ? (d.developer.devId || d.developer.name || '') : (d.developer || ''),
      score: d.score, scoreText: d.scoreText, price: d.price, free: d.free, currency: d.currency,
      offersIAP: d.offersIAP || d.inAppPurchases || false,
      IAPRange: (d.IAPRange || '').replace(/\s*per\s*item\s*$/i, ''),
      containsAds: d.containsAds, installs: d.installs
    });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
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

// ==================== 获取价格 ====================
async function fetchAppPrice(playApi, appId, country, lang) {
  try {
    const resp = await fetch(`${playApi}/api/apps/${encodeURIComponent(appId)}?country=${country}&lang=${lang}`, { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const data = await resp.json();
    return {
      ok: true, price: data.price || 0, currency: data.currency || "USD", free: data.free,
      offersIAP: data.offersIAP || data.inAppPurchases || false,
      IAPRange: (data.IAPRange || '').replace(/\s*per\s*item\s*$/i, ''),
      title: data.title, icon: data.icon, developer: data.developer,
      score: data.score, scoreText: data.scoreText, installs: data.installs,
      containsAds: data.containsAds, priceText: data.priceText
    };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ==================== Monitor & Notify ====================
async function monitorAndNotify(env) {
  const { PLAY_API, SC3_URL, DB, ICONS } = env;
  if (!PLAY_API) return { ok: false, error: "Missing PLAY_API" };
  if (!SC3_URL) return { ok: false, error: "Missing SC3_URL" };

  let apps;
  try { apps = await DB.prepare("SELECT * FROM apps").all(); apps = apps.results || []; }
  catch (e) { return { ok: false, error: e.message }; }
  if (!apps.length) return { ok: true, message: "No apps configured" };

  const results = [];
  for (const app of apps) {
    try { results.push(await checkApp(app, env)); }
    catch (e) { results.push({ app_id: app.id, name: app.name, ok: false, error: e.message }); }
  }
  return { ok: true, results };
}

// ==================== Check App ====================
async function checkApp(app, env) {
  const { PLAY_API, SC3_URL, DB, ICONS } = env;
  const { id, name, country, lang, threshold, monitor_mode, note, monitor_iap, iap_threshold, countries } = app;

  const checkCountries = [...new Set([country, ...(JSON.parse(countries || '["' + country + '"]'))])].filter(Boolean);
  const priceResults = {};
  for (const cc of checkCountries) {
    priceResults[cc] = await fetchAppPrice(PLAY_API, id, cc, lang);
  }

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

  // 写入价格走势到 D1
  const now = new Date().toISOString();
  for (const [cc, pi] of Object.entries(priceResults)) {
    if (pi.ok) {
      await DB.prepare(
        "INSERT INTO price_history (app_id, country, price, free, currency, price_text, recorded_at) VALUES (?,?,?,?,?,?,?)"
      ).bind(id, cc, pi.price, pi.free ? 1 : 0, pi.currency, pi.priceText || `$${pi.price}`, now).run();
    }
  }

  // 缓存图标到 R2
  if (icon && ICONS) await cacheIcon(ICONS, id, icon);

  // 多区域价格
  const pricesByCountry = {};
  for (const [cc, pi] of Object.entries(priceResults)) {
    if (pi.ok) {
      pricesByCountry[cc] = { price: pi.price, currency: pi.currency, free: pi.free, priceText: pi.priceText || `$${pi.price}`, checked_at: now };
    }
  }

  let notified = false, reason = null, iapNotified = false, iapReason = null;

  // 主价格监控
  if (monitor_mode !== "change" && !free && price > 0) {
    if (price < threshold) {
      const last = app.last_notified_price;
      if (last === undefined || last === null) { notified = true; reason = "first_drop"; }
      else if (price < last) { notified = true; reason = "price_dropped"; }
    }
  } else if (monitor_mode === "change") {
    const lp = app.last_price;
    const lf = app.last_free;
    if (lp !== null && (price !== lp || free !== lf)) { notified = true; reason = "price_changed"; }
  }

  // IAP 监控
  const iapInfo = parseIAPRange(mainPriceInfo.IAPRange);
  if (iapInfo && (monitor_iap || iap_threshold)) {
    const iapThresh = iap_threshold || 0;
    if (iapThresh > 0 && iapInfo.min < iapThresh) {
      const lastIapMin = app.last_iap_notified_price;
      if (lastIapMin === undefined || lastIapMin === null) { iapNotified = true; iapReason = "first_drop"; }
      else if (iapInfo.min < lastIapMin) { iapNotified = true; iapReason = "dropped"; }
    }
  }

  // 发送通知
  if (notified) {
    const title = name + (monitor_mode !== "change" ? " 降价啦！" : " 价格变动");
    let desp = free ? "**状态: 免费**\n\n" : `**价格: ${cur === 'USD' ? '$' : ''}${price} ${cur}**\n\n`;
    if (monitor_mode !== "change" && !free) desp += `已低于阈值 $${threshold}\n\n`;
    desp += `- 应用ID: \`${id}\`\n`;
    if (note) desp += `- 备注: ${note}\n`;
    desp += `[打开 Google Play](https://play.google.com/store/apps/details?id=${id})`;
    await sendSc3(SC3_URL, title, desp);
    await DB.prepare("UPDATE apps SET last_notified_price=?, last_notified_at=? WHERE id=?").bind(price, now, id).run();
    await DB.prepare("INSERT INTO notifications (app_id, name, price, threshold, type, notified, time) VALUES (?,?,?,?,?,?,?)").bind(id, name, price, threshold, 'price', 1, now).run();
  }

  if (iapNotified) {
    const title = `${name} 内购降价啦！`;
    let desp = `**最低内购价: ${iapInfo.currencySymbol}${iapInfo.min}**\n\n`;
    desp += `内购价格区间: ${iapInfo.text}\n\n`;
    if (iap_threshold) desp += `已低于内购阈值 $${iap_threshold}\n\n`;
    desp += `- 应用ID: \`${id}\`\n`;
    desp += `[打开 Google Play](https://play.google.com/store/apps/details?id=${id})`;
    await sendSc3(SC3_URL, title, desp);
    await DB.prepare("UPDATE apps SET last_iap_notified_price=?, last_iap_notified_at=? WHERE id=?").bind(iapInfo.min, now, id).run();
    await DB.prepare("INSERT INTO notifications (app_id, name, price, threshold, type, notified, time) VALUES (?,?,?,?,?,?,?)").bind(id, name + ' (内购)', iapInfo.min, iap_threshold, 'iap', 1, now).run();
  }

  // 更新 D1 apps 表最新状态
  const updateFields = [];
  const updateVals = [];
  const set = (f, v) => { updateFields.push(f + "=?"); updateVals.push(v); };
  set("last_price", price);
  set("last_free", free ? 1 : 0);
  set("last_currency", cur);
  set("last_price_text", mainPriceInfo.priceText || `$${price}`);
  if (icon) set("last_icon", icon);
  if (score) set("last_score", score);
  if (scoreText) set("last_score_text", scoreText);
  if (installs) set("last_installs", installs);
  if (developer) set("last_developer", typeof developer === 'object' ? (developer.devId || developer.name || JSON.stringify(developer)) : developer);
  set("last_offers_iap", mainPriceInfo.offersIAP ? 1 : 0);
  set("last_iap_range", mainPriceInfo.IAPRange || "");
  set("last_contains_ads", mainPriceInfo.containsAds ? 1 : 0);
  set("last_prices_by_country", JSON.stringify(pricesByCountry));
  set("last_checked_at", now);
  updateFields.push("updated_at=?");
  updateVals.push(now);
  updateVals.push(id);

  await DB.prepare("UPDATE apps SET " + updateFields.join(",") + " WHERE id=?").bind(...updateVals).run();

  return {
    app_id: id, name, ok: true, price, currency: cur, free, threshold,
    notified: notified || iapNotified, reason,
    iap: iapInfo, iapNotified, prices_by_country: pricesByCountry,
    icon, score, scoreText, installs
  };
}

async function sendSc3(url, title, desp) {
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, desp }) });
}

// ==================== 手动触发价格检查 ====================
async function handleCheck(env) {
  const result = await monitorAndNotify(env);
  return jsonResponse(result);
}

// ==================== Trend API ====================
async function handleTrend(request, env) {
  const url = new URL(request.url);
  const appId = url.searchParams.get("appId");
  if (!appId) return jsonResponse({ error: "appId required" }, 400);
  const range = url.searchParams.get("range") || "week";
  const country = url.searchParams.get("country") || "us";

  const now = new Date();
  let since;
  if (range === "week") since = new Date(now.getTime() - 7 * 86400000).toISOString();
  else if (range === "month") since = new Date(now.getTime() - 30 * 86400000).toISOString();
  else if (range === "year") since = new Date(now.getTime() - 365 * 86400000).toISOString();
  else return jsonResponse({ error: "invalid range" }, 400);

  try {
    const rows = await env.DB.prepare(
      "SELECT price, free, currency, price_text, recorded_at FROM price_history WHERE app_id=? AND country=? AND recorded_at>=? ORDER BY recorded_at ASC"
    ).bind(appId, country, since).all();

    let data = rows.results || [];
    if (range === "year") {
      const dayMap = {};
      for (const r of data) { dayMap[r.recorded_at.substring(0, 10)] = r; }
      data = Object.values(dayMap).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    }

    return jsonResponse({
      ok: true, app_id: appId, range,
      data: data.map(r => ({ price: r.price, free: !!r.free, currency: r.currency, priceText: r.price_text, time: r.recorded_at }))
    });
  } catch (e) {
    return jsonResponse({ ok: false, error: e.message });
  }
}

// ==================== 数据迁移 ====================
async function handleMigrate(env) {
  const { DB, ICONS } = env;
  const KV = env.KV;
  const result = { apps: 0, icons: 0, notifications: 0, status_restored: 0, errors: [] };

  // 1. 迁移应用配置 + 状态
  try {
    const kvApps = await KV.get("config:apps", "json") || [];
    const now = new Date().toISOString();
    for (const app of kvApps) {
      try {
        // 读取 KV 中的状态数据
        const st = await KV.get("status:" + app.id, "json") || {};
        await DB.prepare(
          `INSERT OR REPLACE INTO apps
           (id,name,threshold,country,countries,lang,note,monitor_mode,monitor_iap,iap_threshold,
            created_at,updated_at,
            last_price,last_free,last_currency,last_price_text,last_icon,last_score,last_score_text,
            last_installs,last_developer,last_offers_iap,last_iap_range,last_contains_ads,
            last_prices_by_country,last_notified_price,last_notified_at,
            last_iap_notified_price,last_iap_notified_at,last_checked_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,
             ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(
          app.id, app.name || app.id,
          app.threshold ?? 6,
          app.country || "us",
          JSON.stringify(app.countries || [app.country || "us"]),
          app.lang || "en",
          app.note || "",
          app.monitor_mode || "threshold",
          app.monitor_iap ? 1 : 0,
          app.iap_threshold || null,
          app.created_at || now, now,
          // 状态字段
          st.last_checked_price ?? null,
          st.last_checked_free ?? 0,
          "USD",
          null,
          st.icon || "",
          st.score ?? null,
          st.scoreText || "",
          st.installs || "",
          typeof st.developer === 'object' ? JSON.stringify(st.developer) : (st.developer || ""),
          st.offersIAP ? 1 : 0,
          st.IAPRange || "",
          st.containsAds ? 1 : 0,
          JSON.stringify(st.prices_by_country || {}),
          st.last_notified_price ?? null,
          st.last_notified_at || null,
          st.last_iap_notified_price ?? null,
          st.last_iap_notified_at || null,
          st.last_checked_at || null
        ).run();
        result.apps++;
        if (Object.keys(st).length > 0) result.status_restored++;
      } catch (e) { result.errors.push(`app ${app.id}: ${e.message}`); }
    }
  } catch (e) { result.errors.push("read config:apps: " + e.message); }

  // 2. 迁移通知历史
  try {
    const history = await KV.get("history", "json") || [];
    for (const h of history) {
      try {
        await DB.prepare(
          "INSERT INTO notifications (app_id, name, price, threshold, type, notified, time) VALUES (?,?,?,?,?,?,?)"
        ).bind(h.app_id || "", h.name || "", h.price || 0, h.threshold || 0, h.type || "price", h.notified ? 1 : 0, h.time || now).run();
        result.notifications++;
      } catch (e) { result.errors.push(`notification: ${e.message}`); }
    }
  } catch (e) { result.errors.push("read history: " + e.message); }

  // 3. 迁移图标 (KV → R2)
  if (ICONS) {
    try {
      const listResult = await KV.list({ prefix: "icon_data:" });
      for (const key of listResult.keys) {
        try {
          const appId = key.name.substring(10);
          const existing = await ICONS.get("icons/" + appId);
          if (existing) continue;
          const data = await KV.get(key.name, "text");
          if (!data) continue;
          const parts = data.split(",");
          if (parts.length < 2) continue;
          const mime = parts[0].match(/data:([^;]+)/);
          const buf = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));
          await ICONS.put("icons/" + appId, buf, { httpMetadata: { contentType: mime ? mime[1] : "image/png" } });
          result.icons++;
        } catch (e) { result.errors.push(`icon ${key.name}: ${e.message}`); }
      }
    } catch (e) { result.errors.push("icon migration: " + e.message); }
  }

  return jsonResponse(result);
}
