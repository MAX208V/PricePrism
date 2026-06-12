// ==================== 配置区 ====================
const DEFAULT_COUNTRY = "us";
const DEFAULT_LANG = "en";
const DEFAULT_THRESHOLD = 6;
const DEFAULT_CURRENCY = "USD";
const SCRAPER_API_DEFAULT = "https://play-scraper-api.vercel.app/api/price";
const HISTORY_MAX = 50;

// ==================== 主入口 ====================
export default {
  async scheduled(event, env, ctx) {
    await monitorAndNotify(env);
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/apps") return handleAppsApi(request, env);
    if (path === "/check" || path === "/api/check") {
      const res = await monitorAndNotify(env);
      return jsonResponse(res);
    }
    if (path === "/api/history") return handleHistory(env);
    if (path === "/api/status") return handleStatus(env);
    if (path.startsWith("/api/")) return jsonResponse({ error: "Not found" }, 404);
    return handleDashboard(env);
  },
};

// ==================== API ====================
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
    if (!body.app_id || !body.name) return jsonResponse({ error: "app_id and name required" }, 400);
    const apps = await getApps(env);
    if (apps.find(a => a.id === body.app_id)) return jsonResponse({ error: "App already exists" }, 409);
    apps.push({ id: body.app_id, name: body.name, threshold: body.threshold ?? DEFAULT_THRESHOLD, country: body.country || DEFAULT_COUNTRY, lang: body.lang || DEFAULT_LANG, currency: DEFAULT_CURRENCY, created_at: new Date().toISOString() });
    await env.KV.put("config:apps", JSON.stringify(apps));
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
    for (const key in body) { if (key !== "app_id") apps[idx][key] = body[key]; }
    await env.KV.put("config:apps", JSON.stringify(apps));
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
}

async function handleHistory(env) {
  return jsonResponse(await env.KV.get("history", "json") || []);
}

async function handleStatus(env) {
  const apps = await getApps(env);
  const result = [];
  for (const app of apps) {
    const st = await env.KV.get("status:" + app.id, "json") || {};
    result.push({ ...app, status: st });
  }
  return jsonResponse(result);
}

async function monitorAndNotify(env) {
  const SCRAPER_API = env.SCRAPER_API || SCRAPER_API_DEFAULT;
  const SC3_UID = env.SC3_UID;
  const SC3_SENDKEY = env.SC3_SENDKEY;
  if (!SC3_UID || !SC3_SENDKEY) return { ok: false, error: "Missing SC3_UID or SC3_SENDKEY" };
  const apps = await getApps(env);
  if (!apps.length) return { ok: true, message: "No apps configured" };
  const results = [];
  for (const app of apps) {
    try { results.push(await checkApp(app, SCRAPER_API, SC3_UID, SC3_SENDKEY, env)); }
    catch (e) { results.push({ app_id: app.id, name: app.name, ok: false, error: e.message }); }
  }
  return { ok: true, results };
}

async function checkApp(app, scraperApi, sc3Uid, sc3Sendkey, env) {
  const { id, name, country, lang, threshold } = app;
  const priceInfo = await fetchPrice(scraperApi, id, country, lang);
  if (!priceInfo || !priceInfo.ok) return { app_id: id, name, ok: false, error: "fetch_price_failed" };
  const { price } = priceInfo;
  const cur = priceInfo.currency || "USD";
  const statusKey = "status:" + id;
  const status = await env.KV.get(statusKey, "json") || {};
  status.last_checked_price = price;
  status.last_checked_at = new Date().toISOString();
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
    status.last_notified_price = price;
    status.last_notified_at = new Date().toISOString();
    await appendHistory(env, { app_id: id, name, price, threshold, time: new Date().toISOString(), notified: true });
    await env.KV.put(statusKey, JSON.stringify(status));
    return { app_id: id, name, ok: true, price, currency: cur, threshold, notified: true, reason, sc3: nr };
  }
  await env.KV.put(statusKey, JSON.stringify(status));
  return { app_id: id, name, ok: true, price, currency: cur, threshold, notified: false, reason };
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

