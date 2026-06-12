// ==================== 导入 ====================
import { renderHtml, esc } from "./dashboard.js";

const DEFAULT_COUNTRY = "us";
const DEFAULT_LANG = "en";
const DEFAULT_THRESHOLD = 6;
const DEFAULT_CURRENCY = "USD";
const SCRAPER_API_DEFAULT = "https://play-scraper-api.vercel.app/api/price";
const HISTORY_MAX = 50;

export default {
  async scheduled(event, env, ctx) { await monitorAndNotify(env); },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/api/apps") return handleAppsApi(request, env);
    if (path === "/check" || path === "/api/check") { const res = await monitorAndNotify(env); return jsonResponse(res); }
    if (path === "/api/history") return handleHistory(env);
    if (path === "/api/status") return handleStatus(env);
    if (path === "/api/search") return handleSearch(request, env);
    if (path.startsWith("/api/")) return jsonResponse({ error: "Not found" }, 404);
    return handleDashboard(env);
  },
};

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
    const appConfig = { id: body.app_id, name, threshold: body.threshold ?? DEFAULT_THRESHOLD, country, lang, currency: DEFAULT_CURRENCY, created_at: new Date().toISOString() };
    apps.push(appConfig);
    await env.KV.put("config:apps", JSON.stringify(apps));
    if (info) {
      const st = await env.KV.get("status:" + body.app_id, "json") || {};
      st.last_checked_price = info.price;
      st.last_checked_at = new Date().toISOString();
      st.icon = info.icon; st.score = info.score; st.scoreText = info.scoreText; st.ratings = info.ratings;
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
  const result = [];
  for (const app of apps) {
    const st = await env.KV.get("status:" + app.id, "json") || {};
    result.push({ ...app, status: st });
  }
  return jsonResponse(result);
}

