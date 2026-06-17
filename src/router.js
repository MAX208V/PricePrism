/**
 * Router for handling API requests
 */

import { handleGetApps, handleAddApp, handleEditApp, handleRemoveApp, handleFixKvData } from './controllers/appController.js';
import { handleGetStatus, handleCheckAll, handleGetHistory, runScheduledCheck } from './controllers/monitorController.js';
import { handleSearch } from './controllers/searchController.js';

/**
 * Route incoming requests to appropriate handlers
 * @param {Request} request - The incoming request
 * @param {object} env - Cloudflare environment
 * @param {object} ctx - Context object
 * @returns {Response|undefined} Response if matched, undefined otherwise
 */
export async function routeRequest(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Handle preflight OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  // Route API requests
  if (pathname.startsWith('/api/')) {
    switch (pathname) {
      // App management endpoints
      case '/api/apps':
        switch (request.method) {
          case 'GET':
            return await handleGetApps(env);
          case 'POST':
            return await handleAddApp(request, env);
          case 'PATCH':
            return await handleEditApp(request, env);
          case 'DELETE':
            return await handleRemoveApp(request, env);
          default:
            return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
        }

      // App fix endpoint
      case '/api/apps/fix':
        if (request.method === 'POST') {
          return await handleFixKvData(env);
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
        
      // Data migration endpoint
      case '/api/migrate':
        if (request.method === 'POST') {
          return await handleMigrateData(env);
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

      // Monitoring endpoints
      case '/api/status':
        if (request.method === 'GET') {
          return await handleGetStatus(env);
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

      case '/api/check':
        if (request.method === 'POST') {
          return await handleCheckAll(env);
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

      case '/api/history':
        if (request.method === 'GET') {
          return await handleGetHistory(env);
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

      // Search endpoint
      case '/api/search':
        if (request.method === 'GET') {
          return await handleSearch(request, env);
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

      default:
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }
  }

  // Not an API route - return undefined to indicate static asset handling should take over
  return undefined;
}

/**
 * Handle data migration request
 * @param {object} env - Cloudflare environment
 * @returns {Response} Migration result
 */
async function handleMigrateData(env) {
  try {
    console.log("Starting data migration...");
    
    // Read both old and new format data
    const newAppsDataRaw = await env.KV.get("apps");
    const oldAppsDataRaw = await env.KV.get("config:apps");
    
    console.log("Raw new apps data:", newAppsDataRaw);
    console.log("Raw old apps data:", oldAppsDataRaw);
    
    let newAppsData = [];
    let oldAppsData = [];
    
    try {
      newAppsData = newAppsDataRaw ? JSON.parse(newAppsDataRaw) : [];
    } catch (e) {
      console.error("Failed to parse new apps data:", e);
      newAppsData = [];
    }
    
    try {
      oldAppsData = oldAppsDataRaw ? JSON.parse(oldAppsDataRaw) : [];
    } catch (e) {
      console.error("Failed to parse old apps data:", e);
      oldAppsData = [];
    }
    
    console.log("Parsed new apps:", newAppsData);
    console.log("Parsed old apps:", oldAppsData);
    
    // Merge app data (avoid duplicates)
    const appIdSet = new Set(newAppsData.map(app => app.appId || app.id));
    const mergedApps = [...newAppsData];
    
    let migratedCount = 0;
    for (const oldApp of oldAppsData) {
      const appId = oldApp.appId || oldApp.id;
      if (appId && !appIdSet.has(appId)) {
        // Convert old format to new format
        mergedApps.push({
          id: crypto.randomUUID(),
          appId: appId,
          name: oldApp.name || appId,
          threshold: oldApp.threshold || 0,
          country: oldApp.country || 'us',
          note: oldApp.note || '',
          monitor_mode: oldApp.monitor_mode || 'threshold',
          created_at: typeof oldApp.created_at === 'string' ? new Date(oldApp.created_at).getTime() : (oldApp.created_at || Date.now()),
          updated_at: Date.now()
        });
        migratedCount++;
        appIdSet.add(appId);
      }
    }
    
    console.log("Merged apps:", mergedApps);
    
    // Save merged data
    await env.KV.put("apps", JSON.stringify(mergedApps));
    
    // Remove old config:apps key if it existed
    if (oldAppsDataRaw) {
      await env.KV.delete("config:apps");
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Migrated ${migratedCount} apps from old format`,
      totalApps: mergedApps.length,
      migratedApps: mergedApps.map(app => ({ appId: app.appId, name: app.name }))
    }, null, 2), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error("Migration error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}