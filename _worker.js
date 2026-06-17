/**
 * Main Worker entry point
 */

// Import modules
import { handleApiRequest } from './api/index.js';
import { handleScheduled } from './modules/scheduler.js';
import { renderDashboardHtml } from './modules/dashboard.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle API requests
    if (path.startsWith('/api/')) {
      return await handleApiRequest(request, env, ctx);
    }
    
    // Serve dashboard HTML for root path
    if (path === '/' || path === '/index.html') {
      try {
        // Get apps data
        const appsData = await env.KV.get('apps', 'json') || {};
        const apps = Object.values(appsData);
        
        // Get check history
        const historyRaw = await env.KV.get('history') || '[]';
        let history = [];
        try {
          history = JSON.parse(historyRaw);
        } catch (e) {
          history = [];
        }
        
        // Sort history by time descending and limit to 30 entries
        history.sort((a, b) => new Date(b.time) - new Date(a.time));
        history = history.slice(0, 30);
        
        // Check configuration status
        const configRaw = await env.KV.get('config') || '{}';
        let config = {};
        try {
          config = JSON.parse(configRaw);
        } catch (e) {
          config = {};
        }
        
        const hasSc3 = !!config.sc3;
        const hasProxy = !!config.proxyUrl;
        
        // Render dashboard HTML
        const html = renderDashboardHtml(apps, history, hasSc3, hasProxy);
        
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      } catch (error) {
        console.error('Error rendering dashboard:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }
    
    // Serve static files from dashboard directory
    if (path.startsWith('/dashboard/')) {
      const staticPath = path.replace('/dashboard', '');
      // In a real implementation, you would serve static assets here
      // For now, we'll just redirect to the main dashboard
      return Response.redirect(url.origin, 301);
    }
    
    // Return 404 for all other paths
    return new Response('Not Found', { status: 404 });
  },
  
  async scheduled(controller, env, ctx) {
    // Handle scheduled events (cron jobs)
    await handleScheduled(env);
  }
};