async function handleSearch(request, env) {
  const term = new URL(request.url).searchParams.get("term");
  if (!term) return jsonResponse({ error: "term required" }, 400);
  const proxy = env.SCRAPER_PROXY;
  if (!proxy) return jsonResponse({ error: "SCRAPER_PROXY not configured" }, 400);
  try {
    const resp = await fetch(proxy + "?method=search&term=" + encodeURIComponent(term) + "&num=10", { headers: { Accept: "application/json" } });
    const data = await resp.json();
    if (!data.ok) return jsonResponse({ error: data.error || "search failed" }, 500);
    return jsonResponse({ ok: true, results: data.data });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

async function fetchAppInfo(env, appId, country, lang) {
  const proxy = env.SCRAPER_PROXY;
  if (proxy) {
    try {
      const resp = await fetch(proxy + "?method=app&appId=" + appId + "&country=" + country + "&lang=" + lang);
      const data = await resp.json();
      if (data.ok && data.data) {
        return {
          price: data.data.price, currency: data.data.currency || "USD",
          icon: data.data.icon, title: data.data.title,
          score: data.data.score, scoreText: data.data.scoreText,
          ratings: data.data.ratings,
        };
      }
    } catch (e) {}
  }
  const fallbackResp = await fetch((env.SCRAPER_API || SCRAPER_API_DEFAULT) + "?id=" + appId + "&country=" + country + "&lang=" + lang);
  if (fallbackResp.ok) { const data = await fallbackResp.json(); return { price: data.price, currency: data.currency || "USD" }; }
  return null;
}

async function monitorAndNotify(env) {
  const SCRAPER_API = env.SCRAPER_API || SCRAPER_API_DEFAULT;
  const SC3_UID = env.SC3_UID;
  const SC3_SENDKEY = env.SC3_SENDKEY;
  const PROXY = env.SCRAPER_PROXY;
  if (!SC3_UID || !SC3_SENDKEY) return { ok: false, error: "Missing SC3_UID or SC3_SENDKEY" };
  const apps = await getApps(env);
  if (!apps.length) return { ok: true, message: "No apps configured" };
  const results = [];
  for (const app of apps) {
    try { results.push(await checkApp(app, SCRAPER_API, PROXY, SC3_UID, SC3_SENDKEY, env)); }
    catch (e) { results.push({ app_id: app.id, name: app.name, ok: false, error: e.message }); }
  }
  return { ok: true, results };
}

async function checkApp(app, scraperApi, proxy, sc3Uid, sc3Sendkey, env) {
  const { id, name, country, lang, threshold } = app;
  let price, cur = "USD", icon, score, scoreText, ratings;
  if (proxy) {
    try {
      const resp = await fetch(proxy + "?method=app&appId=" + id + "&country=" + country + "&lang=" + lang);
      const data = await resp.json();
      if (data.ok && data.data) {
        price = data.data.price; cur = data.data.currency || "USD";
        icon = data.data.icon; score = data.data.score; scoreText = data.data.scoreText;
        ratings = data.data.ratings;
      }
    } catch (e) {}
  }
  if (price === undefined) {
    const priceInfo = await fetchPrice(scraperApi, id, country, lang);
    if (!priceInfo || !priceInfo.ok) return { app_id: id, name, ok: false, error: "fetch_price_failed" };
    price = priceInfo.price; cur = priceInfo.currency || "USD";
  }
  const statusKey = "status:" + id;
  const status = await env.KV.get(statusKey, "json") || {};
  status.last_checked_price = price;
  status.last_checked_at = new Date().toISOString();
  status.icon = icon || status.icon; status.score = score || status.score;
  status.scoreText = scoreText || status.scoreText; status.ratings = ratings || status.ratings;
  const below = price > 0 && price < threshold && cur === "USD";
  let notified = false, reason = null;
  if (below) {
    const last = status.last_notified_price;
    if (last === undefined || last === null) { notified = true; reason = "first_drop"; }
    else if (price < last) { notified = true; reason = "price_dropped"; }
    else if (price === last) { notified = false; reason = "price_unchanged"; }
    else { notified = false; reason = "price_rose"; }
  }
  if (notified) {
    const nr = await sendSc3(sc3Uid, sc3Sendkey, name + " 降价啦！", "**" + price + " " + cur + "**，已低于阈值 " + threshold + " " + cur + "\n\n应用ID：`" + id + "`\n时间：" + new Date().toISOString() + "\n\n[打开 Google Play](https://play.google.com/store/apps/details?id=" + id + "&hl=" + lang + "&gl=" + country + ")");
    status.last_notified_price = price; status.last_notified_at = new Date().toISOString();
    await appendHistory(env, { app_id: id, name, price, threshold, time: new Date().toISOString(), notified: true });
    await env.KV.put(statusKey, JSON.stringify(status));
    return { app_id: id, name, ok: true, price, currency: cur, threshold, notified: true, reason, icon, score, scoreText, ratings, sc3: nr };
  }
  await env.KV.put(statusKey, JSON.stringify(status));
  return { app_id: id, name, ok: true, price, currency: cur, threshold, notified: false, reason, icon, score, scoreText, ratings };
}

async function fetchPrice(api, appId, country, lang) {
  const resp = await fetch(api + "?id=" + appId + "&country=" + country + "&lang=" + lang, { headers: { Accept: "application/json" } });
  if (!resp.ok) throw new Error("Vercel " + resp.status);
  return await resp.json();
}

async function sendSc3(uid, key, title, desp) {
  const resp = await fetch("https://" + uid + ".push.ft07.com/send/" + key + ".send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, desp }) });
  return { status: resp.status, body: await resp.text() };
}

async function getApps(env) { return await env.KV.get("config:apps", "json") || []; }

async function appendHistory(env, entry) {
  let h = await env.KV.get("history", "json") || [];
  h.unshift(entry);
  if (h.length > HISTORY_MAX) h = h.slice(0, HISTORY_MAX);
  await env.KV.put("history", JSON.stringify(h));
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
}

async function handleDashboard(env) {
  const apps = await getApps(env);
  const list = [];
  for (const app of apps) {
    const st = await env.KV.get("status:" + app.id, "json") || {};
    list.push({ ...app, status: st });
  }
  const history = await env.KV.get("history", "json") || [];
  return new Response(renderHtml(list, history, !!(env.SC3_UID && env.SC3_SENDKEY), !!(env.SCRAPER_PROXY)), { headers: { "Content-Type": "text/html;charset=utf-8" } });
}
