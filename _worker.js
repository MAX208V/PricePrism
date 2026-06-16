function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

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
    // Serve static assets for all other routes
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      return new Response("ERR: " + e.message + "\n" + e.stack, { status: 500, headers: { "Content-Type": "text/plain;charset=utf-8" } });
    }
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
    const idx = apps.findIndex(a => a.id === body.app_id);
    if (idx === -1) return jsonResponse({ error: "App not found" }, 404);
    apps.splice(idx, 1);
    await env.KV.put("config:apps", JSON.stringify(apps));
    await env.KV.delete("status:" + body.app_id);
    return jsonResponse({ ok: true });
  }
  if (request.method === "PATCH") {
    const body = await request.json();
    if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);
    let apps = await getApps(env);
    const app = apps.find(a => a.id === body.app_id);
    if (!app) return jsonResponse({ error: "App not found" }, 404);
    if (body.name !== undefined) app.name = body.name;
    if (body.threshold !== undefined) app.threshold = body.threshold;
    if (body.country !== undefined) app.country = body.country;
    if (body.lang !== undefined) app.lang = body.lang;
    if (body.note !== undefined) {
      if (body.note) app.note = body.note; else delete app.note;
    }
    if (body.monitor_mode !== undefined) app.monitor_mode = body.monitor_mode;
    await env.KV.put("config:apps", JSON.stringify(apps));
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
}

async function handleHistory(env) { return jsonResponse(await env.KV.get("history", "json") || []); }

async function handleStatus(env) {
  const data = {
    hasSc3: !!(env.SC3_UID && env.SC3_SENDKEY),
    hasProxy: !!(env.SCRAPER_PROXY)
  };
  return jsonResponse(data);
}

async function handleSearch(request, env) {
  const url = new URL(request.url);
  const term = url.searchParams.get("term");
  if (!term) return jsonResponse({ error: "term required" }, 400);
  const proxy = env.SCRAPER_PROXY || "";
  const searchUrl = "https://play-scraper-api.vercel.app/api/search?term=" + encodeURIComponent(term);
  try {
    const res = await fetch(proxy ? proxy + "?url=" + encodeURIComponent(searchUrl) : searchUrl);
    const data = await res.json();
    return jsonResponse(data);
  } catch (e) {
    return jsonResponse({ error: "Search failed: " + e.message }, 502);
  }
}

async function fetchAppInfo(env, appId, country, lang) {
  const proxy = env.SCRAPER_PROXY || "";
  const apiUrl = "https://play-scraper-api.vercel.app/api/app?appId=" + encodeURIComponent(appId) + "&country=" + encodeURIComponent(country) + "&lang=" + encodeURIComponent(lang);
  try {
    const res = await fetch(proxy ? proxy + "?url=" + encodeURIComponent(apiUrl) : apiUrl);
    const data = await res.json();
    if (!data || data.error) throw new Error(data ? data.error : "No data");
    return {
      price: data.price,
      icon: data.icon,
      score: data.score,
      scoreText: data.scoreText,
      ratings: data.ratings,
      developer: data.developer,
      title: data.title
    };
  } catch (e) {
    throw new Error("Failed to fetch app info: " + e.message);
  }
}

async function monitorAndNotify(env) {
  const results = [];
  const apps = await getApps(env);
  const scraperApi = env.SCRAPER_API || SCRAPER_API_DEFAULT;
  const proxy = env.SCRAPER_PROXY || "";
  const sc3Uid = env.SC3_UID || "";
  const sc3Sendkey = env.SC3_SENDKEY || "";
  for (const app of apps) {
    try {
      const res = await checkApp(app, scraperApi, proxy, sc3Uid, sc3Sendkey, env);
      results.push(res);
    } catch (e) {
      results.push({ app: app.id, error: e.message });
    }
  }
  return { ok: true, results };
}