// ==================== Wise 管理面板 ====================
async function handleDashboard(env) {
  const apps = await getApps(env);
  const list = [];
  for (const app of apps) {
    const st = await env.KV.get("status:" + app.id, "json") || {};
    list.push({ ...app, status: st });
  }
  const history = await env.KV.get("history", "json") || [];
  return new Response(renderHtml(list, history, !!(env.SC3_UID && env.SC3_SENDKEY)), { headers: { "Content-Type": "text/html;charset=utf-8" } });
}

function renderHtml(apps, history, hasSc3) {
  let appCards = "";
  for (const a of apps) {
    const s = a.status || {};
    const p = s.last_checked_price;
    const priceStr = p !== undefined ? "$" + p : "—";
    const timeStr = s.last_checked_at ? new Date(s.last_checked_at).toLocaleString("zh-CN", { hour12: false }) : "—";
    const isLow = p !== undefined && p > 0 && p < a.threshold;
    const notifStr = s.last_notified_at ? new Date(s.last_notified_at).toLocaleString("zh-CN", { hour12: false }) : "—";
    appCards += '<div class="ac"><div class="ach"><div class="acn"><div class="act">' + esc(a.name) + '</div><div class="aci">' + esc(a.id) + '</div></div><span class="' + (isLow ? "bg" : "bg gy") + '">' + (isLow ? "低于阈值" : "正常") + '</span></div><div class="acb"><div class="g"><div class="gi"><div class="gl">当前价格</div><div class="v' + (isLow ? " gr" : "") + '">' + priceStr + '</div></div><div class="gi"><div class="gl">阈值</div><div class="v">$' + a.threshold + '</div></div><div class="gi"><div class="gl">检查</div><div class="v">' + timeStr + '</div></div><div class="gi"><div class="gl">通知</div><div class="v">' + notifStr + '</div></div></div><div class="ar"><button class="bs" onclick="editApp(\'' + esc(a.id) + "','" + esc(a.name) + "'," + a.threshold + ')"><span class="mat">edit</span></button><button class="bs br" onclick="removeApp(\'' + esc(a.id) + '\')"><span class="mat">delete</span></button></div></div></div>';
  }

  let historyRows = "";
  for (const h of history) {
    const ts = new Date(h.time).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
    historyRows += '<div class="hr"><span class="ht">' + ts + '</span><span class="hn">' + esc(h.name) + '</span><span class="hp">$' + h.price + '</span><span class="bg hb' + (h.notified ? "" : " gy") + '">' + (h.notified ? "已通知" : "跳过") + '</span></div>';
  }

  let cards = "";
  if (apps.length === 0) cards = '<div class="cd" style="text-align:center;padding:32px;color:var(--m);font-weight:500;font-size:14px">暂无监控应用，请在下方添加</div>';
  else cards = appCards;

  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><title>Price Monitor</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet"><link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet"><style>'
    + ":root{--p:#9fe870;--op:#0e0f0c;--pa:#cdffad;--pp:#e2f6d5;--k:#0e0f0c;--b:#454745;--m:#868685;--c:#fff;--s:#e8ebe6;--pos:#2ead4b;--neg:#d03238;--rx:24px;--rm:12px;--rp:9999px;--ss:8px;--sm:12px;--sl:16px;--f:'Inter',sans-serif}"
    + "*{margin:0;padding:0;box-sizing:border-box}"
    + "body{font-family:var(--f);font-size:16px;color:var(--k);background:var(--s);display:flex;justify-content:center;padding:var(--sl);min-height:100dvh;-webkit-font-smoothing:antialiased}"
    + ".wr{width:100%;max-width:480px;display:flex;flex-direction:column;gap:var(--sm);margin-top:var(--ss);padding-bottom:40px}"
    + "h1{font-size:28px;font-weight:900;letter-spacing:-.03em;line-height:1.1}"
    + ".sb{font-size:13px;color:var(--m);margin-top:2px;font-weight:500}"

    // Wise 品牌标识
    + ".brd{display:flex;align-items:center;gap:var(--sm);margin-bottom:4px}"
    + ".brd-i{width:36px;height:36px;background:var(--p);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--op);flex-shrink:0}"
    + ".brd-i .mat{font-size:20px}"

    // 应用卡片
    + ".ac{background:var(--c);border-radius:var(--rx);box-shadow:0 4px 24px rgba(14,15,12,.06);overflow:hidden}"
    + ".ach{display:flex;align-items:center;justify-content:space-between;padding:var(--sl) var(--sl) var(--ss)}"
    + ".acn{display:flex;flex-direction:column;gap:2px;min-width:0}"
    + ".act{font-size:17px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".aci{font-size:11px;color:var(--m);font-weight:500;word-break:break-all}"
    + ".acb{padding:0 var(--sl) var(--sl)}"
    + ".bg{display:inline-flex;align-items:center;padding:4px 12px;border-radius:var(--rp);font-size:11px;font-weight:700;white-space:nowrap;background:var(--pp);color:#163300}"
    + ".bg.gy{background:var(--s);color:var(--b)}"

    // 数据网格
    + ".g{display:grid;grid-template-columns:1fr 1fr;gap:var(--ss);margin-bottom:var(--sm)}"
    + ".gi{background:var(--s);border-radius:var(--rm);padding:14px}"
    + ".gl{font-size:9px;font-weight:700;text-transform:uppercase;color:var(--m);margin-bottom:2px;letter-spacing:.03em}"
    + ".v{font-size:14px;font-weight:600;color:var(--k);word-break:break-all;font-variant-numeric:tabular-nums}"
    + ".v.gr{color:var(--pos)}"

    // 操作按钮行（修复间距）
    + ".ar{display:flex;gap:var(--ss)}"
    + ".bs{display:inline-flex;align-items:center;justify-content:center;height:38px;width:38px;border-radius:var(--rp);font-family:var(--f);cursor:pointer;border:none;background:var(--s);color:var(--k)}"
    + ".bs:hover{background:var(--pp);color:#163300}"
    + ".bs .mat{font-size:18px}"
    + ".bs.br .mat{color:var(--neg)}"

    // 主按钮
    + ".bp{display:inline-flex;align-items:center;justify-content:center;height:46px;padding:var(--sm) var(--sxl);border-radius:var(--rp);font-family:var(--f);font-size:16px;font-weight:600;cursor:pointer;border:none;gap:6px;background:var(--p);color:var(--op);width:100%}"
    + ".bp:hover{background:var(--pa)}"

    // 输入框
    + ".in{width:100%;height:50px;background:var(--c);border:2px solid var(--k);border-radius:var(--rm);padding:0 var(--sl);font-family:var(--f);font-size:16px;color:var(--k);outline:none}"
    + ".in:focus{border-color:var(--p);box-shadow:0 0 0 3px rgba(159,232,112,.2)}"
    + ".lb{font-size:10px;font-weight:700;text-transform:uppercase;color:var(--b);margin-bottom:6px;display:flex;align-items:center;gap:2px;letter-spacing:.03em}"

    // 卡片容器
    + ".cd{background:var(--c);border-radius:var(--rx);box-shadow:0 4px 24px rgba(14,15,12,.06);padding:var(--sl)}"
    + ".sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--ss)}"
    + ".sh h2{font-size:18px;font-weight:700;letter-spacing:-.02em}"

    // 通知记录
    + ".hr{display:flex;align-items:center;gap:var(--ss);padding:10px 0;border-bottom:1px solid var(--s);font-size:13px}"
    + ".hr:last-child{border-bottom:none}"
    + ".ht{color:var(--m);font-weight:500;white-space:nowrap;min-width:52px;font-variant-numeric:tabular-nums}"
    + ".hn{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".hp{font-weight:700;font-variant-numeric:tabular-nums}"
    + ".hb{padding:2px 10px;font-size:10px}"

    // 其他
    + ".w{background:#fff3cd;color:#856404;border-radius:var(--rm);padding:var(--sm) var(--sl);font-size:13px;font-weight:500;display:flex;align-items:center;gap:6px}"
    + ".tt{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--k);color:var(--p);padding:8px 18px;border-radius:var(--rp);font-size:13px;z-index:10000;opacity:0;transition:opacity .2s;pointer-events:none;font-weight:500}"
    + ".tt.s{opacity:1}"
    + ".ft{text-align:center;padding:20px 0;font-size:12px;color:var(--m);font-weight:500}"
    + ".sh .bs{display:inline-flex;align-items:center;justify-content:center;height:34px;padding:6px var(--sl);border-radius:var(--rp);font-family:var(--f);font-size:12px;font-weight:600;cursor:pointer;border:none;gap:4px;background:var(--s);color:var(--k)}"
    + ".sh .bs:hover{background:var(--pp);color:#163300}"
    + ".sh .bs .mat{font-size:14px}"
    + ".mat{font-family:'Material Symbols Rounded';font-weight:400;font-style:normal;font-size:18px;display:inline-block;line-height:1;letter-spacing:normal;text-transform:none;white-space:nowrap;word-wrap:normal}"
    + '</style></head><body><div class="wr">'

    // Wise 品牌标识区域
    + '<div class="brd"><div class="brd-i"><span class="mat">monitoring</span></div><div><h1>Price Monitor</h1><div class="sb">极简 · 智能 · 省心</div></div></div>'

    + (!hasSc3 ? '<div class="w"><span class="mat" style="font-size:16px">warning</span> 未配置通知，请将 SC3_UID 和 SC3_SENDKEY 设为 Secrets</div>' : "")
    + '<div class="sh"><h2>监控应用</h2><button class="bs" onclick="checkAll()"><span class="mat">refresh</span>检查</button></div>'
    + cards

    // 添加应用表单
    + '<div class="cd"><h2 style="font-size:18px;font-weight:700;letter-spacing:-.02em;margin-bottom:var(--ss)">添加应用</h2>'
    + '<form id="af" onsubmit="addApp(event)"><div style="display:grid;gap:var(--ss)">'
    + '<div><div class="lb">Google Play ID</div><input class="in" name="app_id" placeholder="com.flyersoft.moonreaderp" required></div>'
    + '<div><div class="lb">显示名称</div><input class="in" name="name" placeholder="Moon+ Reader Pro" required></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--ss)"><div><div class="lb">降价阈值 (USD)</div><input class="in" name="threshold" type="number" step="0.01" value="6" required></div><div><div class="lb">地区</div><input class="in" name="country" value="us"></div></div></div>'
    + '<button type="submit" class="bp" style="margin-top:var(--sm)"><span class="mat" style="font-size:20px">add</span>添加监控</button></form></div>'

    // 通知记录
    + '<div class="cd"><div class="sh"><h2>通知记录</h2></div>' + (history.length ? '<div>' + historyRows + '</div>' : '<div style="text-align:center;padding:20px;color:var(--m);font-weight:500;font-size:14px">暂无记录</div>') + '</div>'
    + '<div class="ft">Cloudflare Workers · Wise Design</div></div>'
    + '<div id="tt" class="tt"></div>'
    + '<script>'
    + 'var tt=document.getElementById("tt"),ttm;function show(m){tt.textContent=m;tt.classList.add("s");clearTimeout(ttm);ttm=setTimeout(function(){tt.classList.remove("s")},2500)}'
    + 'async function api(p,o){var r=await fetch(p,Object.assign({},o,{headers:{"Content-Type":"application/json"}})),d=await r.json();if(!r.ok){show(d.error||"请求失败");throw new Error(d.error)}return d}'
    + 'function addApp(e){e.preventDefault();var f=new FormData(e.target);api("/api/apps",{method:"POST",body:JSON.stringify({app_id:f.get("app_id"),name:f.get("name"),threshold:parseFloat(f.get("threshold")),country:f.get("country")})}).then(function(){show("已添加");setTimeout(function(){location.reload()},800)})}'
    + 'function removeApp(id){if(!confirm("确认删除？"))return;api("/api/apps",{method:"DELETE",body:JSON.stringify({app_id:id})}).then(function(){show("已删除");setTimeout(function(){location.reload()},800)})}'
    + 'function editApp(id,n,t){var v=prompt(\'编辑 "\'+n+\'" 的阈值 (USD):\',t);if(v===null||v==="")return;var p=parseFloat(v);if(isNaN(p)||p<=0){show("无效数值");return}api("/api/apps",{method:"PATCH",body:JSON.stringify({app_id:id,threshold:p})}).then(function(){show("已更新");setTimeout(function(){location.reload()},800)})}'
    + 'function checkAll(){show("正在检查...");api("/api/check").then(function(){show("检查完成");setTimeout(function(){location.reload()},1500)})}'
    + '</script></body></html>';
}

function esc(s) {
  if (!s) return "";
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
