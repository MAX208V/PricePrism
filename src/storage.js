// ==================== 数据访问层 (D1 / R2) ====================
import { DEFAULT_COUNTRY } from './utils.js';

// ── Google Play API 调用 ──

export async function fetchAppInfo(env, appId, country = DEFAULT_COUNTRY) {
  const playApi = env.PLAY_API;
  if (!playApi) return null;
  const apiBase = playApi.startsWith('http') ? playApi : 'https://' + playApi;
  try {
    const resp = await fetch(`${apiBase}/api/apps/${encodeURIComponent(appId)}?country=${country}`, { headers: { Accept: "application/json" } });
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      title: data.title, icon: data.icon,
      developer: typeof data.developer === 'object' ? (data.developer.devId || data.developer.name || '') : (data.developer || ''),
      score: data.score, scoreText: data.scoreText,
      price: data.price, free: data.free, currency: data.currency
    };
  } catch (e) { return null; }
}

export async function fetchAppPrice(playApi, appId, country, lang) {
  try {
    const apiBase = playApi.startsWith('http') ? playApi : 'https://' + playApi;
    const resp = await fetch(`${apiBase}/api/apps/${encodeURIComponent(appId)}?country=${country}&lang=${lang}`, { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const data = await resp.json();
    return {
      ok: true, price: data.price || 0, currency: data.currency || "USD", free: data.free,
      offersIAP: data.offersIAP || data.inAppPurchases || false,
      IAPRange: (data.IAPRange || '').replace(/\s*per\s*item\s*$/i, ''),
      title: data.title, icon: data.icon,
      developer: typeof data.developer === 'object' ? (data.developer.devId || data.developer.name || '') : (data.developer || ''),
      score: data.score, scoreText: data.scoreText,
      installs: data.installs, containsAds: data.containsAds,
      priceText: data.priceText
    };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ── R2 图标缓存 ──

export async function cacheIcon(ICONS, appId, iconUrl) {
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

export async function getCachedIcon(ICONS, appId, fallbackUrl) {
  if (!ICONS) return fallbackUrl || "";
  try {
    const obj = await ICONS.get("icons/" + appId);
    if (obj) {
      const buf = await obj.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      return "data:" + (obj.httpMetadata?.contentType || "image/png") + ";base64," + b64;
    }
    const head = await ICONS.head("icons/" + appId);
    if (head?.customMetadata?.source) return head.customMetadata.source;
  } catch (e) {}
  return fallbackUrl || "";
}

// ── D1 查询 ──

export async function getApps(DB) {
  try {
    const r = await DB.prepare("SELECT * FROM apps ORDER BY created_at DESC").all();
    return r.results || [];
  } catch (e) { return []; }
}

export async function getNotifications(DB, limit = 50) {
  try {
    const r = await DB.prepare(
      "SELECT n.*, a.base_price as original_price FROM notifications n LEFT JOIN apps a ON n.app_id = a.id ORDER BY n.time DESC LIMIT ?"
    ).bind(limit).all();
    return r.results || [];
  } catch (e) { return []; }
}

export async function getPriceHistory(DB, appId, country, since) {
  try {
    const r = await DB.prepare(
      "SELECT price, free, currency, price_text, recorded_at FROM price_history WHERE app_id=? AND country=? AND recorded_at>=? ORDER BY recorded_at ASC"
    ).bind(appId, country, since).all();
    return r.results || [];
  } catch (e) { return []; }
}
