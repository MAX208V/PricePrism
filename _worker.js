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
    console.log(`收到请求: ${path} ${request.method}`);
    
    if (path === "/api/apps") return handleAppsApi(request, env);
    if (path === "/check" || path === "/api/check") { const res = await monitorAndNotify(env); return jsonResponse(res); }
    if (path === "/api/history") return handleHistory(env);
    if (path === "/api/status") return handleStatus(env);
    if (path === "/api/search") return handleSearch(request, env);
    if (path.startsWith("/api/")) return jsonResponse({ error: "Not found" }, 404);
    
    // Serve static assets for all other routes
    console.log(`返回静态资源: ${path}`);
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      console.error("ASSETS.fetch 错误:", e);
      return new Response("ERR: " + e.message + "\n" + e.stack, { status: 500, headers: { "Content-Type": "text/plain;charset=utf-8" } });
    }
  },
};

async function handleAppsApi(request, env) {
  console.log(`处理 /api/apps, 方法: ${request.method}`);
  
  if (request.method === "GET") {
    try {
      const apps = await getApps(env);
      console.log(`从 KV 获取到 ${apps.length} 个应用`);
      
      const result = [];
      for (const app of apps) {
        const st = await env.KV.get("status:" + app.id, "json") || {};
        const appData = {
          id: app.id,
          name: app.name,
          threshold: app.threshold,
          country: app.country,
          lang: app.lang,
          currency: app.currency,
          created_at: app.created_at,
          monitor_mode: app.monitor_mode || "threshold",
          status: st
        };
        
        // 添加可选字段
        if (app.note !== undefined) appData.note = app.note;
        
        result.push(appData);
      }
      
      console.log(`返回 ${result.length} 个应用数据`);
      return jsonResponse(result);
    } catch (error) {
      console.error("GET /api/apps 错误:", error);
      return jsonResponse({ error: "Internal server error: " + error.message }, 500);
    }
  }
  
  if (request.method === "POST") {
    try {
      const body = await request.json();
      console.log("POST 请求数据:", body);
      
      if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);
      
      let name = body.name || "";
      const country = body.country || DEFAULT_COUNTRY;
      const lang = body.lang || DEFAULT_LANG;
      
      const apps = await getApps(env);
      if (apps.find(a => a.id === body.app_id)) {
        return jsonResponse({ error: "App already exists" }, 409);
      }
      
      let info = null;
      try { 
        info = await fetchAppInfo(env, body.app_id, country, lang); 
        console.log("应用信息获取成功:", info);
      } catch (e) {
        console.log("获取应用信息失败:", e.message);
      }
      
      if (!name && info && info.title) name = info.title;
      if (!name) name = body.app_id;
      
      const appConfig = {
        id: body.app_id,
        name,
        threshold: body.threshold ?? DEFAULT_THRESHOLD,
        country,
        lang,
        currency: DEFAULT_CURRENCY,
        created_at: new Date().toISOString(),
        monitor_mode: body.monitor_mode || "threshold"
      };
      
      if (body.note !== undefined && body.note !== "") {
        appConfig.note = body.note;
      }
      
      apps.push(appConfig);
      await env.KV.put("config:apps", JSON.stringify(apps));
      console.log(`应用 ${body.app_id} 已添加到 KV`);
      
      if (info) {
        const st = await env.KV.get("status:" + body.app_id, "json") || {};
        st.last_checked_price = info.price; 
        st.last_checked_at = new Date().toISOString();
        st.initial_price = info.price;
        st.icon = info.icon; 
        st.score = info.score; 
        st.scoreText = info.scoreText; 
        st.ratings = info.ratings; 
        st.developer = info.developer;
        
        await env.KV.put("status:" + body.app_id, JSON.stringify(st));
        console.log(`应用 ${body.app_id} 状态已更新`);
      }
      
      return jsonResponse({ ok: true, name });
    } catch (error) {
      console.error("POST /api/apps 错误:", error);
      return jsonResponse({ error: "Internal server error: " + error.message }, 500);
    }
  }
  
  if (request.method === "DELETE") {
    try {
      const body = await request.json();
      if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);
      
      const apps = await getApps(env);
      const idx = apps.findIndex(a => a.id === body.app_id);
      if (idx === -1) return jsonResponse({ error: "App not found" }, 404);
      
      apps.splice(idx, 1);
      await env.KV.put("config:apps", JSON.stringify(apps));
      await env.KV.delete("status:" + body.app_id);
      
      console.log(`应用 ${body.app_id} 已删除`);
      return jsonResponse({ ok: true });
    } catch (error) {
      console.error("DELETE /api/apps 错误:", error);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  }
  
  if (request.method === "PATCH") {
    try {
      const body = await request.json();
      if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);
      
      const apps = await getApps(env);
      const app = apps.find(a => a.id === body.app_id);
      if (!app) return jsonResponse({ error: "App not found" }, 404);
      
      if (body.name !== undefined) app.name = body.name;
      if (body.threshold !== undefined) app.threshold = body.threshold;
      if (body.country !== undefined) app.country = body.country;
      if (body.lang !== undefined) app.lang = body.lang;
      
      if (body.note !== undefined) {
        if (body.note && body.note.trim() !== "") {
          app.note = body.note.trim();
        } else {
          delete app.note;
        }
      }
      
      if (body.monitor_mode !== undefined) app.monitor_mode = body.monitor_mode;
      
      await env.KV.put("config:apps", JSON.stringify(apps));
      console.log(`应用 ${body.app_id} 已更新`);
      return jsonResponse({ ok: true });
    } catch (error) {
      console.error("PATCH /api/apps 错误:", error);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  }
  
  return jsonResponse({ error: "Method not allowed" }, 405);
}

