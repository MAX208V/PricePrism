/**
 * Controller for handling app-related API requests
 */

import { getApps, saveApps, getStatus, saveStatus } from '../repositories/kvRepository.js';
import { fetchAppInfo } from '../services/scraperService.js';

/**
 * Handle GET /api/apps - Get all apps
 * @param {object} env - Cloudflare environment
 * @returns {Response} JSON response with apps array
 */
export async function handleGetApps(env) {
  const apps = await getApps(env);
  const appsWithStatus = await Promise.all(
    apps.map(async (app) => {
      const status = await getStatus(env, app.app_id);
      return { ...app, status };
    })
  );
  
  // Get check history from KV storage (limited to last 30 entries)
  let history = await getHistory(env);
  
  // Sort history by time descending and limit to 30 entries
  history.sort((a, b) => new Date(b.time) - new Date(a.time));
  history = history.slice(0, 30);
  
  // Check configuration status (simplified for now)
  const hasSc3 = !!(await env.KV.get('config'));
  const hasProxy = !!(await env.KV.get('proxyUrl'));
  
  return new Response(JSON.stringify({ 
    apps: appsWithStatus,
    history: history,
    hasSc3: hasSc3,
    hasProxy: hasProxy
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle POST /api/apps - Add a new app
 * @param {Request} request - The incoming request
 * @param {object} env - Cloudflare environment
 * @returns {Response} JSON response indicating success or failure
 */
export async function handleAddApp(request, env) {
  try {
    const body = await request.json();
    const { app_id, name, threshold, country, note, monitor_mode } = body;

    // Validate required fields
    if (!app_id || typeof app_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid or missing app_id' }), { status: 400 });
    }

    if (typeof threshold !== 'number' || threshold <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid threshold' }), { status: 400 });
    }

    const apps = await getApps(env);
    const existingAppIndex = apps.findIndex((app) => app.app_id === app_id);
    
    if (existingAppIndex !== -1) {
      return new Response(JSON.stringify({ error: 'App already exists' }), { status: 400 });
    }

    // Fetch initial app info to populate status
    let status = {};
    try {
      const appInfo = await fetchAppInfo(env, app_id, country);
      status = {
        icon: appInfo.icon,
        developer: appInfo.developer,
        scoreText: appInfo.scoreText,
        ratings: appInfo.ratings,
        last_checked_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to fetch initial app info:', error);
    }

    // Save app configuration
    const newApp = {
      app_id,
      name: name || '',
      threshold,
      country: country || 'us',
      note: note || '',
      monitor_mode: monitor_mode || 'threshold'
    };
    
    apps.push(newApp);
    await saveApps(env, apps);
    
    // Save initial status
    await saveStatus(env, app_id, status);

    return new Response(JSON.stringify({ message: 'App added successfully' }), { status: 201 });
  } catch (error) {
    console.error('Error adding app:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}

/**
 * Handle PATCH /api/apps - Edit an existing app
 * @param {Request} request - The incoming request
 * @param {object} env - Cloudflare environment
 * @returns {Response} JSON response indicating success or failure
 */
export async function handleEditApp(request, env) {
  try {
    const body = await request.json();
    const { app_id, name, threshold, country, note } = body;

    if (!app_id || typeof app_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid or missing app_id' }), { status: 400 });
    }

    const apps = await getApps(env);
    const appIndex = apps.findIndex((app) => app.app_id === app_id);
    
    if (appIndex === -1) {
      return new Response(JSON.stringify({ error: 'App not found' }), { status: 404 });
    }
    
    if (name !== undefined) apps[appIndex].name = name;
    if (threshold !== undefined) apps[appIndex].threshold = threshold;
    if (country !== undefined) apps[appIndex].country = country;
    if (note !== undefined) apps[appIndex].note = note;

    await saveApps(env, apps);
    return new Response(JSON.stringify({ message: 'App updated successfully' }));
  } catch (error) {
    console.error('Error editing app:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}

/**
 * Handle DELETE /api/apps - Remove an app
 * @param {Request} request - The incoming request
 * @param {object} env - Cloudflare environment
 * @returns {Response} JSON response indicating success or failure
 */
export async function handleRemoveApp(request, env) {
  try {
    const body = await request.json();
    const { app_id } = body;

    if (!app_id || typeof app_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid or missing app_id' }), { status: 400 });
    }

    const apps = await getApps(env);
    const appIndex = apps.findIndex((app) => app.app_id === app_id);
    
    if (appIndex === -1) {
      return new Response(JSON.stringify({ error: 'App not found' }), { status: 404 });
    }

    apps.splice(appIndex, 1);
    await saveApps(env, apps);
    
    // Also remove status from KV
    await env.KV.delete(`status:${app_id}`);

    return new Response(JSON.stringify({ message: 'App removed successfully' }));
  } catch (error) {
    console.error('Error removing app:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}