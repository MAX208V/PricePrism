/**
 * Main entry point for the Cloudflare Worker
 */

import { routeRequest } from './router.js';
import { runScheduledCheck } from './controllers/monitorController.js';

export default {
  /**
   * Handle HTTP requests
   * @param {Request} request - The incoming request
   * @param {object} env - Cloudflare environment
   * @param {object} ctx - Context object
   * @returns {Response}
   */
  async fetch(request, env, ctx) {
    try {
      // Try to route the request to our API handlers
      const apiResponse = await routeRequest(request, env, ctx);
      
      // If we got a response from routing, return it
      if (apiResponse) {
        return apiResponse;
      }
      
      // For non-API requests, serve static assets
      // Return 404 if ASSETS binding is not configured
      if (!env.ASSETS) {
        return new Response('Not Found', { status: 404 });
      }
      
      // Serve static assets
      return await env.ASSETS.fetch(request);
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * Handle scheduled events (cron triggers)
   * @param {object} scheduledEvent - The scheduled event
   * @param {object} env - Cloudflare environment
   * @param {object} ctx - Context object
   */
  async scheduled(scheduledEvent, env, ctx) {
    try {
      console.log('Running scheduled check');
      await runScheduledCheck(env);
      console.log('Scheduled check completed');
    } catch (error) {
      console.error('Error during scheduled check:', error);
    }
  }
};