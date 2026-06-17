// ==================== 配置常量 ====================
const DEFAULT_COUNTRY = "us";
const DEFAULT_LANG = "en";
const DEFAULT_THRESHOLD = 6;
const DEFAULT_CURRENCY = "USD";
const HISTORY_MAX = 50;

// ==================== Worker 入口 ====================
export default {
  async scheduled(event, env, ctx) { await monitorAndNotify(env); },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/api/apps") return handleAppsApi(request, env);
    if (path === "/check" || path === "/api/check") { const res = await monitorAndNotify(env); return jsonResponse(res); }
    if (path === "/api/history") return handleHistory(env);
    if (path === "/api/status") return handleStatus(env);
    if (path === "/api/dashboard") return handleDashboardApi(env);
    if (path === "/api/search") return handleSearch(request, env);
    if (path.startsWith("/api/")) return jsonResponse({ error: "Not found" }, 404);
    // 非 API 请求：让 Cloudflare Assets 处理静态资源
    return env.ASSETS.fetch(request);
  },
};

// ==================== API 处理函数 ====================

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
    let name = body.name || "";
    const country = body.country || DEFAULT_COUNTRY;
    const lang = body.lang || DEFAULT_LANG;
    const apps = await getApps(env);
    if (apps.find(a => a.id === body.app_id)) return jsonResponse({ error: "App already exists" }, 409);
    let info = null;
    try { info = await fetchAppInfo(env, body.app_id, country, lang); } catch (e) {}
    if (!name && info && info.title) name = info.title;
    if (!name) name = body.app_id;
    const appConfig = { id: body.app_id, name, threshold: body.threshold ?? DEFAULT_THRESHOLD, country, lang, currency: DEFAULT_CURRENCY, created_at: new Date().toISOString(), monitor_mode: body.monitor_mode || "threshold" };
    if (body.note) appConfig.note = body.note;
    apps.push(appConfig);
    await env.KV.put("config:apps", JSON.stringify(apps));
    if (info) {
      const st = await env.KV.get("status:" + body.app_id, "json") || {};
      st.last_checked_price = info.price; st.last_checked_at = new Date().toISOString();
      st.initial_price = info.price;
      st.icon = info.icon; st.score = info.score; st.scoreText = info.scoreText; st.ratings = info.ratings; st.developer = info.developer;
      await env.KV.put("status:" + body.app_id, JSON.stringify(st));
    }
    return jsonResponse({ ok: true, name });
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
    for (const key in body) { if (key !== "app_id") apps[idx][key] = body[key]; }
    await env.KV.put("config:apps", JSON.stringify(apps));
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
}

async function handleHistory(env) { return jsonResponse(await env.KV.get("history", "json") || []); }

async function handleStatus(env) {
  const apps = await getApps(env);
  const result = {};
  for (const app of apps) result[app.id] = await env.KV.get("status:" + app.id, "json") || {};
  return jsonResponse(result);
}

// Dashboard API - 返回前端渲染所需的 JSON 数据
async function handleDashboardApi(env) {
  var apps = await getApps(env);
  var list = [];
  for (var k = 0; k < apps.length; k++) {
    var app = apps[k];
    var st = await env.KV.get("status:" + app.id, "json") || {};
    list.push({ id: app.id, name: app.name, threshold: app.threshold, country: app.country, note: app.note, monitor_mode: app.monitor_mode, status: st });
  }
  var history = await env.KV.get("history", "json") || [];
  return jsonResponse({
    apps: list,
    history: history,
    hasSc3: !!(env.SC3_UID && env.SC3_SENDKEY),
    hasProxy: !!env.SCRAPER_API
  });
}

