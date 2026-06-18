// ==================== 核心业务逻辑 ====================
import { DEFAULT_COUNTRY, parseDeveloper } from './utils.js';
import { fetchAppPrice, cacheIcon } from './storage.js';

// ── 全量监控入口（Cron & /api/check）──
export async function monitorAndNotify(env) {
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

// ── 单应用检查 ──
export async function checkApp(app, env) {
  const { PLAY_API, SC3_URL, DB, ICONS } = env;
  const { id, name, country, lang, threshold, monitor_mode, note, countries } = app;

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

  let notified = false, reason = null;

  // 价格监控
  if (monitor_mode !== "change" && !free && price > 0) {
    let effectiveThreshold = threshold;
    // 百分比阈值: threshold_pct% off from base_price
    if (app.threshold_type === 'percent' && app.base_price !== null && app.base_price !== undefined && app.base_price > 0) {
      effectiveThreshold = app.base_price * (1 - (app.threshold_pct || 20) / 100);
    }
    if (price < effectiveThreshold) {
      const last = app.last_notified_price;
      if (last !== undefined && last !== null && price < last) { notified = true; reason = "price_dropped"; }
    }
  } else if (monitor_mode === "change") {
    const bp = app.base_price;
    if (bp !== null && price !== bp) { notified = true; reason = "price_changed"; }
  }

  // 发送通知
  if (notified) {
    const title = name + (monitor_mode !== "change" ? " 降价啦！" : " 价格变动");
    let desp = free ? "**状态: 免费**\n\n" : `**价格: ${cur === 'USD' ? '$' : ''}${price} ${cur}**\n\n`;
    if (monitor_mode !== "change" && !free) {
      if (app.threshold_type === 'percent') desp += `已低于百分比阈值 ${app.threshold_pct || 20}% (基准价 $${app.base_price})\n\n`;
      else desp += `已低于阈值 $${threshold}\n\n`;
    }
    desp += `- 应用ID: \`${id}\`\n`;
    if (note) desp += `- 备注: ${note}\n`;
    desp += `[打开 Google Play](https://play.google.com/store/apps/details?id=${id})`;
    await sendSc3(SC3_URL, title, desp);
    await DB.prepare("UPDATE apps SET last_notified_price=?, last_notified_at=? WHERE id=?").bind(price, now, id).run();
    await DB.prepare("INSERT INTO notifications (app_id, name, price, threshold, type, notified, time) VALUES (?,?,?,?,?,?,?)").bind(id, name, price, threshold, 'price', 1, now).run();
  }

  // 更新 D1 apps 表最新状态
  const updates = [];
  const vals = [];
  const set = (f, v) => { updates.push(f + "=?"); vals.push(v); };
  set("last_price", price);
  set("last_free", free ? 1 : 0);
  set("last_currency", cur);
  set("last_price_text", mainPriceInfo.priceText || `$${price}`);
  if (icon) set("last_icon", icon);
  if (score) set("last_score", score);
  if (scoreText) set("last_score_text", scoreText);
  if (installs) set("last_installs", installs);
  set("last_developer", parseDeveloper(developer));
  set("last_contains_ads", mainPriceInfo.containsAds ? 1 : 0);
  set("last_prices_by_country", JSON.stringify(pricesByCountry));
  set("last_checked_at", now);
  // 如果未设基准价则设
  if (app.base_price === null || app.base_price === undefined) set("base_price", price);
  if (app.base_currency === null || app.base_currency === undefined) set("base_currency", cur);
  updates.push("updated_at=?");
  vals.push(now);
  vals.push(id);

  await DB.prepare("UPDATE apps SET " + updates.join(",") + " WHERE id=?").bind(...vals).run();

  return {
    app_id: id, name, ok: true, price, currency: cur, free, threshold,
    notified, reason,
    prices_by_country: pricesByCountry,
    icon, score, scoreText, installs
  };
}

// ── Server酱通知 ──
export async function sendSc3(url, title, desp) {
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, desp }) });
}
