/**
 * Repository for interacting with Cloudflare KV storage
 */

/**
 * Get all apps from KV
 * @param {object} env - Cloudflare environment
 * @returns {Promise<Array>} Array of apps
 */
export async function getApps(env) {
  const appsStr = await env.KV.get("apps");
  return appsStr ? JSON.parse(appsStr) : [];
}

/**
 * Save apps to KV
 * @param {object} env - Cloudflare environment
 * @param {Array} apps - Apps to save
 * @returns {Promise<void>}
 */
export async function saveApps(env, apps) {
  await env.KV.put("apps", JSON.stringify(apps));
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