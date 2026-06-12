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
    if (path === "/api/check") {
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
  const method = request.method;
  if (method === "GET") {
    const apps = await getApps(env);
    const result = [];
    for (const app of apps) {
      const st = await env.KV.get(`status:${app.id}`, "json") || {};
      result.push({ ...app, status: st });
    }
    return jsonResponse(result);
  }
  if (method === "POST") {
    const body = await request.json();
    const { app_id, name, threshold, country, lang } = body;
    if (!app_id || !name) return jsonResponse({ error: "app_id and name required" }, 400);
    const apps = await getApps(env);
    if (apps.find(a => a.id === app_id)) return jsonResponse({ error: "App already exists" }, 409);
    apps.push({
      id: app_id, name,
      threshold: threshold ?? DEFAULT_THRESHOLD,
      country: country || DEFAULT_COUNTRY,
      lang: lang || DEFAULT_LANG,
      currency: DEFAULT_CURRENCY,
      created_at: new Date().toISOString(),
    });
    await env.KV.put("config:apps", JSON.stringify(apps));
    return jsonResponse({ ok: true });
  }
  if (method === "DELETE") {
    const body = await request.json();
    const { app_id } = body;
    if (!app_id) return jsonResponse({ error: "app_id required" }, 400);
    let apps = await getApps(env);
    apps = apps.filter(a => a.id !== app_id);
    await env.KV.put("config:apps", JSON.stringify(apps));
    await env.KV.delete(`status:${app_id}`);
    return jsonResponse({ ok: true });
  }
  if (method === "PATCH") {
    const body = await request.json();
    const { app_id, ...updates } = body;
    if (!app_id) return jsonResponse({ error: "app_id required" }, 400);
    let apps = await getApps(env);
    const idx = apps.findIndex(a => a.id === app_id);
    if (idx === -1) return jsonResponse({ error: "App not found" }, 404);
    apps[idx] = { ...apps[idx], ...updates };
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
    const st = await env.KV.get(`status:${app.id}`, "json") || {};
    result.push({ ...app, status: st });
  }
  return jsonResponse(result);
}

// ==================== 核心监控 ====================
async function monitorAndNotify(env) {
  const SCRAPER_API = env.SCRAPER_API || SCRAPER_API_DEFAULT;
  const SC3_UID = env.SC3_UID;
  const SC3_SENDKEY = env.SC3_SENDKEY;
  if (!SC3_UID || !SC3_SENDKEY) return { ok: false, error: "Missing SC3_UID or SC3_SENDKEY" };

  const apps = await getApps(env);
  if (!apps.length) return { ok: true, message: "No apps configured" };

  const results = [];
  for (const app of apps) {
    try {
      results.push(await checkApp(app, SCRAPER_API, SC3_UID, SC3_SENDKEY, env));
    } catch (e) {
      results.push({ app_id: app.id, name: app.name, ok: false, error: e.message });
    }
  }
  return { ok: true, results };
}

async function checkApp(app, scraperApi, sc3Uid, sc3Sendkey, env) {
  const { id, name, country, lang, threshold, currency } = app;
  const priceInfo = await fetchPrice(scraperApi, id, country, lang);
  if (!priceInfo || !priceInfo.ok) return { app_id: id, name, ok: false, error: "fetch_price_failed" };

  const { price } = priceInfo;
  const cur = priceInfo.currency || "USD";
  const statusKey = `status:${id}`;
  const status = await env.KV.get(statusKey, "json") || {};
  status.last_checked_price = price;
  status.last_checked_at = new Date().toISOString();

  const below = price > 0 && price < threshold && cur === "USD";
  let notified = false;
  let reason = null;

  if (below) {
    const last = status.last_notified_price;
    if (last === undefined || last === null) { notified = true; reason = "first_drop"; }
    else if (price < last) { notified = true; reason = "price_dropped"; }
    else if (price === last) { notified = false; reason = "price_unchanged"; }
    else { notified = false; reason = "price_rose"; }
  }

  if (notified) {
    const title = `${name} 降价啦！`;
    const desp = `**${price} ${cur}**，已低于阈值 ${threshold} ${cur}\n\n` +
      `应用ID：\`${id}\`\n时间：${new Date().toISOString()}\n\n` +
      `[打开 Google Play](https://play.google.com/store/apps/details?id=${id}&hl=${lang}&gl=${country})`;
    const nr = await sendSc3(sc3Uid, sc3Sendkey, title, desp);
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
  const resp = await fetch(`${api}?id=${appId}&country=${country}&lang=${lang}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`Vercel ${resp.status}`);
  return await resp.json();
}

async function sendSc3(uid, key, title, desp) {
  const resp = await fetch(`https://${uid}.push.ft07.com/send/${key}.send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, desp }),
  });
  return { status: resp.status, body: await resp.text() };
}

