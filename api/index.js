/**
 * API Router module to handle all API routes
 */

import { handleListApps, handleAddApp, handleUpdateApp, handleDeleteApp } from './apps.js';
import { handleSearch } from './search.js';
import { handleCheck } from './check.js';

export async function handleApiRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');
  
  try {
    // Route based on path and method
    switch (path) {
      case '/apps':
        switch (request.method) {
          case 'GET':
            return await handleListApps(request, env);
          case 'POST':
            return await handleAddApp(request, env);
          case 'PATCH':
            return await handleUpdateApp(request, env);
          case 'DELETE':
            return await handleDeleteApp(request, env);
          default:
            return methodNotAllowed();
        }
      
      case '/search':
        if (request.method === 'GET') {
          return await handleSearch(request, env);
        } else {
          return methodNotAllowed();
        }
      
      case '/check':
        if (request.method === 'GET' || request.method === 'POST') {
          return await handleCheck(request, env);
        } else {
          return methodNotAllowed();
        }
      
      default:
        return notFound();
    }
  } catch (error) {
    console.error('API Handler error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

function methodNotAllowed() {
  return new Response(JSON.stringify({ 
    error: 'Method not allowed' 
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 405
  });
}

function notFound() {
  return new Response(JSON.stringify({ 
    error: 'API endpoint not found' 
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 404
  });
}