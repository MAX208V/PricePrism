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
    // Old format: {[appId]: appData}
    const appsArray = Object.values(appsData).map(app => {
      // Ensure app has the correct structure
      if (!app.app_id && app.id) {
        // Fix field name if needed
        return {...app, app_id: app.id};
      }
      return app;
    });
    return appsArray;
  }
  
  // New format: array of apps
  if (Array.isArray(appsData)) {
    return appsData.map(app => {
      // Ensure app has the correct structure
      if (!app.app_id && app.id) {
        // Fix field name if needed
        return {...app, app_id: app.id};
      }
      return app;
    });
  }
  
  return [];
}

/**
 * Save apps to KV
 * @param {object} env - Cloudflare environment
 * @param {Array} apps - Apps to save
 * @returns {Promise<void>}
 */
export async function saveApps(env, apps) {
  // Convert to object format for backward compatibility
  const appsObj = {};
  apps.forEach(app => {
    // Ensure app has required fields
    const appWithDefaults = {
      id: app.id || crypto.randomUUID(),
      app_id: app.app_id || app.id,
      name: app.name || '',
      threshold: app.threshold || 0,
      country: app.country || 'us',
      note: app.note || '',
      monitor_mode: app.monitor_mode || 'threshold',
      created_at: app.created_at || Date.now(),
      updated_at: Date.now(),
      ...app
    };
    appsObj[appWithDefaults.app_id] = appWithDefaults;
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
  // Try to get status with new format
  let statusStr = await env.KV.get(`status:${appId}`);
  
  // If not found, try alternative keys that might exist in old format
  if (!statusStr) {
    statusStr = await env.KV.get(`status_${appId}`);
  }
  
  if (!statusStr) {
    return {};
  }
  
  try {
    const status = JSON.parse(statusStr);
    return status || {};
  } catch (e) {
    console.error('Failed to parse status for app:', appId, e);
    return {};
  }
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
  if (!historyStr) return [];
  
  try {
    const history = JSON.parse(historyStr);
    return Array.isArray(history) ? history : [];
  } catch (e) {
    console.error('Failed to parse history', e);
    return [];
  }
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