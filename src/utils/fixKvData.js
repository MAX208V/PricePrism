/**
 * Utility script to fix KV data inconsistencies
 */

/**
 * Fix missing status data for apps
 * @param {object} env - Cloudflare environment
 * @returns {Promise<void>}
 */
export async function fixMissingStatusData(env) {
  try {
    // Get all apps
    const appsData = await env.KV.get("apps", "json");
    if (!appsData) {
      console.log("No apps data found");
      return;
    }
    
    // Convert to array if it's an object
    const apps = Array.isArray(appsData) ? appsData : Object.values(appsData);
    
    console.log(`Found ${apps.length} apps to check`);
    
    // Check each app for missing status
    for (const app of apps) {
      const appId = app.appId || app.app_id || app.id;
      if (!appId) continue;
      
      // Check if status exists
      const statusKey = `status:${appId}`;
      const statusExists = await env.KV.get(statusKey);
      
      if (!statusExists) {
        console.log(`Fixing missing status for ${appId}`);
        
        // Create a minimal status object
        const defaultStatus = {
          last_checked_at: new Date().toISOString(),
          last_checked_price: app.threshold || 0
        };
        
        // Save the default status
        await env.KV.put(statusKey, JSON.stringify(defaultStatus));
        console.log(`Created default status for ${appId}`);
      }
    }
    
    console.log("Finished fixing missing status data");
  } catch (error) {
    console.error("Error fixing KV data:", error);
  }
}

/**
 * Clear error entries from history
 * @param {object} env - Cloudflare environment
 * @returns {Promise<void>}
 */
export async function clearErrorHistory(env) {
  try {
    const historyStr = await env.KV.get("history");
    if (!historyStr) {
      console.log("No history data found");
      return;
    }
    
    const history = JSON.parse(historyStr);
    if (!Array.isArray(history)) {
      console.log("History is not an array");
      return;
    }
    
    // Filter out error entries
    const cleanHistory = history.filter(entry => !entry.error);
    
    console.log(`Removed ${history.length - cleanHistory.length} error entries from history`);
    
    // Save cleaned history
    await env.KV.put("history", JSON.stringify(cleanHistory));
    
    console.log("Finished cleaning history");
  } catch (error) {
    console.error("Error cleaning history:", error);
  }
}

/**
 * Reinitialize all app statuses with current data
 * @param {object} env - Cloudflare environment
 * @returns {Promise<void>}
 */
export async function reinitializeAppStatuses(env) {
  try {
    // Only run if SCRAPER_API is configured
    if (!env.SCRAPER_API) {
      console.log("SCRAPER_API not configured, skipping reinitialization");
      return;
    }
    
    const appsData = await env.KV.get("apps", "json");
    if (!appsData) {
      console.log("No apps data found");
      return;
    }
    
    // Convert to array if it's an object
    const apps = Array.isArray(appsData) ? appsData : Object.values(appsData);
    
    console.log(`Reinitializing status for ${apps.length} apps`);
    
    // Reinitialize each app
    for (const app of apps) {
      const appId = app.appId || app.app_id || app.id;
      if (!appId) continue;
      
      try {
        // Fetch current app info
        const response = await fetch(
          `${env.SCRAPER_API}/api/price?id=${encodeURIComponent(appId)}&country=${encodeURIComponent(app.country || 'us')}&lang=en`
        );
        
        if (response.ok) {
          const appInfo = await response.json();
          
          // Create status object
          const status = {
            icon: appInfo.icon || '',
            developer: appInfo.developer || '',
            scoreText: appInfo.scoreText || '',
            ratings: appInfo.ratings || '',
            last_checked_price: appInfo.price || 0,
            last_checked_at: new Date().toISOString()
          };
          
          // Save status
          await env.KV.put(`status:${appId}`, JSON.stringify(status));
          console.log(`Reinitialized status for ${appId}`);
        } else {
          console.log(`Failed to fetch info for ${appId}: ${response.status}`);
        }
      } catch (error) {
        console.error(`Error reinitializing ${appId}:`, error.message);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log("Finished reinitializing app statuses");
  } catch (error) {
    console.error("Error reinitializing app statuses:", error);
  }
}