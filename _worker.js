// ==================== 配置区 ====================
const DEFAULT_COUNTRY = "us";
const DEFAULT_LANG = "en";
const DEFAULT_THRESHOLD = 6;
const DEFAULT_CURRENCY = "USD";
const HISTORY_MAX = 50;

// ==================== 主入口 ====================
export default {
  async scheduled(event, env, ctx) {
    await monitorAndNotify(env);
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API 端点
    if (path === "/api/dashboard") return handleDashboard(env);
    if (path === "/api/apps") return handleAppsApi(request, env);
    if (path === "/api/check") return handleCheck(env);
    if (path === "/api/history") return handleHistory(env);
    if (path === "/api/status") return handleStatus(env);
    if (path === "/api/search") return handleSearch(request, env);
    if (path.startsWith("/api/")) return jsonResponse({ error: "Not found" }, 404);

    // 静态资源由 Cloudflare Assets 处理
    const response = await env.ASSETS.fetch(request);
    if (response.status === 404) {
      return env.ASSETS.fetch(new URL('/index.html', url.origin));
    }
    return response;
  },
};

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
    
    // 如果没有提供 name，尝试从 API 获取
    let name = body.name;
    let icon = null;
    if (!name || name.trim() === "") {
      try {
        const appInfo = await fetchAppInfo(env, body.app_id, body.country || DEFAULT_COUNTRY);
        if (appInfo) {
          name = appInfo.title || body.app_id;
          icon = appInfo.icon;
        }
      } catch (e) {
        name = body.app_id;
      }
    }
    
    apps.push({
      id: body.app_id,
      name: name || body.app_id,
      threshold: body.threshold ?? DEFAULT_THRESHOLD,
      country: body.country || DEFAULT_COUNTRY,
      lang: body.lang || DEFAULT_LANG,
      currency: DEFAULT_CURRENCY,
      note: body.note || "",
      monitor_mode: body.monitor_mode || "threshold",
      created_at: new Date().toISOString()
    });
    
    await env.KV.put("config:apps", JSON.stringify(apps));
    
    // 创建或更新状态 KV
    const statusKey = "status:" + body.app_id;
    const status = await env.KV.get(statusKey, "json") || {};
    if (icon) status.icon = icon;
    if (name) status.title = name;
    status.last_checked_at = null;
    status.last_checked_price = null;
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
    
    await env.KV.put("config:apps", JSON.stringify(apps));
    return jsonResponse({ ok: true });
  }
  
  return jsonResponse({ error: "Method not allowed" }, 405);
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
// 使用 Google Play API 搜索
// GET /api/search?term=xxx
async function handleSearch(request, env) {
  const url = new URL(request.url);
  const term = url.searchParams.get("term");
  
  if (!term) return jsonResponse({ error: "term required" }, 400);
  
  const playApi = env.PLAY_API;
  if (!playApi) return jsonResponse({ error: "PLAY_API not configured" }, 400);
  
  try {
    // Google Play API 搜索格式: GET /api/apps/?q=xxx
    const resp = await fetch(`${playApi}/api/apps/?q=${encodeURIComponent(term)}&country=us&lang=en`, {
      headers: { Accept: "application/json" }
    });
    
    if (!resp.ok) {
      return jsonResponse({ error: `API error: ${resp.status}` }, 500);
    }
    
    const data = await resp.json();
    
    // 转换为前端期望的格式
    const results = (data.results || []).map(app => ({
      appId: app.appId,
      title: app.title,
      icon: app.icon,
      developer: typeof app.developer === 'object' && app.developer !== null ? app.developer.devId || app.developer.name || String(app.developer) : (app.developer || ''),
      developerUrl: typeof app.developer === 'object' && app.developer !== null ? app.developer.url : '',
      score: app.score,
      scoreText: app.scoreText,
      price: app.price,
      free: app.free,
      currency: app.currency,
      containsAds: app.containsAds,
      offersIAP: app.offersIAP || app.inAppPurchases
    }));
    
    return jsonResponse({ ok: true, results });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

// ==================== 获取应用详情 ====================
// 使用 Google Play API: GET /api/apps/{appId}
async function fetchAppInfo(env, appId, country = DEFAULT_COUNTRY) {
  const playApi = env.PLAY_API;
  if (!playApi) return null;
  
  try {
    const resp = await fetch(`${playApi}/api/apps/${encodeURIComponent(appId)}?country=${country}`, {
      headers: { Accept: "application/json" }
    });
    
    if (!resp.ok) return null;
    
    const data = await resp.json();
    return {
      title: data.title,
      icon: data.icon,
      developer: data.developer,
      score: data.score,
      scoreText: data.scoreText,
      price: data.price,
      free: data.free,
      currency: data.currency
    };
  } catch (e) {
    return null;
  }
}

// ==================== 获取应用价格 ====================
// 使用 Google Play API: GET /api/apps/{appId}
async function fetchAppPrice(playApi, appId, country, lang) {
  try {
    const resp = await fetch(
      `${playApi}/api/apps/${encodeURIComponent(appId)}?country=${country}&lang=${lang}`,
      { headers: { Accept: "application/json" } }
    );
    
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    
    const data = await resp.json();
    return {
      ok: true,
      price: data.price || 0,
      currency: data.currency || "USD",
      free: data.free,
      offersIAP: data.offersIAP || data.inAppPurchases || false,
      title: data.title,
      icon: data.icon,
      developer: data.developer,
      score: data.score,
      scoreText: data.scoreText,
      installs: data.installs,
      containsAds: data.containsAds
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ==================== Monitor & Notify ====================
async function monitorAndNotify(env) {
  const playApi = env.PLAY_API;
  const sc3Url = env.SC3_URL;
  
  if (!playApi) {
    return { ok: false, error: "Missing PLAY_API environment variable" };
  }
  
  if (!sc3Url) {
    return { ok: false, error: "Missing SC3_URL environment variable" };
  }
  
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

async function checkApp(app, playApi, env, sc3Url) {
  const { id, name, country, lang, threshold, monitor_mode, note } = app;
  
  const priceInfo = await fetchAppPrice(playApi, id, country, lang);
  if (!priceInfo || !priceInfo.ok) {
    return { app_id: id, name, ok: false, error: priceInfo?.error || "fetch_failed" };
  }
  
  const price = priceInfo.price;
  const cur = priceInfo.currency || "USD";
  const free = priceInfo.free;
  const icon = priceInfo.icon;
  const score = priceInfo.score;
  const scoreText = priceInfo.scoreText;
  const installs = priceInfo.installs;
  const developer = priceInfo.developer;
  
  const statusKey = "status:" + id;
  const status = await env.KV.get(statusKey, "json") || {};
  
  status.last_checked_price = price;
  status.last_checked_at = new Date().toISOString();
  status.last_checked_free = free;
  status.offersIAP = priceInfo.offersIAP;
  status.containsAds = priceInfo.containsAds;
  status.icon = icon || status.icon;
  status.score = score || status.score;
  status.scoreText = scoreText || status.scoreText;
  status.installs = installs || status.installs;
  status.developer = developer || status.developer;
  
  let notified = false;
  let reason = null;
  
  // 阈值模式：价格低于阈值时通知（仅对付费应用）
  if (monitor_mode !== "change" && !free && price > 0) {
    const below = price < threshold;
    
    if (below) {
      const last = status.last_notified_price;
      if (last === undefined || last === null) {
        notified = true;
        reason = "first_drop";
      } else if (price < last) {
        notified = true;
        reason = "price_dropped";
      } else if (price === last) {
        notified = false;
        reason = "price_unchanged";
      } else {
        notified = false;
        reason = "price_rose";
      }
    }
  } else if (monitor_mode === "change") {
    // 变动模式：任何价格变动都通知
    const lastPrice = status.last_checked_price;
    const lastFree = status.last_checked_free;
    
    // 价格变动（免费↔付费 或 价格数值变化）
    if (lastPrice !== undefined && (price !== lastPrice || free !== lastFree)) {
      notified = true;
      reason = "price_changed";
      
      if (status.initial_price === undefined && !free) {
        status.initial_price = price;
      }
    }
  }
  
  if (notified) {
    const title = monitor_mode !== "change" 
      ? `${name} 降价啦！` 
      : `${name} 价格变动`;
    
    let desp = free 
      ? `**状态: 免费**\n\n`
      : `**价格: ${cur === 'USD' ? '$' : ''}${price} ${cur}**\n\n`;
    
    if (monitor_mode !== "change" && !free) {
      desp += `已低于阈值 ${cur === 'USD' ? '$' : ''}${threshold} ${cur}\n\n`;
    } else if (status.initial_price !== undefined && !free) {
      desp += `原价: ${cur === 'USD' ? '$' : ''}${status.initial_price} ${cur}\n\n`;
    }
    
    desp += `- 应用ID: \`${id}\`\n`;
    if (note) desp += `- 备注: ${note}\n`;
    desp += `- 时间: ${new Date().toISOString()}\n\n`;
    desp += `[打开 Google Play](https://play.google.com/store/apps/details?id=${id})`;
    
    await sendSc3(sc3Url, title, desp);
    
    status.last_notified_price = price;
    status.last_notified_at = new Date().toISOString();
    
    await appendHistory(env, {
      app_id: id,
      name,
      price,
      threshold,
      time: new Date().toISOString(),
      notified: true
    });
    
    await env.KV.put(statusKey, JSON.stringify(status));
    
    return {
      app_id: id,
      name,
      ok: true,
      price,
      currency: cur,
      free,
      threshold,
      notified: true,
      reason,
      icon,
      score,
      scoreText,
      installs
    };
  }
  
  await env.KV.put(statusKey, JSON.stringify(status));
  
  return {
    app_id: id,
    name,
    ok: true,
    price,
    currency: cur,
    free,
    threshold,
    notified: false,
    reason,
    icon,
    score,
    scoreText,
    installs
  };
}

async function sendSc3(url, title, desp) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, desp })
  });
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
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