async function handleSearch(request, env) {
  const url = new URL(request.url);
  const term = url.searchParams.get("term");
  if (!term) return jsonResponse({ error: "term required" }, 400);
  const proxy = env.SCRAPER_API;
  if (!proxy) return jsonResponse({ error: "SCRAPER_API not configured" }, 503);
  try {
    const resp = await fetch(proxy + "?method=search&term=" + encodeURIComponent(term) + "&num=10", { headers: { Accept: "application/json" } });
    const data = await resp.json();
    return jsonResponse(data);
  } catch (e) {
    return jsonResponse({ error: "Search failed: " + e.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
}

function getApps(env) {
  return env.KV.get("config:apps", "json").then(v => v || []);
}

// ==================== 核心业务逻辑 ====================

async function monitorAndNotify(env) {
  const apps = await getApps(env);
  if (!apps.length) return { checked: 0, notified: 0 };
  let checked = 0, notified = 0;
  const history = await env.KV.get("history", "json") || [];
  for (const app of apps) {
    try {
      const info = await fetchAppInfo(env, app.id, app.country, app.lang);
      checked++;
      const st = await env.KV.get("status:" + app.id, "json") || {};
      const prevPrice = st.last_checked_price;
      st.last_checked_price = info.price;
      st.last_checked_at = new Date().toISOString();
      if (!st.initial_price && info.price !== undefined) st.initial_price = info.price;
      st.icon = info.icon; st.score = info.score; st.scoreText = info.scoreText; st.ratings = info.ratings; st.developer = info.developer;
      await env.KV.put("status:" + app.id, JSON.stringify(st));
      let shouldNotify = false;
      if (app.monitor_mode === "change") {
        if (prevPrice !== undefined && info.price !== undefined && prevPrice !== info.price) shouldNotify = true;
      } else {
        if (info.price !== undefined && info.price > 0 && info.price < app.threshold) shouldNotify = true;
      }
      if (shouldNotify) {
        const notifySuccess = await sendNotification(env, app, info, prevPrice);
        if (notifySuccess) {
          notified++;
          st.last_notified_at = new Date().toISOString();
          await env.KV.put("status:" + app.id, JSON.stringify(st));
          history.unshift({ time: new Date().toISOString(), app_id: app.id, name: app.name, price: info.price, notified: true });
        }
      } else if (prevPrice !== info.price) {
        history.unshift({ time: new Date().toISOString(), app_id: app.id, name: app.name, price: info.price, notified: false });
      }
    } catch (e) { console.error("Check failed for " + app.id + ": " + e.message); }
  }
  if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
  await env.KV.put("history", JSON.stringify(history));
  return { checked, notified };
}

async function fetchAppInfo(env, appId, country, lang) {
  const proxy = env.SCRAPER_API;
  if (proxy) {
    const resp = await fetch(proxy + "?method=app&appId=" + appId + "&country=" + country + "&lang=" + lang);
    if (!resp.ok) throw new Error("Proxy fetch failed: " + resp.status);
    const data = await resp.json();
    return { title: data.title, price: data.price, icon: data.icon, score: data.score, scoreText: data.scoreText, ratings: data.ratings, developer: data.developer, free: data.free };
  }
  const fallbackResp = await fetch((env.SCRAPER_API) + "?id=" + appId + "&country=" + country + "&lang=" + lang);
  if (!fallbackResp.ok) throw new Error("API fetch failed: " + fallbackResp.status);
  const fallbackData = await fallbackResp.json();
  return { title: fallbackData.title, price: fallbackData.price, icon: fallbackData.icon, score: fallbackData.score, scoreText: fallbackData.scoreText, ratings: fallbackData.ratings, developer: fallbackData.developer };
}

async function sendNotification(env, app, info, prevPrice) {
  const SC3_UID = env.SC3_UID;
  const SC3_SENDKEY = env.SC3_SENDKEY;
  if (!SC3_UID || !SC3_SENDKEY) return false;
  const mode = app.monitor_mode === "change" ? "价格变动" : "降价提醒";
  const changeInfo = prevPrice !== undefined ? " (原价: $" + prevPrice + ")" : "";
  const title = "[" + mode + "] " + app.name;
  const desp = "## " + app.name + "\n\n**当前价格**: $" + info.price + changeInfo + "\n\n**阈值**: $" + app.threshold + "\n\n**App ID**: " + app.id;
  const resp = await fetch("https://" + SC3_UID + ".push.ft07.com/send/" + SC3_SENDKEY + ".send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, desp }) });
  return resp.ok;
}