async function getApps(env) { return await env.KV.get("config:apps", "json") || []; }

async function appendHistory(env, entry) {
  let h = await env.KV.get("history", "json") || [];
  h.unshift(entry);
  if (h.length > HISTORY_MAX) h = h.slice(0, HISTORY_MAX);
  await env.KV.put("history", JSON.stringify(h));
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

// ==================== Wise 管理面板 ====================
async function handleDashboard(env) {
  const apps = await getApps(env);
  const list = [];
  for (const app of apps) {
    const st = await env.KV.get(`status:${app.id}`, "json") || {};
    list.push({ ...app, status: st });
  }
  const history = await env.KV.get("history", "json") || [];
  const hasSc3 = !!(env.SC3_UID && env.SC3_SENDKEY);

  return new Response(renderHtml(list, history, hasSc3), {
    headers: { "Content-Type": "text/html;charset=utf-8" },
  });
}

function renderHtml(apps, history, hasSc3) {
  const appCards = apps.map(a => {
    const s = a.status || {};
    const p = s.last_checked_price;
    const priceStr = p !== undefined ? `$${p}` : "—";
    const timeStr = s.last_checked_at ? new Date(s.last_checked_at).toLocaleString("zh-CN", { hour12: false }) : "—";
    const isLow = p !== undefined && p > 0 && p < a.threshold;
    const notifStr = s.last_notified_at ? new Date(s.last_notified_at).toLocaleString("zh-CN", { hour12: false }) : "—";

    return `<div class="card card-app" data-id="${a.id}">
      <div class="ca-h">
        <div class="ca-n">
          <span class="ca-t">${esc(a.name)}</span>
          <span class="ca-i">${esc(a.id)}</span>
        </div>
        <span class="ca-b ${isLow ? 'b-green' : 'b-gray'}">${isLow ? '低于阈值' : '正常'}</span>
      </div>
      <div class="ca-body">
        <div class="dg">
          <div class="di"><div class="dl">当前价格</div><div class="dv ${isLow ? 'c-green' : ''}">${priceStr}</div></div>
          <div class="di"><div class="dl">阈值</div><div class="dv">$${a.threshold}</div></div>
          <div class="di"><div class="dl">最近检查</div><div class="dv">${timeStr}</div></div>
          <div class="di"><div class="dl">最近通知</div><div class="dv">${notifStr}</div></div>
        </div>
        <div class="rw" style="margin-top:12px">
          <button class="btn-s btn-sm" onclick="editApp('${a.id}','${esc(a.name)}',${a.threshold})">⚙ 编辑</button>
          <button class="btn-s btn-sm" onclick="removeApp('${a.id}')" style="color:var(--neg)">🗑 删除</button>
        </div>
      </div>
    </div>`;
  }).join("");

  const historyRows = history.map(h =>
    `<div class="hr">
      <span class="hr-t">${new Date(h.time).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</span>
      <span class="hr-n">${esc(h.name)}</span>
      <span class="hr-p">$${h.price}</span>
      <span class="hr-badge ${h.notified ? 'b-green' : 'b-gray'}">${h.notified ? '已通知' : '跳过'}</span>
    </div>`
  ).join("");

  const noApps = apps.length === 0 ? `<div class="empty">暂无监控应用，请在下方添加</div>` : "";

  return `<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>Price Monitor</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<style>
:root{--p:#9fe870;--op:#0e0f0c;--pa:#cdffad;--pp:#e2f6d5;--k:#0e0f0c;--kd:#163300;--b:#454745;--m:#868685;--c:#fff;--s:#e8ebe6;--pos:#2ead4b;--neg:#d03238;--rs:8px;--rm:12px;--rx:24px;--rp:9999px;--sx:4px;--ss:8px;--sm:12px;--sl:16px;--sxl:24px;--f:'Inter',sans-serif}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--f);font-size:16px;color:var(--k);background:var(--s);min-height:100vh;display:flex;justify-content:center;padding:var(--sl)}
h1{font-size:28px;font-weight:900;letter-spacing:-.03em}
h2{font-size:18px;font-weight:700;letter-spacing:-.02em;margin-bottom:var(--ss)}
.sub{font-size:13px;color:var(--m);margin-bottom:14px}
.wrap{width:100%;max-width:480px;display:flex;flex-direction:column;gap:var(--sm);margin-top:var(--ss)}
.rw{display:flex;gap:var(--ss);flex-wrap:wrap}
.card{background:var(--c);border-radius:var(--rx);box-shadow:0 4px 24px rgba(14,15,12,.06);overflow:hidden;padding:var(--sl)}
.card-app{padding:0}
.ca-h{display:flex;align-items:center;justify-content:space-between;padding:var(--sl) var(--sl) var(--ss)}
.ca-n{display:flex;flex-direction:column;gap:2px}
.ca-t{font-size:17px;font-weight:700}
.ca-i{font-size:11px;color:var(--m);font-weight:500;word-break:break-all}
.ca-body{padding:0 var(--sl) var(--sl)}
.ca-b{display:inline-flex;align-items:center;padding:4px 12px;border-radius:var(--rp);font-size:11px;font-weight:700;white-space:nowrap}
.b-green{background:var(--pp);color:var(--kd)}
.b-gray{background:var(--s);color:var(--b)}
.c-green{color:var(--pos);font-weight:700}
.btn-p{display:inline-flex;align-items:center;justify-content:center;height:46px;padding:var(--sm) var(--sxl);border-radius:var(--rp);font-family:var(--f);font-size:16px;font-weight:600;cursor:pointer;border:none;gap:var(--sx);background:var(--p);color:var(--op);width:100%}
.btn-p:hover{background:var(--pa)}
.btn-s{display:inline-flex;align-items:center;justify-content:center;height:38px;padding:var(--sx) var(--sl);border-radius:var(--rp);font-family:var(--f);font-size:13px;font-weight:600;cursor:pointer;border:none;gap:var(--sx);background:var(--s);color:var(--k)}
.btn-s:hover{background:var(--pp);color:var(--kd)}
.btn-sm{height:34px;padding:var(--sx) var(--sm);font-size:12px}
.inp{width:100%;height:50px;background:var(--c);border:2px solid var(--k);border-radius:var(--rm);padding:0 var(--sl);font-family:var(--f);font-size:16px;color:var(--k);outline:none}
.inp:focus{border-color:var(--p);box-shadow:0 0 0 3px rgba(159,232,112,.2)}
.lbl{font-size:10px;font-weight:700;text-transform:uppercase;color:var(--b);margin-bottom:var(--sx);display:flex;align-items:center;gap:2px}
.dg{display:grid;grid-template-columns:1fr 1fr;gap:var(--ss)}
.di{background:var(--s);border-radius:var(--rm);padding:14px}
.dl{font-size:9px;font-weight:700;text-transform:uppercase;color:var(--b);margin-bottom:2px}
.dv{font-size:14px;font-weight:600;color:var(--k);word-break:break-all}
.empty{text-align:center;padding:40px 20px;color:var(--m);font-size:14px;font-weight:500}
.toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--k);color:var(--p);padding:8px 18px;border-radius:var(--rp);font-size:13px;z-index:10000;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.s{opacity:1}
.sp{width:26px;height:26px;border:3px solid var(--pp);border-top-color:var(--p);border-radius:50%;animation:spin 1s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
.hr{display:flex;align-items:center;gap:var(--ss);padding:10px 0;border-bottom:1px solid var(--s);font-size:13px}
.hr:last-child{border-bottom:none}
.hr-t{color:var(--m);font-weight:500;white-space:nowrap;min-width:52px}
.hr-n{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hr-p{font-weight:700;font-variant-numeric:tabular-nums}
.hr-badge{padding:2px 10px;border-radius:var(--rp);font-size:10px;font-weight:700;white-space:nowrap}
.section{margin-top:var(--sm)}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--ss)}
.section-header .sub{margin-bottom:0}
.warn{background:#fff3cd;color:#856404;border-radius:var(--rm);padding:var(--sm) var(--sl);font-size:13px;font-weight:500}
.warn a{color:var(--k)}
</style></head><body>
<div class="wrap">
  <div>
    <h1>📱 Price Monitor</h1>
    <div class="sub">极简 · 智能 · 省心</div>
  </div>

  ${!hasSc3 ? `<div class="warn">⚠️ 未配置 Server酱³ 通知，请在 Cloudflare Dashboard 中将 SC3_UID 和 SC3_SENDKEY 设为 Secrets。</div>` : ""}

  <div class="section">
    <div class="section-header">
      <h2>监控应用</h2>
      <button class="btn-s btn-sm" onclick="checkAll()">⏱ 立即检查</button>
    </div>
    ${noApps}
    <div class="rw">${appCards}</div>
  </div>

  <div class="card">
    <h2>➕ 添加应用</h2>
    <form id="addForm" onsubmit="addApp(event)">
      <div style="display:grid;gap:var(--ss)">
        <div><div class="lbl">Google Play App ID</div><input class="inp" name="app_id" placeholder="com.flyersoft.moonreaderp" required></div>
        <div><div class="lbl">显示名称</div><input class="inp" name="name" placeholder="Moon+ Reader Pro" required></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--ss)">
          <div><div class="lbl">降价阈值 (USD)</div><input class="inp" name="threshold" type="number" step="0.01" value="6" required></div>
          <div><div class="lbl">地区</div><input class="inp" name="country" value="us" placeholder="us"></div>
        </div>
      </div>
      <button type="submit" class="btn-p" style="margin-top:var(--sm)">➕ 添加监控</button>
    </form>
  </div>

  <div class="card">
    <div class="section-header">
      <h2>📋 通知记录</h2>
    </div>
    ${history.length ? `<div>${historyRows}</div>` : `<div class="empty">暂无通知记录</div>`}
  </div>

  <div style="text-align:center;padding:20px 0;font-size:12px;color:var(--m)">
    Powered by Cloudflare Workers · Wise Design
  </div>
</div>

<div id="toast" class="toast"></div>

<script>
const toast = document.getElementById("toast");
let toTimer;

function show(msg) {
  toast.textContent = msg;
  toast.classList.add("s");
  clearTimeout(toTimer);
  toTimer = setTimeout(() => toast.classList.remove("s"), 2500);
}

async function api(path, opts) {
  const resp = await fetch(path, { ...opts, headers: { "Content-Type": "application/json" } });
  const data = await resp.json();
  if (!resp.ok) { show(data.error || "请求失败"); throw new Error(data.error); }
  return data;
}

async function addApp(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = { app_id: fd.get("app_id"), name: fd.get("name"), threshold: parseFloat(fd.get("threshold")), country: fd.get("country") };
  await api("/api/apps", { method: "POST", body: JSON.stringify(body) });
  show("✅ 添加成功");
  setTimeout(() => location.reload(), 800);
}

async function removeApp(id) {
  if (!confirm("确认删除此应用？")) return;
  await api("/api/apps", { method: "DELETE", body: JSON.stringify({ app_id: id }) });
  show("🗑 已删除");
  setTimeout(() => location.reload(), 800);
}

async function editApp(id, name, threshold) {
  const newT = prompt(\`编辑 "\${name}" 的降价阈值 (USD):\`, threshold);
  if (newT === null || newT === "") return;
  const t = parseFloat(newT);
  if (isNaN(t) || t <= 0) { show("请输入有效数值"); return; }
  await api("/api/apps", { method: "PATCH", body: JSON.stringify({ app_id: id, threshold: t }) });
  show("✅ 已更新");
  setTimeout(() => location.reload(), 800);
}

async function checkAll() {
  show("⏱ 正在检查...");
  await api("/api/check");
  show("✅ 检查完成");
  setTimeout(() => location.reload(), 1500);
}
<\/script>
</body></html>`;
}

function esc(s) {
  if (!s) return "";
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
