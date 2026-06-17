/**
 * Controller for handling monitoring-related API requests
 */

import { getApps, getStatus, saveStatus, getHistory, appendHistory } from '../repositories/kvRepository.js';
import { fetchAppInfo, fetchPrice } from '../services/scraperService.js';
import { sendSc3 } from '../services/notifyService.js';
import { fmtUTC } from '../utils/helpers.js';

/**
 * Handle GET /api/status - Get status of all apps
 * @param {object} env - Cloudflare environment
 * @returns {Response} JSON response with app statuses
 */
export async function handleGetStatus(env) {
  const apps = await getApps(env);
  const statuses = await Promise.all(
    apps.map(async (app) => {
      const status = await getStatus(env, app.app_id);
      return { app_id: app.app_id, status };
    })
  );
  return new Response(JSON.stringify(statuses), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle POST /api/check - Check all apps for price changes
 * @param {object} env - Cloudflare environment
 * @returns {Response} JSON response indicating success or failure
 */
export async function handleCheckAll(env) {
  try {
    await runScheduledCheck(env);
    return new Response(JSON.stringify({ message: 'Check completed' }));
  } catch (error) {
    console.error('Error during manual check:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}

/**
 * Handle GET /api/history - Get notification history
 * @param {object} env - Cloudflare environment
 * @returns {Response} JSON response with history entries
 */
export async function handleGetHistory(env) {
  const history = await getHistory(env);
  return new Response(JSON.stringify(history), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Run scheduled check for all apps
 * @param {object} env - Cloudflare environment
 * @returns {Promise<void>}
 */
export async function runScheduledCheck(env) {
  const now = new Date().toISOString();
  const apps = await getApps(env);
  
  for (const app of apps) {
    try {
      // Fetch current price and app info
      const [price, appInfo] = await Promise.all([
        fetchPrice(env, app.app_id, app.country),
        fetchAppInfo(env, app.app_id, app.country)
      ]);
      
      const status = await getStatus(env, app.app_id);
      
      // Update status with latest info
      const updatedStatus = {
        ...status,
        icon: appInfo.icon,
        developer: appInfo.developer,
        scoreText: appInfo.scoreText,
        ratings: appInfo.ratings,
        last_checked_price: price,
        last_checked_at: now
      };
      
      await saveStatus(env, app.app_id, updatedStatus);
      
      // Check if notification should be sent
      let shouldNotify = false;
      const historyEntry = {
        time: now,
        name: app.name || app.app_id,
        price: price,
        notified: false
      };
      
      if (app.monitor_mode === 'change') {
        // Notify on any price change
        if (status.last_checked_price !== undefined && status.last_checked_price !== price) {
          shouldNotify = true;
        }
      } else {
        // Default threshold mode - notify when below threshold
        if (price > 0 && price < app.threshold) {
          shouldNotify = true;
        }
      }
      
      if (shouldNotify) {
        updatedStatus.last_notified_at = now;
        await saveStatus(env, app.app_id, updatedStatus);
        
        historyEntry.notified = true;
        
        // Send notification via ServerChan
        const title = `价格变动提醒: ${app.name || app.app_id}`;
        const content = `应用 "${app.name || app.app_id}" 当前价格为 \$${price}，已低于设定阈值 \$${app.threshold}。\n\n检查时间: ${fmtUTC(now)}`;
        await sendSc3(env, title, content);
      }
      
      // Add entry to history
      await appendHistory(env, historyEntry);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error checking app ${app.app_id}:`, error);
      // Add failed entry to history
      await appendHistory(env, {
        time: now,
        name: app.name || app.app_id,
        price: 0,
        notified: false,
        error: error.message
      });
    }
  }
}