async function checkApp(app, scraperApi, proxy, sc3Uid, sc3Sendkey, env) {
  const result = { app: app.id, name: app.name };
  const prevStatus = await env.KV.get("status:" + app.id, "json") || {};
  const priceInfo = await fetchPrice(scraperApi, app.id, app.country || DEFAULT_COUNTRY, app.lang || DEFAULT_LANG);
  const price = priceInfo.price;
  const now = new Date().toISOString();
  const prevPrice = prevStatus.last_checked_price;
  const mode = app.monitor_mode || "threshold";
  let shouldNotify = false;
  let notifyReason = "";

  if (mode === "change") {
    if (prevPrice !== undefined && prevPrice !== null && price !== null && price !== undefined && prevPrice !== price) {
      shouldNotify = true;
      notifyReason = `price_changed:${prevPrice}->${price}`;
    }
  } else {
    if (price !== null && price !== undefined && price > 0 && price < app.threshold) {
      if (prevPrice === undefined || prevPrice === null || prevPrice >= app.threshold || price < prevPrice) {
        shouldNotify = true;
        notifyReason = `below_threshold:${app.threshold}`;
      }
    }
  }

  const newStatus = {
    ...prevStatus,
    last_checked_price: price,
    last_checked_at: now,
    icon: priceInfo.icon || prevStatus.icon,
    score: priceInfo.score || prevStatus.score,
    scoreText: priceInfo.scoreText || prevStatus.scoreText,
    ratings: priceInfo.ratings || prevStatus.ratings,
    developer: priceInfo.developer || prevStatus.developer,
  };

  if (shouldNotify && sc3Uid && sc3Sendkey) {
    try {
      const title = app.name + (mode === "change" ? " 价格变动" : " 降价提醒");
      let desp = "应用: " + app.name + " (" + app.id + ")\\n";
      desp += "地区: " + (app.country || DEFAULT_COUNTRY).toUpperCase() + "\\n";
      if (mode === "change") {
        desp += "价格变动: $" + prevPrice + " → $" + price;
      } else {
        desp += "当前价格: $" + price + "\\n";
        desp += "降价阈值: $" + app.threshold;
      }
      desp += "\\n\\n监控模式: " + (mode === "change" ? "价格变动通知" : "低于阈值通知");
      await sendSc3(sc3Uid, sc3Sendkey, title, desp);
      newStatus.last_notified_at = now;
      result.notified = true;
      result.notifyReason = notifyReason;
    } catch (notifyErr) {
      result.notifyError = notifyErr.message;
    }
  }

  const histEntry = { time: now, app: app.id, name: app.name, price, notified: !!result.notified };
  await appendHistory(env, histEntry);

  await env.KV.put("status:" + app.id, JSON.stringify(newStatus));
  result.price = price;
  result.notified = !!result.notified;
  return result;
}

async function fetchPrice(api, appId, country, lang) {
  const url = api + "?appId=" + encodeURIComponent(appId) + "&country=" + encodeURIComponent(country) + "&lang=" + encodeURIComponent(lang);
  const res = await fetch(url);
  const data = await res.json();
  if (!data || data.error) throw new Error(data ? data.error : "No price data");
  return {
    price: data.price,
    icon: data.icon,
    score: data.score,
    scoreText: data.scoreText,
    ratings: data.ratings,
    developer: data.developer
  };
}

async function sendSc3(uid, key, title, desp) {
  const url = "https://sctapi.ftqq.com/" + uid + ".send?title=" + encodeURIComponent(title) + "&desp=" + encodeURIComponent(desp);
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" } });
  const data = await res.json();
  if (data.code !== 0) throw new Error("ServerChan send failed: " + (data.message || data.info || "unknown"));
  return data;
}

async function getApps(env) { return await env.KV.get("config:apps", "json") || []; }

async function appendHistory(env, entry) {
  let history = await env.KV.get("history", "json") || [];
  history.unshift(entry);
  if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
  await env.KV.put("history", JSON.stringify(history));
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
}