async function handleHistory(env) {
  try {
    const history = await env.KV.get("history", "json") || [];
    console.log(`返回 ${history.length} 条历史记录`);
    return jsonResponse(history);
  } catch (error) {
    console.error("GET /api/history 错误:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}

async function handleStatus(env) {
  const data = {
    hasSc3: !!(env.SC3_UID && env.SC3_SENDKEY),
    hasProxy: !!(env.SCRAPER_PROXY)
  };
  console.log("状态检查:", data);
  return jsonResponse(data);
}

async function handleSearch(request, env) {
  const url = new URL(request.url);
  const term = url.searchParams.get("term");
  if (!term) return jsonResponse({ error: "term required" }, 400);
  
  const proxy = env.SCRAPER_PROXY || "";
  const searchUrl = "https://play-scraper-api.vercel.app/api/search?term=" + encodeURIComponent(term);
  
  try {
    console.log(`搜索: ${term}, 使用代理: ${proxy ? "是" : "否"}`);
    const res = await fetch(proxy ? proxy + "?url=" + encodeURIComponent(searchUrl) : searchUrl);
    const data = await res.json();
    return jsonResponse(data);
  } catch (e) {
    console.error("搜索失败:", e);
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
  console.log("开始监控和通知检查");
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
      console.error(`检查应用 ${app.id} 失败:`, e);
      results.push({ app: app.id, error: e.message });
    }
  }
  
  console.log(`监控完成，处理了 ${apps.length} 个应用`);
  return { ok: true, results };
}

async function checkApp(app, scraperApi, proxy, sc3Uid, sc3Sendkey, env) {
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
      
      console.log(`应用 ${app.id} 已发送通知`);
    } catch (notifyErr) {
      console.error(`发送通知失败 ${app.id}:`, notifyErr);
    }
  }

  const histEntry = { time: now, app: app.id, name: app.name, price, notified: shouldNotify && !!sc3Uid && !!sc3Sendkey };
  await appendHistory(env, histEntry);

  await env.KV.put("status:" + app.id, JSON.stringify(newStatus));
  
  return {
    app: app.id,
    name: app.name,
    price: price,
    shouldNotify,
    notifyReason,
    notified: shouldNotify && !!sc3Uid && !!sc3Sendkey
  };
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

async function getApps(env) {
  try {
    const apps = await env.KV.get("config:apps", "json") || [];
    return apps;
  } catch (error) {
    console.error("获取应用列表失败:", error);
    return [];
  }
}

async function appendHistory(env, entry) {
  try {
    let history = await env.KV.get("history", "json") || [];
    history.unshift(entry);
    if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
    await env.KV.put("history", JSON.stringify(history));
  } catch (error) {
    console.error("添加历史记录失败:", error);
  }
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}