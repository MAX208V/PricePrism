/**
 * Repository for interacting with Cloudflare KV storage
 */

/**
 * Get all apps from KV
 * @param {object} env - Cloudflare environment
 * @returns {Promise<Array>} Array of apps
 */
export async function getApps(env) {
  const appsData = await env.KV.get("apps", "json");
  if (!appsData) return [];
  
  // Convert object format to array format if needed
  if (typeof appsData === 'object' && !Array.isArray(appsData)) {
    return Object.values(appsData);
  }
  
  return Array.isArray(appsData) ? appsData : [];
}

/**
 * Save apps to KV
 * @param {object} env - Cloudflare environment
 * @param {Array} apps - Apps to save
 * @returns {Promise<void>}
 */
export async function saveApps(env, apps) {
  // Convert array back to object format for backward compatibility
  const appsObj = {};
  apps.forEach(app => {
    appsObj[app.app_id] = app;
  });
  await env.KV.put("apps", JSON.stringify(appsObj));
}

/**
 * Get status for an app from KV
 * @param {object} env - Cloudflare environment
 * @param {string} appId - App ID
 * @returns {Promise<Object>} App status
 */
export async function getStatus(env, appId) {
  const statusStr = await env.KV.get(`status:${appId}`);
  return statusStr ? JSON.parse(statusStr) : {};
}

/**
 * Save status for an app to KV
 * @param {object} env - Cloudflare environment
 * @param {string} appId - App ID
 * @param {object} status - Status to save
 * @returns {Promise<void>}
 */
export async function saveStatus(env, appId, status) {
  await env.KV.put(`status:${appId}`, JSON.stringify(status));
}

/**
 * Get history from KV
 * @param {object} env - Cloudflare environment
 * @returns {Promise<Array>} History entries
 */
export async function getHistory(env) {
  const historyStr = await env.KV.get("history");
  return historyStr ? JSON.parse(historyStr) : [];
}

/**
 * Append entry to history in KV
 * @param {object} env - Cloudflare environment
 * @param {object} entry - History entry to append
 * @returns {Promise<void>}
 */
export async function appendHistory(env, entry) {
  const history = await getHistory(env);
  history.push(entry);
  // Keep only last 100 entries
  if (history.length > 100) {
    history.splice(0, history.length - 100);
  }
  await env.KV.put("history", JSON.stringify(history));
}