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